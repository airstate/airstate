package boot

import (
	"context"
	services2 "server-optimized/services"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"
)

func SetupGlobals() {
	zerolog.TimeFieldFormat = time.RFC3339Nano
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	viper.AddConfigPath(".")
	viper.SetConfigName("airstate")
	viper.SetConfigType("yaml")

	viper.BindEnv("maxTransactionalRoutines", "AIRSTATE_MAX_TRANSACTIONAL_ROUTINES")
	viper.BindEnv("adminPort", "AIRSTATE_ADMIN_PORT")
	viper.BindEnv("port", "AIRSTATE_PORT")

	viper.SetDefault("maxTransactionalRoutines", 4)
	viper.SetDefault("port", 11001)
	viper.SetDefault("adminPort", 11002)
}

func Boot(ctx context.Context) error {
	log.Debug().Msg("creating services")
	services, servicesError := services2.CreateServices()

	if servicesError != nil {
		return servicesError
	}

	servicePlaneInitError := ServicePlane(ctx, services)

	if servicePlaneInitError != nil {
		log.Error().Err(servicePlaneInitError).Msg("failed to initialize service plane")
		return servicePlaneInitError
	}

	adminPlanePlaneInitError := AdminPlane(ctx, services)

	if adminPlanePlaneInitError != nil {
		return adminPlanePlaneInitError
	}

	return nil
}
