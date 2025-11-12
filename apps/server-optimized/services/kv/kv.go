package kv

import (
	"os"

	goRedis "github.com/redis/go-redis/v9"
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
	})

	return &KV{
		kvClient: client,
	}, nil
}
