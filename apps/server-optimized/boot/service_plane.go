package boot

import (
	"context"
	"server-optimized/api/service/http"
	"server-optimized/services"
	"strconv"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"
)

func getServicePort() uint16 {
	return viper.GetUint16("port")
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

	http.RegisterServicePlaneAPIRoutes(app, services)

	go func() {
		if err := app.Listen(":" + strconv.Itoa(int(getServicePort()))); err != nil {
			log.Error().Err(err).Msg("failed to start service-plane http server")
		}
	}()

	app.Hooks().OnListen(func(info fiber.ListenData) error {
		log.Info().Msgf(
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
