package main

import (
    "bufio"
    "bytes"
    "context"
    "crypto/rand"
    "errors"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "io"
    "math/big"
    "net/http"
    "net/url"
    "os"
    "strconv"
    "strings"
    "sync"
    "sync/atomic"
    "testing"
    "time"

    "github.com/coder/websocket"
)

// readIntEnv fetches an int from env with a default fallback.
func readIntEnv(key string, def int) int {
    if v := os.Getenv(key); v != "" {
        if n, err := strconv.Atoi(v); err == nil {
            return n
        }
    }
    return def
}

// makeKeys generates a stable set of keys like k0..kN-1
func makeKeys(n int) []string {
    out := make([]string, n)
    for i := 0; i < n; i++ {
        out[i] = fmt.Sprintf("k%d", i)
    }
    return out
}

// candidatePayloadSizes returns the set of sizes used for random selection.
func candidatePayloadSizes(maxBytes int, override string) []int {
    if override != "" {
        parts := strings.Split(override, ",")
        sizes := make([]int, 0, len(parts))
        for _, p := range parts {
            p = strings.TrimSpace(p)
            if p == "" {
                continue
            }
            if n, err := strconv.Atoi(p); err == nil && n > 0 && n <= maxBytes {
                sizes = append(sizes, n)
            }
        }
        if len(sizes) > 0 {
            return sizes
        }
    }
    base := []int{16, 128, 1024, 8192, 65536, 262144, 524288}
    sizes := make([]int, 0, len(base))
    for _, s := range base {
        if s <= maxBytes {
            sizes = append(sizes, s)
        }
    }
    if len(sizes) == 0 {
        sizes = []int{16}
    }
    return sizes
}

// makeJSONPayload approximates a JSON message with a base64 string to reach target size.
func makeJSONPayload(target int) json.RawMessage {
    if target < 8 {
        target = 8
    }
    // Estimate overhead of {"p":""}
    overhead := 7
    rawBytes := target - overhead
    if rawBytes < 1 {
        rawBytes = 1
    }
    // Base64 expands by ~4/3; so produce ~3/4 of desired payload.
    b64Input := (rawBytes * 3) / 4
    if b64Input < 1 {
        b64Input = 1
    }
    buf := make([]byte, b64Input)
    _, _ = rand.Read(buf)
    enc := base64.StdEncoding.EncodeToString(buf)
    m := map[string]string{"p": enc}
    data, _ := json.Marshal(m)
    return data
}

func buildPublishFrame(key string, payload json.RawMessage) []byte {
    // {"key":"k","message":<payload>}
    var buf bytes.Buffer
    buf.WriteString(`{"key":"`)
    buf.WriteString(key)
    buf.WriteString(`","message":`)
    buf.Write(payload)
    buf.WriteByte('}')
    return buf.Bytes()
}

func openSSEStream(baseURL string, keys []string) (*http.Response, error) {
    u, _ := url.Parse(baseURL)
    q := u.Query()
    for _, k := range keys {
        q.Add("key", k)
    }
    u.RawQuery = q.Encode()
    req, _ := http.NewRequest(http.MethodGet, u.String(), nil)
    req.Header.Set("Accept", "text/event-stream")
    client := &http.Client{Timeout: 0}
    return client.Do(req)
}

func consumeSSE(ctx context.Context, r io.Reader, onData func()) error {
    // Minimal SSE data: lines starting with "data: ", separate events with blank line.
    br := bufio.NewReader(r)
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
        }
        line, err := br.ReadString('\n')
        if err != nil {
            if errors.Is(err, io.EOF) {
                return nil
            }
            return err
        }
        if strings.HasPrefix(line, "data:") {
            onData()
        }
    }
}

// BenchmarkEndToEndThroughput runs an end-to-end benchmark across WS->NATS->SSE.
func BenchmarkEndToEndThroughput(b *testing.B) {
    // Parameters
    pubClients := readIntEnv("PUB_CLIENTS", 128)
    subClients := readIntEnv("SUB_CLIENTS", 128)
    keysPerSub := readIntEnv("KEYS_PER_SUB", 256)
    msgsPerPub := readIntEnv("MESSAGES_PER_PUB", 100)
    maxPayload := readIntEnv("MAX_PAYLOAD_BYTES", 900000) // below WS 1MiB limit
    payloadOverride := os.Getenv("PAYLOAD_SIZES")
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }
    wsPort := os.Getenv("WEBSOCKET_PORT")
    if wsPort == "" {
        wsPort = "8081"
    }

    sizes := candidatePayloadSizes(maxPayload, payloadOverride)
    keys := makeKeys(keysPerSub)

    stop, err := startServers()
    if err != nil {
        b.Fatalf("failed to start servers: %v", err)
    }
    b.Cleanup(func() {
        if stop != nil {
            _ = stop()
        }
    })

    // Start subscribers
    var delivered int64
    subWG := &sync.WaitGroup{}
    subWG.Add(subClients)
    for i := 0; i < subClients; i++ {
        go func() {
            defer subWG.Done()
            // One stream per client over all keys
            sseURL := fmt.Sprintf("http://127.0.0.1:%s/_default/server-state/subscribe/sse", port)
            resp, err := openSSEStream(sseURL, keys)
            if err != nil {
                return
            }
            defer resp.Body.Close()
            ctx, cancel := context.WithCancel(context.Background())
            defer cancel()
            _ = consumeSSE(ctx, resp.Body, func() {
                atomic.AddInt64(&delivered, 1)
            })
        }()
    }

    // Publishers
    pubWG := &sync.WaitGroup{}
    pubWG.Add(pubClients)

    wsURL := fmt.Sprintf("ws://127.0.0.1:%s/ws/publish", wsPort)

    // Random helper
    pickSize := func() int {
        if len(sizes) == 1 {
            return sizes[0]
        }
        nBig, _ := rand.Int(rand.Reader, big.NewInt(int64(len(sizes))))
        return sizes[int(nBig.Int64())]
    }

    // Start timing just before sending begins
    b.ResetTimer()
    startTime := time.Now()
    var published int64

    for i := 0; i < pubClients; i++ {
        go func(id int) {
            defer pubWG.Done()
            // websocket client
            ctx := context.Background()
            cli, _, err := websocket.Dial(ctx, wsURL, nil)
            if err != nil {
                return
            }
            defer cli.Close(websocket.StatusNormalClosure, "")

            // Send messages
            for j := 0; j < msgsPerPub; j++ {
                key := keys[(id*msgsPerPub+j)%len(keys)]
                sz := pickSize()
                payload := makeJSONPayload(sz)
                frame := buildPublishFrame(key, payload)
                if err := cli.Write(ctx, websocket.MessageText, frame); err != nil {
                    return
                }
                atomic.AddInt64(&published, 1)
            }
        }(i)
    }

    pubWG.Wait()
    // Give subscribers a short drain window
    time.Sleep(500 * time.Millisecond)
    b.StopTimer()

    elapsed := time.Since(startTime).Seconds()
    if elapsed == 0 {
        elapsed = 1
    }
    pubRate := float64(published) / elapsed
    deliv := atomic.LoadInt64(&delivered)
    delivRate := float64(deliv) / elapsed
    ratio := 0.0
    if published > 0 {
        ratio = float64(deliv) / float64(published)
    }

    b.ReportMetric(pubRate, "publish_msgs_per_s")
    b.ReportMetric(delivRate, "deliver_msgs_per_s")
    b.ReportMetric(ratio, "deliver_ratio")

    // Ensure subscribers are cleaned up
    // (they will exit on cleanup via process end)
    _ = subWG
}


