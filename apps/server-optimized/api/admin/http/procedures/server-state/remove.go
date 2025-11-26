package server_state

import (
	"context"
	"fmt"
	"server-optimized/lib/kv_scripts"
	"server-optimized/utils"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog/log"

	"server-optimized/services"
)

func RemoveKey(svc services.Services) fiber.Handler {
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

		ctx := context.Background()

		fullKey := fmt.Sprintf("%s:server-state:%s:state", appID, key)
		counterKey := fmt.Sprintf("%s:update-count", fullKey)

		result := scriptMgr.Execute(ctx, "remove", []string{fullKey, counterKey})
		if result.Err() != nil {
			log.Error().Err(result.Err()).Msg("Failed to execute remove script")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to delete key",
			})
		}

		updateCount, err := result.Int64()
		if err != nil {
			log.Error().Err(err).Msg("Failed to parse delete result")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to parse delete result",
			})
		}
		subject := fmt.Sprintf("server-state.%s_%s", appID, hashedKey)
		msg := nats.NewMsg(subject)
		msg.Data = []byte("null")
		msg.Header.Add("update_count", strconv.FormatInt(updateCount, 10))

		if err := natsConn.PublishMsg(msg); err != nil {
			log.Error().Err(err).Msg("Failed to publish to NATS")
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"message": "key deleted successfully",
		})
	}
}
