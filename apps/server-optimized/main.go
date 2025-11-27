package main

import (
	"context"
	"os"
	"os/signal"
	initer "server-optimized/init"
	systemServices "server-optimized/services"
	"syscall"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func StartServer(ctx context.Context) (func(), error) {
	services, servicesError := systemServices.CreateServices()

	if servicesError != nil {
		log.Error().Err(servicesError).Msg("failed to create services")
		return nil, servicesError
	}

	killServicePlane, servicePlaneInitError := initer.ServicePlane(ctx, services)
	if servicePlaneInitError != nil {
		log.Error().Err(servicePlaneInitError).Msg("failed to initialize service plane")
		return nil, servicePlaneInitError
	}

	killAdminPlane, adminPlanePlaneInitError := initer.AdminPlane(ctx, services)

	if adminPlanePlaneInitError != nil {
		log.Error().Err(servicePlaneInitError).Msg("failed to initialize admin plane")
		return nil, adminPlanePlaneInitError
	}

	return func() {
		_ = killServicePlane()
		_ = killAdminPlane()
	}, nil
}

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
	zerolog.SetGlobalLevel(zerolog.DebugLevel)

	ctx, cancelCtx := context.WithCancel(context.Background())
	defer cancelCtx()

	killServer, err := StartServer(ctx)
	defer killServer()

	if err != nil {
		os.Exit(1)
	}

	// signal handling for graceful shutdown
	osSignalChannel := make(chan os.Signal, 1)
	signal.Notify(osSignalChannel, os.Interrupt, syscall.SIGTERM)

	<-osSignalChannel
}
