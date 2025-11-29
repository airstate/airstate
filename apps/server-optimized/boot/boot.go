package boot

import (
	"context"
	services2 "server-optimized/services"

	"github.com/rs/zerolog/log"
)

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
