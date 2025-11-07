package main

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/nats-io/nats.go"
)

var natsConn *nats.Conn

type SSEData struct {
	Time string `json:"time"`
}

func connectToNATS() error {
	natsURL := os.Getenv("NATS_URL")

	if natsURL == "" {
		natsURL = "nats://localhost:4222"
	}

	nc, err := nats.Connect(natsURL)

	if err != nil {
		return err
	}

	natsConn = nc
	log.Printf("Connected to NATS at %s", natsURL)

	return nil
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

		c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
			// Create a channel to receive messages from all subscriptions
			msgChan := make(chan *nats.Msg, 32)
			var subscriptions []*nats.Subscription

			// Subscribe to each key
			for _, key := range keyList {
				sub, err := natsConn.Subscribe("server-state."+key, func(msg *nats.Msg) {
					select {
					case msgChan <- msg:
					default:
						// Channel full, drop message
					}
				})

				if err != nil {
					log.Printf("Error subscribing to key %s: %v", key, err)
					continue
				}

				subscriptions = append(subscriptions, sub)
			}

			// Clean up subscriptions when done
			defer func() {
				for _, sub := range subscriptions {
					sub.Unsubscribe()
				}

				close(msgChan)
			}()

			// Listen for messages and send as SSE events
			for {
				select {
				case msg, ok := <-msgChan:
					if !ok {
						// Channel closed
						return
					}
					// The NATS message data is already JSON, send it directly as SSE
					fmt.Fprintf(w, "data: %s\n\n", string(msg.Data))

					if err := w.Flush(); err != nil {
						// Client disconnected or connection error
						return
					}
				case <-ctx.Done():
					// Server is shutting down
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
		if err := natsConn.Publish(topic, body); err != nil {
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
		// Handle WebSocket connection
		// Use SetReadDeadline to allow periodic context checks
		done := make(chan struct{})

		go func() {
			defer close(done)
			for {
				// Check context first
				select {
				case <-ctx.Done():
					return
				default:
				}

				// Set read deadline to allow periodic context checks
				if err := c.SetReadDeadline(time.Now().Add(time.Second)); err != nil {
					return
				}

				mt, msg, err := c.ReadMessage()
				if err != nil {
					// Check if it's a timeout (expected for context checking)
					// Timeout errors allow us to loop back and check context
					if netErr, ok := err.(interface{ Timeout() bool }); ok && netErr.Timeout() {
						continue
					}
					// Any other error means connection is closed or broken
					return
				}

				// Parse the message as JSON
				var msgData map[string]interface{}
				if err := sonic.Unmarshal(msg, &msgData); err != nil {
					log.Printf("Error unmarshaling WebSocket message: %v", err)
					// Continue processing - don't break the connection
					continue
				}

				// Extract key and data fields
				key, keyOk := msgData["key"].(string)
				data, dataOk := msgData["data"]

				// Validate that both key and data are present
				if !keyOk || key == "" {
					log.Printf("Error: missing or invalid 'key' field in WebSocket message")
					continue
				}

				if !dataOk {
					log.Printf("Error: missing 'data' field in WebSocket message")
					continue
				}

				// Marshal the data field to JSON bytes
				dataBytes, err := sonic.Marshal(data)
				if err != nil {
					log.Printf("Error marshaling data field: %v", err)
					continue
				}

				// Publish to NATS topic
				topic := "server-state." + key
				if err := natsConn.Publish(topic, dataBytes); err != nil {
					log.Printf("Error publishing to NATS topic %s: %v", topic, err)
					// Continue processing - don't break the connection
					continue
				}

				// Echo the message back (basic implementation)
				if err := c.WriteMessage(mt, msg); err != nil {
					return
				}
			}
		}()

		// Wait for either context cancellation or connection closure
		select {
		case <-ctx.Done():
			// Server is shutting down, close the connection
			c.Close()
		case <-done:
			// Connection closed normally
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

func main() {
	connectToNATS()

	// Create a context that can be cancelled
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	stopHTTP := startHTTPServer(ctx)
	stopWS := startWSServer(ctx)

	// Set up signal handling for graceful shutdown
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	// Wait for interrupt signal
	<-c

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
	if natsConn != nil {
		natsConn.Close()
	}

	log.Println("Server shutdown complete")
}
