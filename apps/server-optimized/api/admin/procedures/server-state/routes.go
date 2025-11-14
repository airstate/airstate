package server_state

import (
	"server-optimized/api/admin/procedures/server-state/handlers"
	"server-optimized/services"

	"github.com/gofiber/fiber/v2"
)

func RegisterRoutes(app *fiber.App, svc services.Services) {
	
	app.Delete("/:appId/server-state/:key", handlers.RemoveKey(svc))
	app.Put("/:appId/server-state/:key", handlers.ReplaceKey(svc))
	app.Patch("/:appId/server-state/:key", handlers.DeepMergeKey(svc))
	app.Post("/:appId/server-state/:key", handlers.AtomicOps(svc))
	
		
}