package main

import (
	"context"
	"os"
	"os/signal"
	"server-optimized/boot"
	"syscall"

	"github.com/rs/zerolog"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
	zerolog.SetGlobalLevel(zerolog.DebugLevel)

	ctx, cancelCtx := context.WithCancel(context.Background())
	defer cancelCtx()

	killServer, err := boot.Boot(ctx)
	defer killServer()

	if err != nil {
		os.Exit(1)
	}

	// signal handling for graceful shutdown
	osSignalChannel := make(chan os.Signal, 1)
	signal.Notify(osSignalChannel, os.Interrupt, syscall.SIGTERM)

	<-osSignalChannel
}
