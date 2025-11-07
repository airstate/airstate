package main

import (
    "fmt"
    "os"
    "strconv"
    "sync"
    "sync/atomic"

    "github.com/nats-io/nats.go"
)

type natsPool struct {
    conns []*nats.Conn
    next  atomic.Uint64
}

func (p *natsPool) getConn() *nats.Conn {
    if len(p.conns) == 0 {
        return nil
    }
    // Start from the next index in round-robin order
    start := int(p.next.Add(1)-1) % len(p.conns)
    // Try up to pool size to find a connected conn; otherwise return the starting one
    for i := 0; i < len(p.conns); i++ {
        idx := (start + i) % len(p.conns)
        c := p.conns[idx]
        if c != nil && c.IsConnected() {
            return c
        }
    }
    return p.conns[start]
}

func (p *natsPool) Publish(subject string, data []byte) error {
    c := p.getConn()
    if c == nil {
        return fmt.Errorf("nats pool: no connections available")
    }
    return c.Publish(subject, data)
}

func (p *natsPool) Subscribe(subject string, handler nats.MsgHandler) (*nats.Subscription, error) {
    c := p.getConn()
    if c == nil {
        return nil, fmt.Errorf("nats pool: no connections available")
    }
    return c.Subscribe(subject, handler)
}

func (p *natsPool) Ready() bool {
    if len(p.conns) == 0 {
        return false
    }
    for _, c := range p.conns {
        if c != nil && c.IsConnected() {
            return true
        }
    }
    return false
}

func (p *natsPool) Close() {
    for _, c := range p.conns {
        if c != nil {
            c.Close()
        }
    }
}

var (
    poolOnce sync.Once
    poolInst *natsPool
    poolErr  error
)

func getNATSPool() (*natsPool, error) {
    poolOnce.Do(func() {
        natsURL := os.Getenv("NATS_URL")
        if natsURL == "" {
            natsURL = "nats://localhost:4222"
        }

        size := 16
        if v := os.Getenv("NATS_POOL_SIZE"); v != "" {
            if n, err := strconv.Atoi(v); err == nil && n > 0 {
                size = n
            }
        }

        conns := make([]*nats.Conn, 0, size)
        for i := 0; i < size; i++ {
            c, err := nats.Connect(
                natsURL,
                nats.MaxReconnects(-1),
            )
            if err != nil {
                // If any connection fails, record error but keep trying others
                // We will still create the pool with whatever is available.
                if poolErr == nil {
                    poolErr = err
                }
                conns = append(conns, nil)
                continue
            }
            conns = append(conns, c)
        }

        poolInst = &natsPool{conns: conns}
    })
    if poolInst == nil {
        if poolErr == nil {
            poolErr = fmt.Errorf("failed to initialize nats pool")
        }
        return nil, poolErr
    }
    return poolInst, nil
}


