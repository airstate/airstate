package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/tmaxmax/go-sse"
	"golang.org/x/net/websocket"
)

const (
	testWSPort = "8081"
)

func TestEndToEndViaWebSocket(t *testing.T) {
	// Step 1: Start the server
	serverCmd, err := startServer()
	if err != nil {
		t.Fatalf("Failed to start server: %v", err)
	}
	defer func() {
		if err := stopServer(serverCmd); err != nil {
			t.Logf("Error stopping server: %v", err)
		}
	}()

	// Step 2: Wait for server to be ready
	serverURL := "http://localhost:" + testPort
	if err := waitForServer(serverURL, 10*time.Second); err != nil {
		t.Fatalf("Server did not become ready: %v", err)
	}

	// Step 3: Subscribe to SSE
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel() // This will cancel the request context and close the SSE connection

	sseURL := fmt.Sprintf("%s/_default/server-state.subscribe-sse?key=%s", serverURL, testKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sseURL, nil)
	if err != nil {
		t.Fatalf("Failed to create SSE request: %v", err)
	}

	client := sse.DefaultClient
	conn := client.NewConnection(req)

	events := make(chan sse.Event, 10)
	errChan := make(chan error, 1)

	// Subscribe to all events
	conn.SubscribeToAll(func(event sse.Event) {
		select {
		case events <- event:
		default:
			// Channel full, drop event
		}
	})

	// Start connection in goroutine
	// The connection will close when the context is canceled (via defer cancel())
	go func() {
		if err := conn.Connect(); err != nil && ctx.Err() == nil {
			// Only report error if context wasn't canceled (which is expected during cleanup)
			errChan <- err
		}
	}()

	// Give SSE subscription a moment to establish
	time.Sleep(500 * time.Millisecond)

	// Step 4: Publish a message via WebSocket
	testData := map[string]interface{}{
		"message":   "test",
		"timestamp": time.Now().Format(time.RFC3339),
	}

	wsURL := fmt.Sprintf("ws://localhost:%s/rpc", testWSPort)
	ws, err := websocket.Dial(wsURL, "", "http://localhost/")
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket: %v", err)
	}
	defer ws.Close()

	// Create the WebSocket message format: {"key": "...", "data": {...}}
	wsMessage := map[string]interface{}{
		"key":  testKey,
		"data": testData,
	}

	jsonData, err := json.Marshal(wsMessage)
	if err != nil {
		t.Fatalf("Failed to marshal WebSocket message: %v", err)
	}

	if _, err := ws.Write(jsonData); err != nil {
		t.Fatalf("Failed to send WebSocket message: %v", err)
	}

	// Step 5: Verify the received event matches the published data
	select {
	case event := <-events:
		// Compare received data with published data
		var receivedData map[string]interface{}
		if err := json.Unmarshal([]byte(event.Data), &receivedData); err != nil {
			t.Fatalf("Failed to unmarshal received event data: %v", err)
		}

		if receivedData["message"] != testData["message"] {
			t.Fatalf("Message mismatch: expected %v, got %v", testData["message"], receivedData["message"])
		}

		t.Logf("Successfully received matching event: %s", event.Data)

	case err := <-errChan:
		t.Fatalf("SSE subscription error: %v", err)

	case <-ctx.Done():
		t.Fatal("Timeout waiting for SSE event")
	}

	// Step 6: Cleanup is handled by defer statements:
	// - cancel() will close the SSE connection
	// - ws.Close() will close the WebSocket connection
	// - stopServer() will send SIGTERM to the server process
	t.Log("Test completed successfully")
}
