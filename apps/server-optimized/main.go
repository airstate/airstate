package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

func main() {
	http.HandleFunc("/ws", handleWebSocket)
	http.HandleFunc("/", handleHome)

	fmt.Println("JSON Echo WebSocket server starting on :8080")
	fmt.Println("WebSocket endpoint: ws://localhost:8080/ws")
	fmt.Println("API endpoint: http://localhost:8080")

	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleHome(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"message":   "Hello, World!",
		"server":    "JSON Echo WebSocket Server",
		"websocket": "ws://localhost:8080/ws",
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
	}
}

// TRPCResponse represents a TRPC response structure
type TRPCResponse struct {
	ID     interface{} `json:"id"`
	Result TRPCResult  `json:"result"`
}

// TRPCResult represents the result portion of a TRPC response
type TRPCResult struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// TRPCErrorShape represents the structure of a TRPC error
type TRPCErrorShape struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

type TRPCError struct {
	ID    interface{}    `json:"id"`
	Error TRPCErrorShape `json:"error"`
}

func runEchoProcedure(ctx context.Context, conn *websocket.Conn, id uint64, input interface{}) {
	response := TRPCResponse{
		ID: id,
		Result: TRPCResult{
			Type: "data",
			Data: input,
		},
	}

	if err := wsjson.Write(ctx, conn, response); err != nil {
		log.Printf("Failed to send TRPC response: %v", err)
	}
}

func runUppercaseProcedure(ctx context.Context, conn *websocket.Conn, id uint64, input interface{}) {
	// Check if input is a string
	inputStr, ok := input.(string)

	if !ok {
		// If input is not a string, return an error
		response := TRPCError{
			ID: id,
			Error: TRPCErrorShape{
				Code:    -32600,
				Message: "input must be a string",
				Data:    nil,
			},
		}

		if err := wsjson.Write(ctx, conn, response); err != nil {
			log.Printf("Failed to send TRPC error response: %v", err)
		}

		return
	}

	// Convert to uppercase
	uppercaseResult := strings.ToUpper(inputStr)

	response := TRPCResponse{
		ID: id,
		Result: TRPCResult{
			Type: "data",
			Data: uppercaseResult,
		},
	}

	if err := wsjson.Write(ctx, conn, response); err != nil {
		log.Printf("Failed to send TRPC response: %v", err)
	}
}

func routeMethodCall(ctx context.Context, conn *websocket.Conn, id uint64, method string, path string, input interface{}) {
	switch method {
	case "query":
		switch path {
		case "echo.run":
			go runEchoProcedure(ctx, conn, id, input)
		}
	case "mutation":
		switch path {
		case "uppercase":
			go runUppercaseProcedure(ctx, conn, id, input)
		}
	case "subscription":
	}
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Read and print the origin header
	origin := r.Header.Get("Origin")

	if origin != "" {
		log.Printf("Origin header: %s", origin)
	} else {
		log.Printf("No Origin header present")
	}

	// Parse the origin URL to extract hostname
	var originHostname string

	if origin != "" {
		if parsedURL, err := url.Parse(origin); err == nil {
			originHostname = parsedURL.Host
		}
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{originHostname}, // Allow all origins for testing
	})

	if err != nil {
		log.Printf("Failed to accept websocket connection: %v", err)
		return
	}

	ctx, cancel := context.WithCancel(r.Context())
	defer conn.Close(websocket.StatusNormalClosure, "connection closed")
	defer cancel()

	log.Printf("New WebSocket connection from %s", r.RemoteAddr)

	var connectionParams interface{}

	// Check for connectionParams query parameter
	if r.URL.Query().Get("connectionParams") == "1" {
		log.Printf("Connection established with connectionParams=1, waiting for params.")

		messageType, messageBytes, err := conn.Read(r.Context())

		if err != nil {
			log.Printf("Failed to read message: %v", err)
			return
		}

		if messageType != websocket.MessageText {
			log.Printf("message not a text message")
			return
		}

		var connectionParamsMessage interface{}

		if err := json.Unmarshal(messageBytes, &connectionParamsMessage); err != nil {
			log.Printf("failed to unmarshal message")
			return
		}

		// Check if message has method set to "connectionParams"
		if dataMap, ok := connectionParamsMessage.(map[string]interface{}); ok {
			if methodValue, exists := dataMap["method"]; exists {
				if methodString, isString := methodValue.(string); isString && methodString == "connectionParams" {
					if dataValue, exists := dataMap["data"]; exists {
						connectionParams = dataValue
						log.Printf("Connection params received: %v", connectionParams)
					}
				}
			}
		}
	}

	// Handle messages
	for {
		messageType, messageBytes, err := conn.Read(r.Context())

		if err != nil {
			log.Printf("Failed to read message: %v", err)
			break
		}

		switch messageType {
		case websocket.MessageText:
			var clientData interface{}

			if err := json.Unmarshal(messageBytes, &clientData); err != nil {
				continue
			}

			if dataMap, ok := clientData.(map[string]interface{}); ok {
				if methodValue, exists := dataMap["method"]; exists {
					if methodString, isString := methodValue.(string); isString {
						if idValue, exists := dataMap["id"]; exists {
							if idFloat, isFloat := idValue.(float64); isFloat {
								idUint64 := uint64(idFloat)
								log.Printf("Received message with id: %f & method: %s", idFloat, methodString)

								if paramsValue, paramsExists := dataMap["params"]; paramsExists {
									if paramsMap, ok := paramsValue.(map[string]interface{}); ok {
										// run for query / mutation / subscription

										if pathValue, pathExists := paramsMap["path"]; pathExists {
											if pathString, isString := pathValue.(string); isString {

												if inputValue, inputExists := paramsMap["input"]; inputExists {
													routeMethodCall(ctx, conn, idUint64, methodString, pathString, inputValue)
												} else {
													routeMethodCall(ctx, conn, idUint64, methodString, pathString, nil)
												}
											}

											log.Printf("Received message with params: %v", paramsMap)
										}
									} else {
										// run for subscription.stop
									}
								}
							}
						}
					}
				}
			}
		case websocket.MessageBinary:
			log.Printf("binary messages not supported yet")
			continue
		}
	}
}
