package init

import (
	"context"
	"log"
	"os"
	"server-optimized/services"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gofiber/fiber/v2"
)

func getAdminPort() string {
	port := os.Getenv("AIRSTATE_ADMIN_PORT")

	if port == "" {
		port = os.Getenv("ADMIN_PORT")
	}

	if port == "" {
		port = "11002"
	}

	return port
}

func startAdminPlaneHTTPServer(ctx context.Context, services services.Services) (func() error, error) {
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
		JSONEncoder:           sonic.Marshal,
		JSONDecoder:           sonic.Unmarshal,
	})

	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(&fiber.Map{
			"message": "HELLO FROM AirState's server-optimized:admin-plane",
			"type":    "HTTP",
			"time":    time.Now().Format(time.RFC3339),
		})
	})

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(&fiber.Map{
			"status": "OK",
		})
	})

	go func() {
		if err := app.Listen(":" + getAdminPort()); err != nil {
			log.Fatal("failed to start admin-plane http server", err)
		}
	}()

	app.Hooks().OnListen(func(info fiber.ListenData) error {
		log.Printf(
			"admin-plane http server started on http://%s:%s",
			info.Host,
			info.Port,
		)

		return nil
	})

	return func() error {
		return app.ShutdownWithContext(ctx)
	}, nil
}

func AdminPlane(ctx context.Context, services services.Services) (func() error, error) {
	// HTTP Server
	killHTTPServer, httpServerError := startAdminPlaneHTTPServer(ctx, services)

	if httpServerError != nil {
		return nil, httpServerError
	}

	return func() error {
		if err := killHTTPServer(); err != nil {
			return err
		}

		return nil
	}, nil
}
