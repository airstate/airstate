package server_state

import (
	"server-optimized/services"

	"github.com/gofiber/fiber/v2"
)

func RegisterSSESubscriptionRoute(app *fiber.App, services services.Services) {
	nats := services.GetNATSConnection()

	app.Get("/:appid/server-state/keys", func(c *fiber.Ctx) error {
		// the main SSE route for server-state

		// dummy service usage
		return nats.Publish("dummy", []byte("dummy-publish"))
	})
}
