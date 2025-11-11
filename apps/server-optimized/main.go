package main

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	natsService "server-optimized/services/nats"
	"syscall"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/nats-io/nats.go"
)

type PublishedMessage struct {
	Key  string      `json:"key"`
	Data interface{} `json:"data"`
}

func startHTTPServer(ctx context.Context) func() error {
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})

	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "HELLO FROM airstate's server-optimized.",
			"time":    time.Now().Format(time.RFC3339),
		})
	})

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "OK",
		})
	})

	app.Get("/_default/server-state.subscribe-sse", func(c *fiber.Ctx) error {
		keys := c.Query("key")

		if keys == "" {
			return c.Status(400).JSON(fiber.Map{
				"error": "At least one 'key' query parameter is required",
			})
		}

		// Parse multiple key parameters
		var keyList []string
		for _, key := range c.Context().QueryArgs().PeekMulti("key") {
			if len(key) > 0 {
				keyList = append(keyList, string(key))
			}
		}

		if len(keyList) == 0 {
			return c.Status(400).JSON(fiber.Map{
				"error": "At least one valid 'key' query parameter is required",
			})
		}

		c.Set("Content-Type", "text/event-stream")
		c.Set("Cache-Control", "no-cache")
		c.Set("Connection", "keep-alive")
		c.Set("Access-Control-Allow-Origin", "*")
		c.Set("Access-Control-Allow-Headers", "Cache-Control")

		requestContext := c.Context()

		requestContext.SetBodyStreamWriter(func(w *bufio.Writer) {
			// Create a channel to receive messages from all subscriptions
			msgChan := make(chan *nats.Msg, 1024)
			var subscriptions []*nats.Subscription

			// Subscribe to each key
			for _, key := range keyList {
				sub, err := natsService.NatsConn.Subscribe("server-state."+key, func(msg *nats.Msg) {
					msgChan <- msg
				})

				if err != nil {
					log.Printf("Error subscribing to key %s: %v", key, err)
					continue
				}

				subscriptions = append(subscriptions, sub)
			}

			cleanup := func() {
				for _, sub := range subscriptions {
					if sub.IsValid() {
						sub.Unsubscribe()
					}
				}

				select {
				case <-msgChan:
				default:
					close(msgChan)
				}
			}

			defer cleanup()

			fmt.Fprintf(w, "\n")
			w.Flush()

			for {
				select {
				case msg, ok := <-msgChan:
					if !ok {
						log.Println("CHANNEL CLOSED")
						return
					}

					fmt.Fprintf(w, "data: %s\n\n", string(msg.Data))

					if err := w.Flush(); err != nil {
						log.Println("CONNECTION ERROR", err)
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

	// POST endpoint to publish messages to NATS
	app.Post("/_default/server-state.publish", func(c *fiber.Ctx) error {
		// Get the key from query parameter
		key := c.Query("key")
		if key == "" {
			return c.Status(400).JSON(fiber.Map{
				"error": "key query parameter is required",
			})
		}

		// Get the JSON body
		body := c.Body()
		if len(body) == 0 {
			return c.Status(400).JSON(fiber.Map{
				"error": "request body is required",
			})
		}

		// Validate that it's valid JSON
		var jsonData interface{}
		if err := sonic.Unmarshal(body, &jsonData); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"error": "invalid JSON in request body",
			})
		}

		// Publish to NATS topic
		topic := "server-state." + key
		if err := natsService.NatsConn.Publish(topic, body); err != nil {
			return c.Status(500).JSON(fiber.Map{
				"error": "failed to publish message",
			})
		}

		return c.JSON(fiber.Map{
			"status": "published",
			"topic":  topic,
		})
	})

	port := os.Getenv("PORT")

	if port == "" {
		port = "8080"
	}

	go func() {
		log.Printf("Starting HTTP server on port %s", port)

		if err := app.Listen(":" + port); err != nil {
			log.Printf("Failed to start HTTP server: %v", err)
		}
	}()

	return func() error {
		return app.Shutdown()
	}
}

func startWSServer(ctx context.Context) func() error {
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})

	// Middleware to check if the request is a WebSocket upgrade
	app.Use("/rpc", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	// WebSocket endpoint
	app.Get("/rpc", websocket.New(func(c *websocket.Conn) {
		var (
			messageType int
			message     []byte
			err         error
		)

		for {
			if messageType, message, err = c.ReadMessage(); err != nil {
				break
			}

			if messageType == websocket.TextMessage {
				var jsonData PublishedMessage

				if err := sonic.Unmarshal(message, &jsonData); err != nil {
					log.Println("unmarshal:", err)
					break
				}

				// Publish to NATS topic
				topic := "server-state." + jsonData.Key

				marshaledPublishMessage, publishMessageMarshalingError := sonic.Marshal(jsonData.Data)

				if publishMessageMarshalingError != nil {
					log.Println("marshal:", publishMessageMarshalingError)
					break
				}

				if err := natsService.NatsConn.Publish(topic, marshaledPublishMessage); err != nil {
					log.Println("publish:", err)
					break
				}
			}
		}
	}))

	port := os.Getenv("WEBSOCKET_PORT")
	if port == "" {
		port = "8081"
	}

	go func() {
		log.Printf("Starting WebSocket server on port %s", port)

		if err := app.Listen(":" + port); err != nil {
			log.Printf("Failed to start WebSocket server: %v", err)
		}
	}()

	return func() error {
		return app.Shutdown()
	}
}

func Boot() func() {
	natsService.ConnectToNATS()

	// Create a context that can be cancelled
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	stopHTTP := startHTTPServer(ctx)
	stopWS := startWSServer(ctx)

	return func() {
		log.Println("Shutting down servers...")

		// Cancel the context to signal all connections to close
		cancel()

		// Give a short time for connections to close gracefully
		time.Sleep(100 * time.Millisecond)

		// Gracefully shutdown the HTTP server
		if err := stopHTTP(); err != nil {
			log.Printf("Error during HTTP server shutdown: %v", err)
		}

		// Gracefully shutdown the WebSocket server
		if err := stopWS(); err != nil {
			log.Printf("Error during WebSocket server shutdown: %v", err)
		}

		// Close NATS connection
		if natsService.NatsConn != nil {
			natsService.NatsConn.Close()
		}

		log.Println("Server shutdown complete")
	}
}

func main() {
	kill := Boot()

	// Set up signal handling for graceful shutdown
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	// Wait for interrupt signal
	<-c

	kill()
}
