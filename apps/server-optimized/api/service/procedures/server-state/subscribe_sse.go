package server_state

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"

	"server-optimized/api/admin/procedures/server-state/utils"
	"server-optimized/services"

	"github.com/gofiber/fiber/v2"
	"github.com/nats-io/nats.go"
)

func RegisterSSESubscriptionRoute(app *fiber.App, services services.Services) {
	natsConn := services.GetNATSConnection()

	app.Get("/:appId/server-state/keys", func(c *fiber.Ctx) error {
		appID := c.Params("appId")
		log.Printf("[SSE] New SSE connection request - appId: %s", appID)
		
		if appID == "" {
			log.Printf("[SSE] Error: appId is empty")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "appid is required",
			})
		}

		keysParam := c.Query("keys")
		
		if keysParam == "" {
			log.Printf("[SSE] Error: keys parameter is empty")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "keys query parameter is required (comma-separated)",
			})
		}

		keys := strings.Split(keysParam, ",")
		if len(keys) == 0 {
			log.Printf("[SSE] Error: no keys found after splitting")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "at least one key is required",
			})
		}

		for i := range keys {
			keys[i] = strings.TrimSpace(keys[i])
			if keys[i] == "" {
				log.Printf("[SSE] Error: empty key found at index %d", i)
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
				log.Printf("[SSE] Failed to generate hash for key %s: %v", key, err)
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": fmt.Sprintf("failed to generate hash for key: %s", key),
				})
			}

			subject := fmt.Sprintf("server-state.%s_%s", appID, hashedKey)
			log.Printf("[SSE] Subscribing to NATS subject: %s (key: %s, hashedKey: %s)", subject, key, hashedKey)

			sub, err := natsConn.Subscribe(subject, func(msg *nats.Msg) {
				log.Printf("[SSE] NATS message received on subject: %s (key: %s)", subject, key)
				log.Printf("[SSE] Message data: %s", string(msg.Data))
				
				updateCount := msg.Header.Get("update_count")
				if updateCount == "" {
					updateCount = "0"
				}
				log.Printf("[SSE] Update count: %s", updateCount)

				var value interface{}
				if string(msg.Data) == "null" {
					value = nil
					log.Printf("[SSE] Message value is null")
				} else {
					if err := json.Unmarshal(msg.Data, &value); err != nil {
						log.Printf("[SSE] Failed to unmarshal NATS message for key %s: %v", key, err)
						return
					}
					log.Printf("[SSE] Parsed value: %+v", value)
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
					log.Printf("[SSE] WARNING: Update channel full, dropping update for key %s", key)
				}
			})

			if err != nil {
				log.Printf("[SSE] Failed to subscribe to NATS subject %s: %v", subject, err)
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
				log.Printf("[SSE] Starting cleanup for appId: %s", appID)
				cancel()
				subscriptionsMutex.Lock()
				log.Printf("[SSE] Unsubscribing from %d NATS subscriptions", len(subscriptions))
				for _, sub := range subscriptions {
					sub.Unsubscribe()
				}
				subscriptionsMutex.Unlock()
				close(updateChan)
				log.Printf("[SSE] Cleanup completed for appId: %s", appID)
			})
		}

		if _, err := c.Write([]byte(": connected\n\n")); err != nil {
			log.Printf("[SSE] Failed to write initial connection message: %v", err)
			cleanup()
			return nil
		}

		for {
			select {
			case <-ctx.Done():
				log.Printf("[SSE] Context cancelled, stopping stream for appId: %s", appID)
				cleanup()
				return nil
			case <-c.Context().Done():
				log.Printf("[SSE] Client disconnected, stopping stream for appId: %s", appID)
				cleanup()
				return nil
			case update, ok := <-updateChan:
				if !ok {
					log.Printf("[SSE] Update channel closed, stopping stream for appId: %s", appID)
					cleanup()
					return nil
				}

				log.Printf("[SSE] Received update from channel - key: %s, update_count: %s", update.Key, update.UpdateCount)
				log.Printf("[SSE] Update value: %+v", update.Value)

				eventData, err := json.Marshal(update)
				if err != nil {
					log.Printf("[SSE] Failed to marshal update: %v", err)
					continue
				}
				log.Printf("[SSE] Marshaled event data: %s", string(eventData))

				sseMessage := fmt.Sprintf("data: %s\n\n", string(eventData))
				log.Printf("[SSE] Writing SSE message to client: %s", sseMessage)
				if _, err := c.Write([]byte(sseMessage)); err != nil {
					log.Printf("[SSE] Failed to write SSE message: %v", err)
					cleanup()
					return nil
				}
				log.Printf("[SSE] SSE message successfully written to client")
			}
		}
	})
}

type SSEUpdate struct {
	Key         string      `json:"key"`
	Value       interface{} `json:"value"`
	UpdateCount string      `json:"update_count"`
}
