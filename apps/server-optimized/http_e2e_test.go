package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"syscall"
	"testing"
	"time"

	"github.com/tmaxmax/go-sse"
)

const (
	testPort = "8080"
	testKey  = "test-key"
)

var (
	serverBinary string
	buildOnce    sync.Once
	buildErr     error
)

// TestMain cleans up the test binary after all tests complete
func TestMain(m *testing.M) {
	code := m.Run()
	
	// Clean up test binary
	if serverBinary != "" {
		os.Remove(serverBinary)
	}
	
	os.Exit(code)
}

// buildServer builds the server binary once
func buildServer() (string, error) {
	buildOnce.Do(func() {
		// Create a temporary binary name
		binaryName := "test-server"
		if runtime.GOOS == "windows" {
			binaryName += ".exe"
		}

		// Build in the current directory
		cmd := exec.Command("go", "build", "-o", binaryName, "main.go")
		if err := cmd.Run(); err != nil {
			buildErr = fmt.Errorf("failed to build server: %w", err)
			return
		}

		// Get absolute path to the binary
		absPath, err := filepath.Abs(binaryName)
		if err != nil {
			buildErr = fmt.Errorf("failed to get absolute path: %w", err)
			return
		}

		serverBinary = absPath
	})

	return serverBinary, buildErr
}

// isPortAvailable checks if a port is available
func isPortAvailable(port string) bool {
	ln, err := net.Listen("tcp", ":"+port)
	if err != nil {
		return false
	}
	ln.Close()
	return true
}

// waitForServer waits for the server to be ready by polling the health endpoint
func waitForServer(url string, timeout time.Duration) error {
	client := &http.Client{Timeout: 1 * time.Second}
	deadline := time.Now().Add(timeout)

	for time.Now().Before(deadline) {
		resp, err := client.Get(url + "/health")
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		time.Sleep(100 * time.Millisecond)
	}

	return fmt.Errorf("server did not become ready within %v", timeout)
}

// startServer starts the server binary as a subprocess
func startServer() (*exec.Cmd, error) {
	// Check both HTTP and WebSocket ports (WebSocket port is used in ws_e2e_test.go)
	wsPort := "8081"
	if !isPortAvailable(testPort) {
		return nil, fmt.Errorf("port %s is already in use", testPort)
	}
	if !isPortAvailable(wsPort) {
		return nil, fmt.Errorf("port %s is already in use", wsPort)
	}

	// Build the server binary
	binaryPath, err := buildServer()
	if err != nil {
		return nil, err
	}

	cmd := exec.Command(binaryPath)
	cmd.Env = append(os.Environ(),
		"PORT="+testPort,
		"WEBSOCKET_PORT="+wsPort,
	)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// Set process group ID (Unix only) to enable killing the entire process tree
	if runtime.GOOS != "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Setpgid: true,
		}
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start server: %w", err)
	}

	return cmd, nil
}

// stopServer gracefully stops the server process and all its children
func stopServer(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}

	// Get process group ID before sending signals (Unix only)
	var pgid int
	var hasPGID bool
	if runtime.GOOS != "windows" {
		var err error
		pgid, err = syscall.Getpgid(cmd.Process.Pid)
		if err == nil {
			hasPGID = true
		}
	}

	// Send SIGTERM for graceful shutdown
	if runtime.GOOS == "windows" {
		// On Windows, just kill the process
		cmd.Process.Kill()
	} else {
		// On Unix, kill the entire process group
		if hasPGID {
			// Send SIGTERM to the entire process group
			syscall.Kill(-pgid, syscall.SIGTERM)
		} else {
			// Fallback to killing just the process
			cmd.Process.Signal(syscall.SIGTERM)
		}
	}

	// Wait for process to exit with timeout
	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	select {
	case err := <-done:
		// Process exited, give a small delay to ensure port is released
		time.Sleep(100 * time.Millisecond)
		return err
	case <-time.After(3 * time.Second):
		// Force kill if graceful shutdown doesn't work
		if runtime.GOOS == "windows" {
			cmd.Process.Kill()
		} else {
			// Try to get pgid again in case it changed
			if hasPGID {
				// Kill the entire process group with SIGKILL
				syscall.Kill(-pgid, syscall.SIGKILL)
			} else {
				// Fallback: try to get pgid one more time
				if pgid, err := syscall.Getpgid(cmd.Process.Pid); err == nil {
					syscall.Kill(-pgid, syscall.SIGKILL)
				} else {
					cmd.Process.Kill()
				}
			}
		}
		
		// Wait for the kill to take effect
		select {
		case err := <-done:
			time.Sleep(100 * time.Millisecond)
			return err
		case <-time.After(1 * time.Second):
			// Process still not dead, but we've done our best
			time.Sleep(200 * time.Millisecond)
			return fmt.Errorf("server did not shutdown gracefully, force killed")
		}
	}
}

func TestEndToEndViaHTTP(t *testing.T) {
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

	// Step 4: Publish a message
	testData := map[string]interface{}{
		"message":   "test",
		"timestamp": time.Now().Format(time.RFC3339),
	}
	jsonData, err := json.Marshal(testData)
	if err != nil {
		t.Fatalf("Failed to marshal test data: %v", err)
	}

	publishURL := fmt.Sprintf("%s/_default/server-state.publish?key=%s", serverURL, testKey)
	resp, err := http.Post(publishURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("Failed to publish message: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Unexpected status code: %d", resp.StatusCode)
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
	// - stopServer() will send SIGTERM to the server process
	t.Log("Test completed successfully")
}
