package utils

import (
	"encoding/hex"

	"golang.org/x/crypto/blake2b"
)


func GenerateHash(key string) (string, error) {
	h, err := blake2b.New(32, nil)
	if err != nil {
		return "", err
	}
	h.Write([]byte(key))
	sum := h.Sum(nil)
	return hex.EncodeToString(sum), nil
}
