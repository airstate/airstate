package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"server-optimized/boot"
	"syscall"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"
	_ "github.com/spf13/viper/remote"
	validation "github.com/urfave/cli-validation"
	"github.com/urfave/cli/v3"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	viper.AddConfigPath(".")
	viper.SetConfigName("airstate")
	viper.SetConfigType("yaml")

	viper.BindEnv("maxTransactionalRoutines", "AIRSTATE_MAX_TRANSACTIONAL_ROUTINES")
	viper.BindEnv("adminPort", "AIRSTATE_ADMIN_PORT")
	viper.BindEnv("port", "AIRSTATE_PORT")

	viper.SetDefault("port", 11001)
	viper.SetDefault("adminPort", 11002)

	cli.VersionFlag = &cli.BoolFlag{
		Name: "version",
	}

	cmd := &cli.Command{
		Name:                   "airstate-server",
		Usage:                  "The better way to implement WebSockets",
		Version:                "0.1.0",
		UseShortOptionHandling: true,
		Flags: []cli.Flag{
			&cli.BoolFlag{
				Name:    "verbose",
				Aliases: []string{"v"},
				Action: func(ctx context.Context, command *cli.Command, b bool) error {
					if b {
						zerolog.SetGlobalLevel(zerolog.DebugLevel)
					}

					return nil
				},
			},
			&cli.StringFlag{
				Name:  "config-source",
				Usage: "define the config source: file, etcd, etcd3, consul, nats",
				Value: "file",
				Action: func(ctx context.Context, command *cli.Command, s string) error {
					if err := validation.Enum("file", "consul", "nats")(s); err != nil {
						println("--config-source must be in (file, etcd, etcd3, consul, nats)")
						return err
					}

					return nil
				},
			},
			&cli.StringFlag{
				Name:  "config-server",
				Usage: "url for etcd, etcd3, consul or nats",
			},
			&cli.StringFlag{
				Name:    "config-path",
				Aliases: []string{"c"},
				Usage:   "file path for file source or key for remote source",
			},
			&cli.StringFlag{
				Name:  "config-gpg-keyring",
				Usage: "path to gpg keyring file if remote config source stores encrypted configuration",
			},
			&cli.Uint16Flag{
				Name:  "port",
				Usage: "http service port for clients connect to",
				Value: 11001,
				Action: func(ctx context.Context, command *cli.Command, u uint16) error {
					if u != 11001 {
						viper.Set("port", 11001)
					}

					return nil
				},
			},
			&cli.Uint16Flag{
				Name:  "admin-port",
				Usage: "http admin server port for REST API",
				Value: 11002,
				Action: func(ctx context.Context, command *cli.Command, u uint16) error {
					if u != 11002 {
						viper.Set("adminPort", u)
					}

					return nil
				},
			},
			&cli.Uint8Flag{
				Name:  "max-transactional-routines",
				Usage: "maximum number of concurrent transaction routines to use per connection",
				Value: 4,
				Action: func(ctx context.Context, command *cli.Command, u uint8) error {
					if u != 4 {
						viper.Set("maxTransactionalRoutines", u)
					}

					return nil
				},
			},
		},
		Action: func(ctx context.Context, command *cli.Command) error {
			configSource := command.String("config-source")

			if configSource != "file" {
				configServer := command.String("config-server")

				if configServer == "" {
					err := errors.New("config server is required for selected config source")
					fmt.Printf("%v\n", err)
					return err
				}

				configPath := command.String("config-path")

				if configPath == "" {
					err := errors.New("config path is required for selected config source")
					fmt.Printf("%v\n", err)
					return err
				}

				configGPGKeyring := command.String("config-gpg-keyring")

				var remoteAddingErr error

				if configGPGKeyring == "" {
					remoteAddingErr = viper.AddRemoteProvider(configSource, configServer, configPath)
				} else {
					remoteAddingErr = viper.AddSecureRemoteProvider(configSource, configServer, configPath, configGPGKeyring)
				}

				if remoteAddingErr != nil {
					fmt.Printf("%v\n", remoteAddingErr)
					return remoteAddingErr
				}

				err := viper.ReadRemoteConfig()

				if err != nil {
					fmt.Printf("%v\n", err)
					return err
				}
			} else {
				configPath := command.String("config-path")

				if configPath == "" {
					err := viper.ReadInConfig()

					var fileLookupError viper.ConfigFileNotFoundError

					if err != nil && !errors.As(err, &fileLookupError) {
						fmt.Printf("%v\n", err)
						return err
					}
				} else {
					viper.SetConfigFile(configPath)

					err := viper.ReadInConfig()

					if err != nil {
						fmt.Printf("%v\n", err)
						return err
					}
				}
			}

			bootErr := boot.Boot(ctx)

			if bootErr != nil {
				log.Error().Err(bootErr).Msg("error booting server")
				return bootErr
			}

			// signal handling for graceful shutdown
			osSignalChannel := make(chan os.Signal, 1)
			signal.Notify(osSignalChannel, os.Interrupt, syscall.SIGTERM)

			<-osSignalChannel
			return nil
		},
	}

	if err := cmd.Run(context.Background(), os.Args); err != nil {
		log.Error().Err(err)
	}
}
