package http

import (
	"server-optimized/api/service/http/procedures"
	serverState "server-optimized/api/service/http/procedures/server-state"
	"server-optimized/services"

	"github.com/gofiber/fiber/v2"
)

func RegisterServicePlaneAPIRoutes(app *fiber.App, services services.Services) {
	// /:appid/server-state/keys
	serverState.RegisterSSESubscriptionRoute(app, services)

	// /trpc
	procedures.RegisterWebSocketTRPCRoute(app, services)
}
