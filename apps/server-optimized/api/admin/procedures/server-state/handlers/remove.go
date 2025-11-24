package handlers

import (
	"context"
	"fmt"
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/nats-io/nats.go"

	"server-optimized/api/admin/procedures/server-state/scripts"
	"server-optimized/api/admin/procedures/server-state/utils"
	"server-optimized/services"
)


func RemoveKey(svc services.Services) fiber.Handler {
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

		ctx := context.Background()

		fullKey := fmt.Sprintf("%s:server-state:%s:state", appID, key)
		counterKey := fmt.Sprintf("%s:update-count", fullKey)

		result := scriptMgr.Execute(ctx, "remove", []string{fullKey, counterKey})
		if result.Err() != nil {
			log.Printf("Failed to execute remove script: %v", result.Err())
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to delete key",
			})
		}

		updateCount, err := result.Int64()
		if err != nil {
			log.Printf("Failed to parse delete result: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to parse delete result",
			})
		}
			subject := fmt.Sprintf("server-state.%s_%s", appID, hashedKey)
			msg := nats.NewMsg(subject)
			msg.Data = []byte("null")
			msg.Header.Add("update_count", strconv.FormatInt(updateCount, 10))

			if err := natsConn.PublishMsg(msg); err != nil {
				log.Printf("Failed to publish to NATS: %v", err)
			}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"message":      "key deleted successfully",
		})
	}
}