package server_state

import (
	"bufio"
	"fmt"
	"server-optimized/services"

	"github.com/rs/zerolog/log"

	"github.com/gofiber/fiber/v2"
	natsGo "github.com/nats-io/nats.go"
)

func RegisterSSESubscriptionRoute(app *fiber.App, services services.Services) {
	nats := services.GetNATSConnection()

	app.Get("/:appid/server-state/__sse", func(c *fiber.Ctx) error {
		// the main SSE route for server-state

		var keyList []string

		for _, key := range c.Context().QueryArgs().PeekMulti("key") {
			if len(key) > 0 {
				keyList = append(keyList, string(key))
			}
		}

		if len(keyList) == 0 {
			return c.Status(400).JSON(fiber.Map{
				"error": "at least one valid 'key' query parameter is required",
			})
		}

		c.Set("Content-Type", "text/event-stream")
		c.Set("Cache-Control", "no-cache")
		c.Set("Connection", "keep-alive")
		c.Set("Access-Control-Allow-Origin", "*")
		c.Set("Access-Control-Allow-Headers", "Cache-Control")

		requestContext := c.Context()

		requestContext.SetBodyStreamWriter(func(w *bufio.Writer) {
			msgChan := make(chan *natsGo.Msg, 1024)
			var subscriptions []*natsGo.Subscription

			for _, key := range keyList {
				sub, err := nats.ChanSubscribe("server-state."+key, msgChan)

				if err != nil {
					log.Error().Err(err).Msgf("error subscribing to key %s", key)
					continue
				}

				subscriptions = append(subscriptions, sub)
			}

			cleanup := func() {
				for _, sub := range subscriptions {
					if sub.IsValid() {
						if err := sub.Unsubscribe(); err != nil {
							log.Error().Err(err).Msgf("error unsubscribing from subscription %s", sub.Subject)
							continue
						}
					}
				}

				select {
				case <-msgChan:
				default:
					close(msgChan)
				}
			}

			defer cleanup()

			if _, err := fmt.Fprintf(w, "\n"); err != nil {
				log.Error().Err(err).Msgf("error writing to client")
				return
			}

			if err := w.Flush(); err != nil {
				log.Error().Err(err).Msgf("error flushing writer")
				return
			}

			for {
				select {
				case msg, ok := <-msgChan:
					if !ok {
						return
					}

					if _, err := fmt.Fprintf(w, "data: %s\n\n", string(msg.Data)); err != nil {
						return
					}

					if err := w.Flush(); err != nil {
						return
					}
				case <-requestContext.Done():
					cleanup()
					return
				}
			}
		})

		return nil
	})
}
