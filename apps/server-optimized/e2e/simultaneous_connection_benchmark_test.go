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

func BenchmarkSimultaneousConnections(b *testing.B) {
	kill := main.Boot()
	defer kill()

	time.Sleep(2 * time.Second)

	log.Println("creating ws url")
	wsURL := url.URL{Scheme: "ws", Host: "localhost:8081", Path: "/rpc"}

	wsConnection, _, wsConnectionError := websocket.DefaultDialer.Dial(wsURL.String(), nil)

	if wsConnectionError != nil {
		log.Fatal("dial:", wsConnectionError)
	}

	sendLoop := make(chan interface{}, 1)
	receiveLoop := make(chan interface{}, 1)

	startTime := time.Now().UnixMilli()

	for c := 0; c < b.N; c++ {
		go func() {
			ctx := b.Context()

			req, requestError := http.NewRequestWithContext(ctx, http.MethodGet, "http://localhost:8080/_default/server-state.subscribe-sse?key=test-a", nil)

			if requestError != nil {
				log.Println("request:", requestError)
				b.Fail()
				return
			}

			res, responseError := http.DefaultClient.Do(req)

			if responseError != nil {
				log.Println("response:", responseError)
				b.Fail()
				return
			}

			defer res.Body.Close()

			receiveLoop <- nil
			count := 0

			for _, err := range sse.Read(res.Body, nil) {
				if err != nil {
					log.Println("sse-read:", err)
					b.Fail()
					break
				}

				count = count + 1

				if count == 10 {
					break
				}
			}

			receiveLoop <- nil
		}()
	}

	// wait for receivers to boot
	for n := 0; n < b.N; n++ {
		<-receiveLoop
	}

	log.Println("receivers booted")
	time.Sleep(time.Second * 1)

	b.ResetTimer()

	go func() {
		log.Println("sending...")

		for i := 0; i < 10; i++ {
			message, messageEncodingError := sonic.Marshal(fiber.Map{
				"key": "test-a",
				"data": fiber.Map{
					"message": fmt.Sprintf("HELLO: %d", i),
				},
			})

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

	for n := 0; n < b.N; n++ {
		<-receiveLoop
	}

	endTime := time.Now().UnixMilli()
	duration := endTime - startTime
	println("duration:", duration, "ms", "count:", b.N)

	time.Sleep(2 * time.Second)
	wsConnection.Close()
}
