package nats

import (
	"os"

	natsGo "github.com/nats-io/nats.go"
)

type ServiceOptions struct {
	url string
}

type Service interface {
	GetNATSConnection() *natsGo.Conn
}

type NATS struct {
	natsConnection *natsGo.Conn
}

func (n *NATS) GetNATSConnection() *natsGo.Conn {
	return n.natsConnection
}

func CreateNATSService(options *ServiceOptions) (*NATS, error) {
	natsURL := options.url

	if natsURL == "" {
		// read from os env
		natsURL = os.Getenv("NATS_URL")
	}

	if natsURL == "" {
		// default NATS URL
		natsURL = "nats://localhost:4222"
	}

	nc, err := natsGo.Connect(natsURL)

	if err != nil {
		return nil, err
	}

	return &NATS{
		natsConnection: nc,
	}, nil
}
