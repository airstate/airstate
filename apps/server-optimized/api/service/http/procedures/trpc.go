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

type SubscriptionContext struct {
	cancel context.CancelFunc
}

func RegisterWebSocketTRPCRoute(app *fiber.App, services services.Services) {
	var _trpcMessage trpcFramework.TRPCMessage
	var _connectionParamsMessage trpcFramework.ConnectionParamsMessage

	_ = sonic.Pretouch(reflect.TypeOf(_trpcMessage))
	_ = sonic.Pretouch(reflect.TypeOf(_connectionParamsMessage))

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
		channelIndex := -1 // used for round-robin worker routine utilization

		// send messages to be handled by worker
		// routines using these channels
		transactionalChannels := make([]chan trpcFramework.TRPCMessage, maxWorkerRoutines)

		// the central response channel
		responseChannel := make(chan json.RawMessage, maxWorkerRoutines)

		trpcContext := trpc.CreateTRPCContext(app, services, c, &connectionParamsMessage.Data)

		subscriptionContexts := make(map[int64]*SubscriptionContext, 8)

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
								var response json.RawMessage
								var err *trpcFramework.TRPCError

								if message.Method == "query" {
									switch message.Params.Path {
									case "_":
										response, err = procedures.HandleIndexQuery(ctx, trpcContext, message.Params.Input)
									}
								} else if message.Method == "mutation" {

								}

								if err != nil {
									// going to ignore this marshaling error, as it
									// is highly unlikely if errors are properly returned from the handler
									marshaledError, _ := sonic.Marshal(&trpcFramework.TRPCErrorResponse{
										Id:    message.Id,
										Error: err,
									})

									responseChannel <- marshaledError
								}

								marshaledTRPCResponse, marshalingErr := sonic.Marshal(&trpcFramework.TRPCResultResponse{
									Id: message.Id,
									Result: trpcFramework.TRPCResult{
										Type: "data",
										Data: response,
									},
								})

								if marshalingErr != nil {
									return
								}

								responseChannel <- marshaledTRPCResponse
							case <-ctx.Done():
								return
							}
						}
					}()
				}

				transactionalChannels[channelIndex] <- trpcMessage
			} else if trpcMessage.Method == "subscription" {
				subscriptionContext, cancelSubscriptionContext := context.WithCancel(ctx)

				subscriptionContexts[trpcMessage.Id] = &SubscriptionContext{
					cancel: cancelSubscriptionContext,
				}

				go func() {
					marshaledStartedMessage, _ := sonic.Marshal(&trpcFramework.TRPCTypeOnlyResultResponse{
						Id: trpcMessage.Id,
						Result: trpcFramework.TRPCTypeOnlyResult{
							Type: "started",
						},
					})

					responseChannel <- marshaledStartedMessage

					var trpcError *trpcFramework.TRPCError

					switch trpcMessage.Params.Path {
					case "seconds":
						trpcError = procedures.HandleSecondsSubscription(subscriptionContext, trpcContext, trpcMessage.Params.Input, func(message json.RawMessage) {
							marshaledResponseMessage, _ := sonic.Marshal(&trpcFramework.TRPCResultResponse{
								Id: trpcMessage.Id,
								Result: trpcFramework.TRPCResult{
									Type: "data",
									Data: message,
								},
							})

							responseChannel <- marshaledResponseMessage
						})
					}

					if trpcError != nil {
						marshaledError, _ := sonic.Marshal(&trpcFramework.TRPCErrorResponse{
							Id:    trpcMessage.Id,
							Error: trpcError,
						})

						responseChannel <- marshaledError
					}

					marshaledStoppedMessage, _ := sonic.Marshal(&trpcFramework.TRPCTypeOnlyResultResponse{
						Id: trpcMessage.Id,
						Result: trpcFramework.TRPCTypeOnlyResult{
							Type: "stopped",
						},
					})

					responseChannel <- marshaledStoppedMessage
				}()
			} else if trpcMessage.Method == "subscription.stop" {
				subscriptionContext, ok := subscriptionContexts[trpcMessage.Id]

				if ok {
					subscriptionContext.cancel()
					delete(subscriptionContexts, trpcMessage.Id)
				}
			}
		}
	}))
}
