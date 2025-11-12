package main

import (
	"context"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"os"
	"os/signal"
	initer "server-optimized/init"
	systemServices "server-optimized/services"
	"syscall"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs

	ctx, cancelCtx := context.WithCancel(context.Background())
	defer cancelCtx()

	services, servicesError := systemServices.CreateServices()

	if servicesError != nil {
		log.Error().Err(servicesError).Msg("failed to create services")
		os.Exit(1)
	}

	killServicePlane, servicePlaneInitError := initer.ServicePlane(ctx, services)
	defer killServicePlane()

	if servicePlaneInitError != nil {
		log.Error().Err(servicePlaneInitError).Msg("failed to initialize service plane")
		os.Exit(1)
	}

	killAdminPlane, adminPlanePlaneInitError := initer.AdminPlane(ctx, services)
	defer killAdminPlane()

	if adminPlanePlaneInitError != nil {
		log.Error().Err(servicePlaneInitError).Msg("failed to initialize admin plane")
		os.Exit(1)
	}

	// signal handling for graceful shutdown
	osSignalChannel := make(chan os.Signal, 1)
	signal.Notify(osSignalChannel, os.Interrupt, syscall.SIGTERM)

	<-osSignalChannel
}
