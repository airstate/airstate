package procedures

import (
	"context"
	"encoding/json"
	"server-optimized/api/service/trpc"
	trpc2 "server-optimized/trpc"
	"time"

	"github.com/bytedance/sonic"
)

type TickMessage struct {
	Unix int64 `json:"unix"`
}

func HandleSecondsSubscription(ctx context.Context, trpcContext *trpc.TRPCContext, input json.RawMessage, emit func(message json.RawMessage)) *trpc2.TRPCError {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			marshaled, marshalingErr := sonic.Marshal(&TickMessage{
				Unix: time.Now().Unix(),
			})

			if marshalingErr != nil {
				return &trpc2.TRPCError{
					Code: 500,
				}
			}

			emit(marshaled)
		case <-ctx.Done():
			return nil
		}
	}
}
