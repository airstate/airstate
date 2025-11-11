package redis

import (
	"os"

	goRedis "github.com/redis/go-redis/v9"
)

type ServiceOptions struct {
	url string
}

type Service interface {
	GetRedisClient() *goRedis.Client
}

type Redis struct {
	redisClient *goRedis.Client
}

func (r *Redis) GetRedisClient() *goRedis.Client {
	return r.redisClient
}

func CreateRedisService(options *ServiceOptions) (*Redis, error) {
	redisURL := options.url

	if redisURL == "" {
		// read from os env
		redisURL = os.Getenv("KVROCKS_URL")
	}

	if redisURL == "" {
		// default NATS URL
		redisURL = "redis://localhost:6379"
	}

	client := goRedis.NewClient(&goRedis.Options{
		Addr: redisURL,
	})

	return &Redis{
		redisClient: client,
	}, nil
}
