package main

import (
    "context"
    "errors"
    "log"
    "net/http"
    "os"
    "time"

    "github.com/gofiber/fiber/v2"
)

// startServers starts the WebSocket publisher server and the Fiber app with SSE routes.
// It returns a stop function that gracefully shuts both servers down.
func startServers() (stop func() error, err error) {
    // Start WebSocket server (publishing endpoint)
    wsServer := startWebSocketServer()

    // Initialize Fiber app
    app := fiber.New(fiber.Config{
        DisableStartupMessage: false,
        AppName:               "SSE Server",
    })

    // Health check endpoint
    app.Get("/health", func(c *fiber.Ctx) error {
        pool, poolErr := getNATSPool()
        if poolErr != nil {
            return c.Status(503).JSON(fiber.Map{
                "status": "unhealthy",
                "error":  poolErr.Error(),
            })
        }
        if !pool.Ready() {
            return c.Status(503).JSON(fiber.Map{
                "status": "unhealthy",
                "error":  "NATS pool not ready",
            })
        }
        return c.JSON(fiber.Map{
            "status": "healthy",
        })
    })

    // SSE endpoint
    app.Get("/_default/server-state/subscribe/sse", sseHandler)

    // Get port from environment or default to 8080
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    // Start Fiber in background
    go func() {
        if listenErr := app.Listen(":" + port); listenErr != nil && !errors.Is(listenErr, http.ErrServerClosed) {
            log.Fatalf("Failed to start server: %v", listenErr)
        }
    }()
    log.Printf("Starting SSE server on port %s", port)

    // Return graceful stop
    return func() error {
        var retErr error

        // Shutdown Fiber
        if app != nil {
            if shutdownErr := app.Shutdown(); shutdownErr != nil {
                log.Printf("Fiber shutdown error: %v", shutdownErr)
                retErr = shutdownErr
            }
        }

        // Shutdown WebSocket server
        if wsServer != nil {
            shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
            defer cancel()
            if err := wsServer.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
                log.Printf("WebSocket server shutdown error: %v", err)
                if retErr == nil {
                    retErr = err
                }
            }
        }
        return retErr
    }, nil
}


