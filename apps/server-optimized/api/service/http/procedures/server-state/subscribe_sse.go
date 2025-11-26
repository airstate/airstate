package server_state

import (
	"context"
	"encoding/json"
	"fmt"
	"server-optimized/utils"
	"strings"
	"sync"

	"server-optimized/services"

	"github.com/gofiber/fiber/v2"
	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog/log"
)

func RegisterSSESubscriptionRoute(app *fiber.App, services services.Services) {
	natsConn := services.GetNATSConnection()

	app.Get("/:appId/server-state/keys", func(c *fiber.Ctx) error {
		appID := c.Params("appId")
		log.Info().Str("appId", appID).Msg("[SSE] New SSE connection request")

		if appID == "" {
			log.Error().Msg("[SSE] Error: appId is empty")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "appid is required",
			})
		}

		keysParam := c.Query("keys")

		if keysParam == "" {
			log.Error().Msg("[SSE] Error: keys parameter is empty")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "keys query parameter is required (comma-separated)",
			})
		}

		keys := strings.Split(keysParam, ",")
		if len(keys) == 0 {
			log.Error().Msg("[SSE] Error: no keys found after splitting")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "at least one key is required",
			})
		}

		for i := range keys {
			keys[i] = strings.TrimSpace(keys[i])
			if keys[i] == "" {
				log.Error().Int("index", i).Msg("[SSE] Error: empty key found")
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "keys cannot be empty",
				})
			}
		}

		c.Set("Content-Type", "text/event-stream")
		c.Set("Cache-Control", "no-cache")
		c.Set("Connection", "keep-alive")
		c.Set("X-Accel-Buffering", "no")

		ctx, cancel := context.WithCancel(c.Context())
		defer cancel()

		var subscriptions []*nats.Subscription
		var subscriptionsMutex sync.Mutex
		var cleanupOnce sync.Once

		updateChan := make(chan SSEUpdate, 100)

		for _, key := range keys {
			hashedKey, err := utils.GenerateHash(key)
			if err != nil {
				log.Error().Str("key", key).Err(err).Msg("[SSE] Failed to generate hash for key")
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": fmt.Sprintf("failed to generate hash for key: %s", key),
				})
			}

			subject := fmt.Sprintf("server-state.%s_%s", appID, hashedKey)
			log.Info().Str("subject", subject).Str("key", key).Str("hashedKey", hashedKey).Msg("[SSE] Subscribing to NATS subject")

			sub, err := natsConn.Subscribe(subject, func(msg *nats.Msg) {
				log.Debug().Str("subject", subject).Str("key", key).Msg("[SSE] NATS message received")
				log.Debug().Str("data", string(msg.Data)).Msg("[SSE] Message data")

				updateCount := msg.Header.Get("update_count")
				if updateCount == "" {
					updateCount = "0"
				}
				log.Debug().Str("update_count", updateCount).Msg("[SSE] Update count")

				var value interface{}
				if string(msg.Data) == "null" {
					value = nil
					log.Debug().Msg("[SSE] Message value is null")
				} else {
					if err := json.Unmarshal(msg.Data, &value); err != nil {
						log.Error().Str("key", key).Err(err).Msg("[SSE] Failed to unmarshal NATS message for key")
						return
					}
					log.Debug().Interface("value", value).Msg("[SSE] Parsed value")
				}

				update := SSEUpdate{
					Key:         key,
					Value:       value,
					UpdateCount: updateCount,
				}

				select {
				case updateChan <- update:
				case <-ctx.Done():
					return
				default:
					log.Warn().Str("key", key).Msg("[SSE] Update channel full, dropping update")
				}
			})

			if err != nil {
				log.Error().Str("subject", subject).Err(err).Msg("[SSE] Failed to subscribe to NATS subject")
				subscriptionsMutex.Lock()
				for _, s := range subscriptions {
					s.Unsubscribe()
				}
				subscriptionsMutex.Unlock()
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": fmt.Sprintf("failed to subscribe to key: %s", key),
				})
			}

			subscriptionsMutex.Lock()
			subscriptions = append(subscriptions, sub)
			subscriptionsMutex.Unlock()
		}

		cleanup := func() {
			cleanupOnce.Do(func() {
				log.Info().Str("appId", appID).Msg("[SSE] Starting cleanup")
				cancel()
				subscriptionsMutex.Lock()
				log.Info().Int("subscription_count", len(subscriptions)).Msg("[SSE] Unsubscribing from NATS subscriptions")
				for _, sub := range subscriptions {
					sub.Unsubscribe()
				}
				subscriptionsMutex.Unlock()
				close(updateChan)
				log.Info().Str("appId", appID).Msg("[SSE] Cleanup completed")
			})
		}

		if _, err := c.Write([]byte(": connected\n\n")); err != nil {
			log.Error().Err(err).Msg("[SSE] Failed to write initial connection message")
			cleanup()
			return nil
		}

		for {
			select {
			case <-ctx.Done():
				log.Info().Str("appId", appID).Msg("[SSE] Context cancelled, stopping stream")
				cleanup()
				return nil
			case <-c.Context().Done():
				log.Info().Str("appId", appID).Msg("[SSE] Client disconnected, stopping stream")
				cleanup()
				return nil
			case update, ok := <-updateChan:
				if !ok {
					log.Info().Str("appId", appID).Msg("[SSE] Update channel closed, stopping stream")
					cleanup()
					return nil
				}

				log.Debug().Str("key", update.Key).Str("update_count", update.UpdateCount).Msg("[SSE] Received update from channel")
				log.Debug().Interface("value", update.Value).Msg("[SSE] Update value")

				eventData, err := json.Marshal(update)
				if err != nil {
					log.Error().Err(err).Msg("[SSE] Failed to marshal update")
					continue
				}
				log.Debug().Str("event_data", string(eventData)).Msg("[SSE] Marshaled event data")

				sseMessage := fmt.Sprintf("data: %s\n\n", string(eventData))
				log.Debug().Str("sse_message", sseMessage).Msg("[SSE] Writing SSE message to client")
				if _, err := c.Write([]byte(sseMessage)); err != nil {
					log.Error().Err(err).Msg("[SSE] Failed to write SSE message")
					cleanup()
					return nil
				}
				log.Debug().Msg("[SSE] SSE message successfully written to client")
			}
		}
	})
}

type SSEUpdate struct {
	Key         string      `json:"key"`
	Value       interface{} `json:"value"`
	UpdateCount string      `json:"update_count"`
}
