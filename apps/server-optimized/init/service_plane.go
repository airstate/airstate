package init

import (
	"context"
	"log"
	"os"
	"server-optimized/api/service"
	"server-optimized/services"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gofiber/fiber/v2"
)

func getServicePort() string {
	port := os.Getenv("AIRSTATE_PORT")

	if port == "" {
		port = os.Getenv("PORT")
	}

	if port == "" {
		port = "11001"
	}

	return port
}

func startServicePlaneHTTPServer(ctx context.Context, services services.Services) (func() error, error) {
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
		JSONEncoder:           sonic.Marshal,
		JSONDecoder:           sonic.Unmarshal,
	})

	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(&fiber.Map{
			"message": "HELLO FROM AirState's server-optimized:service-plane",
			"type":    "HTTP",
			"time":    time.Now().Format(time.RFC3339),
		})
	})

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(&fiber.Map{
			"status": "OK",
		})
	})

	service.RegisterServicePlaneAPIRoutes(app, services)

	go func() {
		if err := app.Listen(":" + getServicePort()); err != nil {
			log.Fatal("failed to start service-plane http server", err)
		}
	}()

	app.Hooks().OnListen(func(info fiber.ListenData) error {
		log.Printf(
			"service-plane http server started on http://%s:%s",
			info.Host,
			info.Port,
		)

		return nil
	})

	return func() error {
		return app.ShutdownWithContext(ctx)
	}, nil
}

func ServicePlane(ctx context.Context, services services.Services) (func() error, error) {
	// HTTP Server
	killHTTPServer, httpServerError := startServicePlaneHTTPServer(ctx, services)

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
