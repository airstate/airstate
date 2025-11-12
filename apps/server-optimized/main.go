package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	initer "server-optimized/init"
	systemServices "server-optimized/services"
	"syscall"
)

func main() {
	ctx, cancelCtx := context.WithCancel(context.Background())
	defer cancelCtx()

	services, servicesError := systemServices.CreateServices()

	if servicesError != nil {
		log.Fatal("service boot", servicesError)
	}

	killServicePlane, servicePlaneInitError := initer.ServicePlane(ctx, services)
	defer killServicePlane()

	if servicePlaneInitError != nil {
		log.Fatal("service-plane init", servicePlaneInitError)
	}

	killAdminPlane, adminPlanePlaneInitError := initer.AdminPlane(ctx, services)
	defer killAdminPlane()

	if adminPlanePlaneInitError != nil {
		log.Fatal("admin-plane init", servicePlaneInitError)
	}

	// signal handling for graceful shutdown
	osSignalChannel := make(chan os.Signal, 1)
	signal.Notify(osSignalChannel, os.Interrupt, syscall.SIGTERM)

	<-osSignalChannel
}
