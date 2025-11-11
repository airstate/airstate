package e2e

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"server-optimized"
	"testing"
	"time"

	"github.com/bytedance/sonic"
	"github.com/fasthttp/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/tmaxmax/go-sse"
)

func BenchmarkWebSocketThroughput(b *testing.B) {
	kill := main.Boot()
	defer kill()

	time.Sleep(2 * time.Second)

	log.Println("creating ws url")
	wsURL := url.URL{Scheme: "ws", Host: "localhost:8081", Path: "/rpc"}

	wsConnection, _, wsConnectionError := websocket.DefaultDialer.Dial(wsURL.String(), nil)

	if wsConnectionError != nil {
		log.Fatal("dial:", wsConnectionError)
	}

	ctx := b.Context()

	log.Println("creating sse request")
	req, requestError := http.NewRequestWithContext(ctx, http.MethodGet, "http://localhost:8080/_default/server-state.subscribe-sse?key=test-a", nil)

	if requestError != nil {
		log.Println("request:", requestError)
		b.Fail()
		return
	}

	log.Println("sending sse request")
	res, responseError := http.DefaultClient.Do(req)

	if responseError != nil {
		log.Println("response:", responseError)
		b.Fail()
		return
	}

	defer res.Body.Close()

	sendLoop := make(chan interface{}, 1)
	receiveLoop := make(chan interface{}, 1)

	startTime := time.Now().UnixMilli()
	b.ResetTimer()

	go func() {
		log.Println("receiving...")
		count := 0

		for _, err := range sse.Read(res.Body, nil) {
			if err != nil {
				log.Println("sse-read:", err)
				b.Fail()
				break
			}

			count = count + 1

			if count == b.N {
				b.Log("received", count, "messages")
				break
			}
		}

		receiveLoop <- nil
	}()

	go func() {
		log.Println("sending...")

		i := 0

		for b.Loop() {
			message, messageEncodingError := sonic.Marshal(fiber.Map{
				"key": "test-a",
				"data": fiber.Map{
					"message": fmt.Sprintf("HELLO: %d", i),
				},
			})

			i++

			if messageEncodingError != nil {
				log.Println("encode:", messageEncodingError)
				return
			}

			err := wsConnection.WriteMessage(websocket.TextMessage, message)

			if err != nil {
				log.Println("write:", err)
				b.Fail()
				break
			}
		}

		sendLoop <- nil
	}()

	<-sendLoop
	<-receiveLoop

	endTime := time.Now().UnixMilli()
	duration := endTime - startTime
	println("duration:", duration, "ms", "count:", b.N)

	time.Sleep(2 * time.Second)
	wsConnection.Close()
}
