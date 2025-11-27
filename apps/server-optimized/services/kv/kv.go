package kv

import (
	"context"
	"os"

	goRedis "github.com/redis/go-redis/v9"
	"github.com/redis/go-redis/v9/maintnotifications"
	"github.com/rs/zerolog/log"
)

type ServiceOptions struct {
	url string
}

type Service interface {
	GetKVClient() *goRedis.Client
}

type KV struct {
	kvClient *goRedis.Client
}

func (r *KV) GetKVClient() *goRedis.Client {
	return r.kvClient
}

func CreateKVService(options *ServiceOptions) (*KV, error) {
	kvURL := options.url

	if kvURL == "" {
		// read from os env
		kvURL = os.Getenv("KVROCKS_URL")
	}

	if kvURL == "" {
		// default NATS URL
		kvURL = "kv://localhost:6379"
	}

	client := goRedis.NewClient(&goRedis.Options{
		Addr: kvURL,
		MaintNotificationsConfig: &maintnotifications.Config{
			Mode: maintnotifications.ModeDisabled,
		},
		OnConnect: func(ctx context.Context, cn *goRedis.Conn) error {
			log.Info().Msg("connected to redis")
			return nil
		},
	})

	return &KV{
		kvClient: client,
	}, nil
}
