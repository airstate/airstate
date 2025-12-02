package procedures

import (
	"context"
	"encoding/json"
	"fmt"
	"server-optimized/api/service/trpc"
	trpc2 "server-optimized/trpc"
	"server-optimized/utils"
	"strings"

	"github.com/bytedance/sonic"
	"github.com/nats-io/nats.go"
	goRedis "github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

type serverStateWatchKeysInput struct {
	AppID     string   `json:"appId"`
	SessionID string   `json:"sessionId"`
	Keys      []string `json:"keys"`
}

type serverStateWatchKeysResult struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
}

func HandleServerStateWatchKeysMutation(ctx context.Context, trpcContext *trpc.TRPCContext, input json.RawMessage) (json.RawMessage, *trpc2.TRPCError) { 
	if trpcContext.Services == nil {
		return nil, &trpc2.TRPCError{
			Code:    500,
			Message: "services not available",
		}
	}

	var parsedInput serverStateWatchKeysInput

	if len(input) == 0 {
		return nil, &trpc2.TRPCError{
			Code:    400,
			Message: "input is required",
		}
	}

	if err := sonic.Unmarshal(input, &parsedInput); err != nil {
		return nil, &trpc2.TRPCError{
			Code:    400,
			Message: "invalid input",
		}
	}

	appID := strings.TrimSpace(parsedInput.AppID)
	if appID == "" {
		return nil, &trpc2.TRPCError{
			Code:    400,
			Message: "appId is required",
		}
	}

	sessionID := strings.TrimSpace(parsedInput.SessionID)
	if sessionID == "" {
		return nil, &trpc2.TRPCError{
			Code:    400,
			Message: "sessionId is required",
		}
	}

	if len(parsedInput.Keys) == 0 {
		return nil, &trpc2.TRPCError{
			Code:    400,
			Message: "at least one key is required",
		}
	}

	localStateService := trpcContext.Services.GetLocalState()
	if localStateService == nil {
		return nil, &trpc2.TRPCError{
			Code:    500,
			Message: "local state not available",
		}
	}

	session, ok := localStateService.GetSession(sessionID)
	if !ok {
		return nil, &trpc2.TRPCError{
			Code:    404,
			Message: "session not found",
		}
	}

	if session.Subscriptions == nil {
		session.Subscriptions = make(map[string]*nats.Subscription)
	}

	natsConn := trpcContext.Services.GetNATSConnection()
	if natsConn == nil {
		return nil, &trpc2.TRPCError{
			Code:    500,
			Message: "nats connection not available",
		}
	}

	kvClient := trpcContext.Services.GetKVClient()
	if kvClient == nil {
		return nil, &trpc2.TRPCError{
			Code:    500,
			Message: "kv client not available",
		}
	}

	keys := parsedInput.Keys
	if len(keys) == 0 {
		return nil, &trpc2.TRPCError{
			Code:    400,
			Message: "no valid keys provided",
		}
	}

	resultMap := make(map[string]serverStateWatchKeysResult, len(keys))

	for _, key := range keys {
		hashedKey, err := utils.GenerateHash(key)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("failed to generate hash for server-state key")
			return nil, &trpc2.TRPCError{
				Code:    500,
				Message: "failed to prepare key subscription",
			}
		}

		subject := fmt.Sprintf("server-state.%s_%s", appID, hashedKey)

		if _, exists := session.Subscriptions[subject]; !exists {
			keyCopy := key
			subjectCopy := subject

			subscription, err := natsConn.Subscribe(subjectCopy, func(msg *nats.Msg) {
				select {
				case <-ctx.Done():
					return
				default:
				}

				var value interface{}
				if len(msg.Data) == 0 || string(msg.Data) == "null" {
					value = nil
				} else if err := json.Unmarshal(msg.Data, &value); err != nil {
					log.Error().Err(err).Str("subject", subjectCopy).Msg("failed to unmarshal nats message for server-state")
					return
				}

				if session.Handler != nil {
					session.Handler(keyCopy, value)
				}
			})

			if err != nil {
				log.Error().Err(err).Str("subject", subjectCopy).Msg("failed to subscribe to nats subject for server-state")
				return nil, &trpc2.TRPCError{
					Code:    500,
					Message: fmt.Sprintf("failed to subscribe to key %s", key),
				}
			}

			session.Subscriptions[subjectCopy] = subscription
		}

		if session.Keys == nil {
			session.Keys = make(map[string]struct{})
		}

		session.Keys[key] = struct{}{}

		fullKey := fmt.Sprintf("%s:server-state:%s:state", appID, key)

		rawValue, err := kvClient.Get(ctx, fullKey).Result()
		if err != nil && err != goRedis.Nil {
			log.Error().Err(err).Str("key", fullKey).Msg("failed to get initial server-state value from kv")
			return nil, &trpc2.TRPCError{
				Code:    500,
				Message: "failed to read initial state from kv",
			}
		}

		var value interface{}
		if err == goRedis.Nil || rawValue == "" || rawValue == "null" {
			value = nil
		} else if unmarshalErr := json.Unmarshal([]byte(rawValue), &value); unmarshalErr != nil {
			log.Error().Err(unmarshalErr).Str("key", fullKey).Msg("failed to unmarshal initial server-state value from kv")
			return nil, &trpc2.TRPCError{
				Code:    500,
				Message: "failed to parse initial state from kv",
			}
		}

		if session.Handler != nil {
			session.Handler(key, value)
		}

		resultMap[key] = serverStateWatchKeysResult{
			Key:   key,
			Value: value,
		}
	}

	output, err := sonic.Marshal(resultMap)
	if err != nil {
		return nil, &trpc2.TRPCError{
			Code:    500,
			Message: "failed to marshal watch-keys result",
		}
	}

	return output, nil
}

