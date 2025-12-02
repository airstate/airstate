package services

import (
	"server-optimized/services/kv"
	"server-optimized/services/localstate"
	"server-optimized/services/nats"
)

type Services interface {
	nats.Service
	kv.Service
	localstate.Service
}

type ServiceValues struct {
	nats.NATS
	kv.KV
	*localstate.LocalState
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

	localStateService := localstate.CreateLocalStateService()

	return &ServiceValues{
		NATS:       *natsService,
		KV:         *kvService,
		LocalState: localStateService,
	}, nil
}
