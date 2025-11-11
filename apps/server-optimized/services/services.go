package services

import (
	"server-optimized/services/nats"
	"server-optimized/services/redis"
)

type Services interface {
	nats.Service
	redis.Service
}

type ServiceValues struct {
	nats.NATS
	redis.Redis
}

func CreateServices() (*ServiceValues, error) {
	natsService, _ := nats.CreateNATSService(&nats.ServiceOptions{})
	redisService, _ := redis.CreateRedisService(&redis.ServiceOptions{})

	return &ServiceValues{
		*natsService,
		*redisService,
	}, nil
}
