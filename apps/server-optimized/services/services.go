package services

import (
	"server-optimized/services/kv"
	"server-optimized/services/nats"
)

type Services interface {
	nats.Service
	kv.Service
}

type ServiceValues struct {
	nats.NATS
	kv.KV
}

func CreateServices() (*ServiceValues, error) {
	// NATS
	natsService, natsServiceErr := nats.CreateNATSService(&nats.ServiceOptions{})

	if natsServiceErr != nil {
		return nil, natsServiceErr
	}

	// KV (KVRocks / KV)
	kvService, kvServiceErr := kv.CreateKVService(&kv.ServiceOptions{})

	if kvServiceErr != nil {
		return nil, kvServiceErr
	}

	return &ServiceValues{
		*natsService,
		*kvService,
	}, nil
}
