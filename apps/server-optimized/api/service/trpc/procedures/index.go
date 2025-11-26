package procedures

import (
	"context"
	"encoding/json"
	trpc2 "server-optimized/trpc"
	"time"

	"github.com/bytedance/sonic"
)

import trpc "server-optimized/api/service/trpc"

type IndexQueryOutput struct {
	Message string `json:"message"`
	Time    string `json:"time"`
}

func HandleIndexQuery(ctx context.Context, trpcContext *trpc.TRPCContext, input json.RawMessage) (json.RawMessage, *trpc2.TRPCError) {
	output, err := sonic.Marshal(&IndexQueryOutput{
		Message: "Hello from AirState Server's tRPC Handler",
		Time:    time.Now().Format(time.RFC3339),
	})

	if err != nil {
		return nil, &trpc2.TRPCError{
			Code: 500,
		}
	}

	return output, nil
}
