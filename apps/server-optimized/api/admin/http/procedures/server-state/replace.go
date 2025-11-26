package server_state

import (
	"context"
	"encoding/json"
	"fmt"
	"server-optimized/lib/kv_scripts"
	"server-optimized/utils"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog/log"

	"server-optimized/services"
)

type ReplaceRequest struct {
	Value interface{} `json:"value"`
}

func ReplaceKey(svc services.Services) fiber.Handler {
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

		var req ReplaceRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}

		ctx := context.Background()

		fullKey := fmt.Sprintf("%s:server-state:%s:state", appID, key)
		counterKey := fmt.Sprintf("%s:update-count", fullKey)

		var valueStr string
		switch v := req.Value.(type) {
		case string:
			valueStr = v
		default:
			jsonBytes, err := json.Marshal(v)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "failed to serialize value",
				})
			}
			valueStr = string(jsonBytes)
		}

		result := scriptMgr.Execute(ctx, "replace", []string{fullKey, counterKey}, valueStr)
		if result.Err() != nil {
			log.Error().Err(result.Err()).Msg("Failed to execute Lua script")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to replace value",
			})
		}

		updateCount, err := result.Int64()
		if err != nil {
			log.Error().Err(err).Msg("Failed to parse update count")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to parse update count",
			})
		}

		valueJSON, err := json.Marshal(req.Value)
		if err != nil {
			log.Error().Err(err).Msg("Failed to marshal event")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to create event",
			})
		}

		subject := fmt.Sprintf("server-state.%s_%s", appID, hashedKey)
		msg := nats.NewMsg(subject)
		msg.Data = valueJSON
		msg.Header.Add("update_count", strconv.FormatInt(updateCount, 10))
		if err := natsConn.PublishMsg(msg); err != nil {
			log.Error().Err(err).Msg("Failed to publish to NATS")
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"message": "value replaced successfully",
		})
	}
}
