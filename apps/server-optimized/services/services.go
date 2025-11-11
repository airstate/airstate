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
	// NATS
	natsService, natsServiceErr := nats.CreateNATSService(&nats.ServiceOptions{})

	if natsServiceErr != nil {
		return nil, natsServiceErr
	}

	// REDIS
	redisService, redisServiceErr := redis.CreateRedisService(&redis.ServiceOptions{})

	if redisServiceErr != nil {
		return nil, redisServiceErr
	}

	return &ServiceValues{
		*natsService,
		*redisService,
	}, nil
}
