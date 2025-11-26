package http

import (
	server_state "server-optimized/api/admin/http/procedures/server-state"
	"server-optimized/services"

	"github.com/gofiber/fiber/v2"
)

func RegisterAdminPlaneHTTPRoutes(app *fiber.App, services services.Services) {
	app.Delete("/:appId/server-state/:key", server_state.RemoveKey(services))
	app.Put("/:appId/server-state/:key", server_state.ReplaceKey(services))
	app.Patch("/:appId/server-state/:key", server_state.DeepMergeKey(services))
	app.Post("/:appId/server-state/:key", server_state.AtomicOps(services))
}
