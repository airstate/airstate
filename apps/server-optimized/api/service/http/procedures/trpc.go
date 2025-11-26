package procedures

import (
	"context"
	"encoding/json"
	"reflect"
	"server-optimized/api/service/trpc"
	"server-optimized/api/service/trpc/procedures"
	"server-optimized/services"
	trpcFramework "server-optimized/trpc"

	"github.com/bytedance/sonic"
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

func RegisterWebSocketTRPCRoute(app *fiber.App, services services.Services) {
	var _trpcMessage trpcFramework.TRPCMessage
	var _connectionParamsMessage trpcFramework.ConnectionParamsMessage

	sonic.Pretouch(reflect.TypeOf(_trpcMessage))
	sonic.Pretouch(reflect.TypeOf(_connectionParamsMessage))

	app.Use("/trpc", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}

		return fiber.ErrUpgradeRequired
	})

	app.Get("/trpc", websocket.New(func(c *websocket.Conn) {
		var (
			rawMessage []byte
			err        error
		)

		var connectionParamsMessage trpcFramework.ConnectionParamsMessage

		if c.Query("connectionParams") == "1" {
			if _, rawMessage, err = c.ReadMessage(); err != nil {
				return
			}

			if err := sonic.Unmarshal(rawMessage, &connectionParamsMessage); err != nil {
				return
			}
		}

		maxWorkerRoutines := 4
		channelIndex := -1
		transactionalChannels := make([]chan trpcFramework.TRPCMessage, maxWorkerRoutines)
		responseChannel := make(chan json.RawMessage, maxWorkerRoutines)

		trpcContext := trpc.CreateTRPCContext(app, services, c, &connectionParamsMessage.Data)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// response writer routine
		go func() {
			for {
				select {
				case responseMessage := <-responseChannel:
					err := c.WriteMessage(websocket.TextMessage, responseMessage)

					if err != nil {
						log.Debug().Err(err).Msg("failed to write response message; socket is probably already closed")
						return
					}
				case <-ctx.Done():
					return
				}
			}
		}()

		// main message handler loop
		for {
			// assuming all messages are text messages; this will fail with
			// non-conforming clients, but handled by unmarshaler error
			if _, rawMessage, err = c.ReadMessage(); err != nil {
				log.Debug().Err(err).Msg("failed to read message message; socket is probably closed")
				break
			}

			var trpcMessage trpcFramework.TRPCMessage

			if err := sonic.Unmarshal(rawMessage, &trpcMessage); err != nil {
				break
			}

			if trpcMessage.Method == "query" || trpcMessage.Method == "mutation" {
				channelIndex = (channelIndex + 1) % maxWorkerRoutines

				if transactionalChannels[channelIndex] == nil {
					invocationChannel := make(chan trpcFramework.TRPCMessage)
					transactionalChannels[channelIndex] = invocationChannel

					go func() {
						for {
							select {
							case message := <-invocationChannel:
								var handler func(ctx context.Context, trpcContext *trpc.TRPCContext, input json.RawMessage) (json.RawMessage, *trpcFramework.TRPCError)

								if message.Method == "query" {
									switch message.Params.Path {
									case "_":
										handler = procedures.HandleIndexQuery
									}
								} else if message.Method == "mutation" {

								}

								response, err := handler(ctx, trpcContext, message.Params.Input)

								if err != nil {
									// going to ignore this marshaling error, as it
									// is highly unlikely if errors are properly returned from the handler
									marshaledError, _ := sonic.Marshal(&trpcFramework.TRPCErrorResponse{
										Id:    message.Id,
										Error: *err,
									})

									responseChannel <- marshaledError
								}

								responseChannel <- response
							case <-ctx.Done():
								return
							}
						}
					}()
				}

				transactionalChannels[channelIndex] <- trpcMessage
			} else if trpcMessage.Method == "subscription" {

			} else if trpcMessage.Method == "subscription.stop" {

			}
		}
	}))
}
