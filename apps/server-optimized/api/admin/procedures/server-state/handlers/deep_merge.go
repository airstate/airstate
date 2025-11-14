package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/nats-io/nats.go"

	"server-optimized/api/admin/procedures/server-state/scripts"
	"server-optimized/api/admin/procedures/server-state/utils"
	"server-optimized/services"
)

type DeepMergeRequest struct {
	Value interface{} `json:"value"`
}

func DeepMergeKey(svc services.Services) fiber.Handler {
	scriptMgr := scripts.GetScriptManager(svc.GetKVClient())
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

		var req DeepMergeRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}

		ctx := context.Background()

		fullKey := fmt.Sprintf("%s:server-state:%s:state", appID, key)
		counterKey := fmt.Sprintf("%s:update-count", fullKey)

		valueJSON, err := json.Marshal(req.Value)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "failed to serialize value",
			})
		}
		result := scriptMgr.Execute(ctx, "deep_merge", []string{fullKey, counterKey}, string(valueJSON))
		if result.Err() != nil {
			log.Printf("Failed to execute deep_merge script: %v", result.Err())
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to merge value",
			})
		}
		
		
		resultSlice, err := result.Slice()
		if err != nil {
			log.Printf("Failed to parse script result: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to parse script result",
			})
		}
		
		if len(resultSlice) != 2 {
			log.Printf("Unexpected script result length: %d", len(resultSlice))
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "unexpected script result",
			})
		}
		
		updateCount, ok := resultSlice[0].(int64)
		if !ok {
			log.Printf("Failed to parse update count from result")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to parse update count",
			})
		}
		
		finalValueStr, ok := resultSlice[1].(string)
		if !ok {
			log.Printf("Failed to parse merged value from result")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to parse merged value",
			})
		}
	
		var finalValue interface{}
		if err := json.Unmarshal([]byte(finalValueStr), &finalValue); err != nil {
			finalValue = finalValueStr
		}

		finalValueJSON, err := json.Marshal(finalValue)
		if err != nil {
			log.Printf("Failed to marshal deep_merge event: %v", err)
		} else {
			subject := fmt.Sprintf("server-state.%s_%s", appID, hashedKey)
				msg := nats.NewMsg(subject)
				msg.Data = finalValueJSON
				msg.Header.Add("update_count", strconv.FormatInt(updateCount, 10))
				
				if err := natsConn.PublishMsg(msg); err != nil {
					log.Printf("Failed to publish to NATS: %v", err)
				}
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"message":      "value merged successfully",
			"value":        finalValue,
		})
	}
}