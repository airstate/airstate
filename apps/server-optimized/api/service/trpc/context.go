package trpc

import (
	"server-optimized/services"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
)

type TRPCContext struct {
	App        *fiber.App
	Services   services.Services
	Connection *websocket.Conn
}

func CreateTRPCContext(app *fiber.App, services services.Services, connection *websocket.Conn, connectionParams *map[string]string) *TRPCContext {
	return &TRPCContext{
		App:        app,
		Services:   services,
		Connection: connection,
	}
}
