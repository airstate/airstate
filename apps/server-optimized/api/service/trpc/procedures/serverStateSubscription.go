package procedures

import (
	"context"
	"encoding/json"
	"server-optimized/api/service/trpc"
	trpc2 "server-optimized/trpc"

	"github.com/bytedance/sonic"
	gonanoid "github.com/matoous/go-nanoid/v2"
	"github.com/rs/zerolog/log"
)

type ServerStateSessionInfoMessage struct {
	Type      string `json:"type"`
	SessionID string `json:"session_id"`
}

type ServerStateInitMessage struct {
	Type string `json:"type"`
}

type ServerStateUpdate struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
}

type ServerStateUpdatesMessage struct {
	Type    string              `json:"type"`
	Updates []ServerStateUpdate `json:"updates"`
}

func HandleServerStateSubscription(ctx context.Context, trpcContext *trpc.TRPCContext, input json.RawMessage, emit func(message json.RawMessage)) *trpc2.TRPCError { 
	
	if trpcContext.Services == nil {
		return &trpc2.TRPCError{
			Code:    500,
			Message: "services not available",
		}
	}

	localStateService := trpcContext.Services.GetLocalState()
	if localStateService == nil {
		return &trpc2.TRPCError{
			Code:    500,
			Message: "local state not available",
		}
	}

	sessionID, err := gonanoid.New()
	if err != nil {
		log.Error().Err(err).Msg("failed to generate session id")
		return &trpc2.TRPCError{
			Code:    500,
			Message: "failed to generate session id",
		}
	}

	session := localStateService.UpsertServerStateSession(sessionID)
	session.Keys = make(map[string]struct{})

	type updatePayload struct {
		Key   string
		Value interface{}
	}

	updatesChan := make(chan updatePayload, 128)

	session.Handler = func(stateKey string, data any) {
		select {
		case <-ctx.Done():
			return
		case updatesChan <- updatePayload{
			Key:   stateKey,
			Value: data,
		}:
		}
	}

	defer func() {
		if session.Subscriptions != nil {
			for subject, sub := range session.Subscriptions {
				if sub != nil {
					log.Debug().Str("sessionId", sessionID).Str("subject", subject).Msg("unsubscribing server-state NATS subscription")
					_ = sub.Unsubscribe()
				}
			}
		}

		localStateService.DeleteSession(sessionID)
		close(updatesChan)
	}()

	sessionInfo := &ServerStateSessionInfoMessage{
		Type:      "session-info",
		SessionID: sessionID,
	}

	sessionInfoJSON, err := sonic.Marshal(sessionInfo)
	if err != nil {
		log.Error().Err(err).Msg("failed to marshal server-state session-info message")
		return &trpc2.TRPCError{
			Code:    500,
			Message: "failed to prepare session info",
		}
	}

	emit(sessionInfoJSON)

	initMsg := &ServerStateInitMessage{
		Type: "init",
	}

	initJSON, err := sonic.Marshal(initMsg)
	if err != nil {
		log.Error().Err(err).Msg("failed to marshal server-state init message")
		return &trpc2.TRPCError{
			Code:    500,
			Message: "failed to prepare init message",
		}
	}

	emit(initJSON)

	for {
		select {
		case <-ctx.Done():
			return nil
		case upd, ok := <-updatesChan:
			if !ok {
				return nil
			}

			msg := &ServerStateUpdatesMessage{
				Type: "updates",
				Updates: []ServerStateUpdate{
					{
						Key:   upd.Key,
						Value: upd.Value,
					},
				},
			}

			marshaled, marshalErr := sonic.Marshal(msg)
			if marshalErr != nil {
				log.Error().Err(marshalErr).Msg("failed to marshal server-state updates message")
				return &trpc2.TRPCError{
					Code:    500,
					Message: "failed to marshal server-state updates",
				}
			}

			emit(marshaled)
		}
	}
}
