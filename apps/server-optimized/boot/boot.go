package boot

import (
	"context"
	services2 "server-optimized/services"

	"github.com/rs/zerolog/log"
)

func Boot(ctx context.Context) (func(), error) {
	log.Debug().Msg("creating services")
	services, servicesError := services2.CreateServices()

	if servicesError != nil {
		log.Error().Err(servicesError).Msg("failed to create services")
		return nil, servicesError
	}

	killServicePlane, servicePlaneInitError := ServicePlane(ctx, services)
	if servicePlaneInitError != nil {
		log.Error().Err(servicePlaneInitError).Msg("failed to initialize service plane")
		return nil, servicePlaneInitError
	}

	killAdminPlane, adminPlanePlaneInitError := AdminPlane(ctx, services)

	if adminPlanePlaneInitError != nil {
		log.Error().Err(servicePlaneInitError).Msg("failed to initialize admin plane")
		return nil, adminPlanePlaneInitError
	}

	return func() {
		_ = killServicePlane()
		_ = killAdminPlane()
	}, nil
}
