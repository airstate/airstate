package admin

import (
	serverState "server-optimized/api/admin/procedures/server-state"
	"server-optimized/services"

	"github.com/gofiber/fiber/v2"
)

func RegisterAdminPlaneAPIRoutes(app *fiber.App, services services.Services) {
	serverState.RegisterRoutes(app, services)
}
