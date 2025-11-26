package server_state

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"server-optimized/lib/kv_scripts"
	"server-optimized/utils"
	"strconv"

	"server-optimized/services"

	"github.com/gofiber/fiber/v2"
	"github.com/nats-io/nats.go"
)

type AtomicOpsRequest struct {
	Set    map[string]interface{} `json:"$set,omitempty"`
	Unset  []string               `json:"$unset,omitempty"`
	Inc    map[string]float64     `json:"$inc,omitempty"`
	Concat map[string]interface{} `json:"$concat,omitempty"`
	Push   map[string]interface{} `json:"$push,omitempty"`
}

type AtomicOpsResult struct {
	Success     bool                   `json:"success"`
	Value       map[string]interface{} `json:"value,omitempty"`
	UpdateCount int64                  `json:"update_count,omitempty"`
	Error       string                 `json:"error,omitempty"`
}

func AtomicOps(svc services.Services) fiber.Handler {
	scriptMgr := kv_scripts.GetScriptManager(svc.GetKVClient())
	natsConn := svc.GetNATSConnection()

	return func(c *fiber.Ctx) error {
		appID := c.Params("appId")
		key := c.Params("key")
		hashedKey, err := utils.GenerateHash(key)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to generate key hash",
			})
		}

		if appID == "" || key == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "app-id and key are required",
			})
		}

		var req AtomicOpsRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}

		if req.Set == nil && req.Unset == nil && req.Inc == nil && req.Concat == nil && req.Push == nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "at least one operation ($set, $unset, $inc, $concat, $push) must be provided",
			})
		}

		ctx := context.Background()

		fullKey := fmt.Sprintf("%s:server-state:%s:state", appID, key)
		counterKey := fmt.Sprintf("%s:update-count", fullKey)

		opsJSON, err := json.Marshal(req)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "failed to serialize operations",
			})
		}

		log.Printf("this is full key %v", fullKey)

		result := scriptMgr.Execute(ctx, "atomic_ops", []string{fullKey, counterKey}, string(opsJSON))
		if result.Err() != nil {
			log.Printf("Failed to execute atomic_ops script: %v", result.Err())
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to execute atomic operations",
			})
		}

		resultStr, err := result.Text()
		if err != nil {
			log.Printf("Failed to get script result: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to parse script result",
			})
		}

		var opsResult AtomicOpsResult
		if err := json.Unmarshal([]byte(resultStr), &opsResult); err != nil {
			log.Printf("Failed to unmarshal script result: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to parse script result",
			})
		}

		if !opsResult.Success {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": opsResult.Error,
			})
		}

		if opsResult.Value != nil {
			finalJSON, err := json.Marshal(opsResult.Value)
			if err != nil {
				log.Printf("Failed to marshal merged value for NATS: %v", err)
			} else {
				subject := fmt.Sprintf("server-state.%s_%s", appID, hashedKey)
				msg := nats.NewMsg(subject)
				msg.Data = finalJSON
				msg.Header.Add("update_count", strconv.FormatInt(opsResult.UpdateCount, 10))
				if err := natsConn.PublishMsg(msg); err != nil {
					log.Printf("Failed to publish to NATS: %v", err)
				}
			}
		}
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"message": "atomic operations applied successfully",
			"value":   opsResult.Value,
		})
	}
}
