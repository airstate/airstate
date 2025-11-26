package trpc

import "encoding/json"

type ConnectionParamsMessage struct {
	Data   map[string]string `json:"data"`
	Method string            `json:"method"`
}

type TRPCMessageParams struct {
	Path  string          `json:"path"`
	Input json.RawMessage `json:"input"`
}

type TRPCMessage struct {
	Id     int64             `json:"id"`
	Method string            `json:"method"`
	Params TRPCMessageParams `json:"params"`
}

type TRPCResultResponse struct {
	Id     int64           `json:"id"`
	Result json.RawMessage `json:"result"`
}

type TRPCError struct {
	Code    int64  `json:"code"`
	Message string `json:"message"`
}

type TRPCErrorResponse struct {
	Id    int64     `json:"id"`
	Error TRPCError `json:"error"`
}
