package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"time"

	"github.com/bytedance/sonic"
	"github.com/coder/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/utils"
	"github.com/nats-io/nats.go"
)

var (
	_ = nats.ErrAuthorization
)

// PublishMessage represents a message to be published to NATS
type PublishMessage struct {
	Key     string          `json:"key"`
	Message json.RawMessage `json:"message"`
}

// NATS connection pool is provided by nats_pool.go

// sseHandler handles Server-Sent Events requests
func sseHandler(c *fiber.Ctx) error {
	// Parse multiple 'key' query parameters
	queryArgs := c.Context().QueryArgs()
	var keys []string
	queryArgs.VisitAll(func(key, value []byte) {
		if string(key) == "key" {
			keys = append(keys, string(value))
		}
	})
	if len(keys) == 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": "at least one 'key' query parameter is required",
		})
	}

	// Get NATS pool
	pool, err := getNATSPool()
	if err != nil {
		log.Printf("NATS pool error: %v", err)
		return c.Status(500).JSON(fiber.Map{
			"error": "failed to initialize NATS pool",
		})
	}

	// Set SSE headers
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no") // Disable nginx buffering

	// Create context for cancellation
	ctx, cancel := context.WithCancel(c.Context())
	defer cancel()

	// Channel to forward messages from NATS to SSE
	msgChan := make(chan []byte, 100) // Buffered channel for performance
	errChan := make(chan error, 1)

	// Track subscriptions for cleanup
	var subscriptions []*nats.Subscription
	var subMutex sync.Mutex

	// Subscribe to each key
	for _, key := range keys {
		if key == "" {
			continue
		}

		subject := fmt.Sprintf("server-state.%s", key)

		sub, err := pool.Subscribe(subject, func(msg *nats.Msg) {
			select {
			case msgChan <- msg.Data:
			case <-ctx.Done():
				return
			default:
				// Channel full, skip message (prevents blocking)
			}
		})

		if err != nil {
			log.Printf("Failed to subscribe to %s: %v", subject, err)
			continue
		}

		subMutex.Lock()
		subscriptions = append(subscriptions, sub)
		subMutex.Unlock()
	}

	if len(subscriptions) == 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": "failed to subscribe to any subjects",
		})
	}

	// Cleanup function
	cleanup := func() {
		cancel()
		subMutex.Lock()
		for _, sub := range subscriptions {
			if err := sub.Unsubscribe(); err != nil {
				log.Printf("Error unsubscribing: %v", err)
			}
		}
		subMutex.Unlock()
		close(msgChan)
	}

	// Handle client disconnection
	go func() {
		<-ctx.Done()
		cleanup()
	}()

	// Stream messages to client
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer cleanup()

		// Send initial connection message
		if _, err := w.WriteString(": connected\n\n"); err != nil {
			return
		}
		if err := w.Flush(); err != nil {
			return
		}

		for {
			select {
			case msg, ok := <-msgChan:
				if !ok {
					return
				}

				// Format as SSE: data: {payload}\n\n
				// Escape newlines in payload for SSE format
				escaped := strings.ReplaceAll(utils.UnsafeString(msg), "\n", "\ndata: ")
				if _, err := w.WriteString(fmt.Sprintf("data: %s\n\n", escaped)); err != nil {
					return
				}
				if err := w.Flush(); err != nil {
					return
				}

			case err := <-errChan:
				if err != nil {
					log.Printf("SSE error: %v", err)
					return
				}

			case <-ctx.Done():
				return
			}
		}
	})

	return nil
}

func startWebSocketServer() *http.Server {
	port := os.Getenv("WEBSOCKET_PORT")
	if port == "" {
		port = "8081"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/ws/publish", websocketPublishHandler)

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("WebSocket server error: %v", err)
		}
	}()
	log.Printf("WebSocket server listening on port %s", port)
	return server
}

func websocketPublishHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		CompressionMode: websocket.CompressionDisabled,
	})
	if err != nil {
		log.Printf("WebSocket accept error: %v", err)
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	conn.SetReadLimit(1 << 20) // 1 MiB per message
	readTimeout := 30 * time.Second

	pool, err := getNATSPool()
	if err != nil {
		log.Printf("WebSocket NATS pool error: %v", err)
		conn.Close(websocket.StatusInternalError, "nats unavailable")
		return
	}

	ctx := r.Context()

	for {
		readCtx, cancelRead := context.WithTimeout(ctx, readTimeout)
		msgType, payload, err := conn.Read(readCtx)
		cancelRead()
		if err != nil {
			s := websocket.CloseStatus(err)
			if s == websocket.StatusNormalClosure || s == websocket.StatusGoingAway || errors.Is(err, context.Canceled) {
				return
			}
			if errors.Is(err, context.DeadlineExceeded) {
				continue
			}
			log.Printf("WebSocket read error: %v", err)
			conn.Close(websocket.StatusInternalError, "read error")
			return
		}

		if msgType != websocket.MessageText && msgType != websocket.MessageBinary {
			continue
		}

		var msg PublishMessage
		if err := sonic.Unmarshal(payload, &msg); err != nil {
			if writeErr := conn.Write(ctx, websocket.MessageText, []byte(`{"error":"invalid json"}`)); writeErr != nil {
				log.Printf("WebSocket write error: %v", writeErr)
				return
			}
			continue
		}
		if strings.TrimSpace(msg.Key) == "" {
			if writeErr := conn.Write(ctx, websocket.MessageText, []byte(`{"error":"key is required"}`)); writeErr != nil {
				log.Printf("WebSocket write error: %v", writeErr)
				return
			}
			continue
		}

		subject := fmt.Sprintf("server-state.%s", msg.Key)
		publishPayload := msg.Message
		if len(publishPayload) == 0 {
			publishPayload = []byte("null")
		}

		if err := pool.Publish(subject, publishPayload); err != nil {
			log.Printf("WebSocket publish error: %v", err)
			if writeErr := conn.Write(ctx, websocket.MessageText, []byte(`{"error":"publish failed"}`)); writeErr != nil {
				log.Printf("WebSocket write error: %v", writeErr)
				return
			}
			continue
		}
	}
}

func main() {
	stop, err := startServers()
	if err != nil {
		log.Fatalf("failed to start servers: %v", err)
	}
	defer func() {
		if stop != nil {
			if err := stop(); err != nil {
				log.Printf("shutdown error: %v", err)
			}
		}
	}()

	// Block until interrupt or terminate signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt)
	<-sigCh
}
