package kv_scripts

import (
	"context"
	_ "embed"
	"fmt"
	"sync"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

type ScriptManager struct {
	kvClient *redis.Client
	Replace   Script
	Remove    Script
	DeepMerge Script
	AtomicOps Script
}

type Script struct {
	Name    string
	Content string
	SHA     string
}

var (
	once            sync.Once
	managerInstance *ScriptManager
)

func GetScriptManager(kvClient *redis.Client) *ScriptManager {
	once.Do(func() {
		managerInstance = &ScriptManager{
			kvClient: kvClient,
			Replace: Script{
				Name:    "replace",
				Content: ReplaceScript,
			},
			Remove: Script{
				Name:    "remove",
				Content: RemoveScript,
			},
			DeepMerge: Script{
				Name:    "deep_merge",
				Content: DeepMergeScript,
			},
			AtomicOps: Script{
				Name:    "atomic_ops",
				Content: AtomicOpsScript,
			},
		}

		if err := managerInstance.LoadAll(context.Background()); err != nil {
			log.Fatal().Err(err).Msg("Failed to load Lua kv_scripts")
		}
	})
	return managerInstance
}

func (sm *ScriptManager) LoadAll(ctx context.Context) error {
	scripts := []*Script{&sm.Replace, &sm.Remove, &sm.DeepMerge, &sm.AtomicOps}
	
	for _, script := range scripts {
		sha, err := sm.kvClient.ScriptLoad(ctx, script.Content).Result()
		if err != nil {
			return fmt.Errorf("failed to load script %s: %w", script.Name, err)
		}
		script.SHA = sha
		log.Info().Str("name", script.Name).Str("sha", sha).Msg("Loaded Lua script")
	}
	return nil
}

func (sm *ScriptManager) GetReplace() *Script   { return &sm.Replace }
func (sm *ScriptManager) GetRemove() *Script    { return &sm.Remove }
func (sm *ScriptManager) GetDeepMerge() *Script { return &sm.DeepMerge }
func (sm *ScriptManager) GetAtomicOps() *Script { return &sm.AtomicOps }

func (sm *ScriptManager) ReloadScript(ctx context.Context, script *Script) error {
	sha, err := sm.kvClient.ScriptLoad(ctx, script.Content).Result()
	if err != nil {
		return fmt.Errorf("failed to reload script %s: %w", script.Name, err)
	}
	script.SHA = sha
	log.Info().Str("name", script.Name).Str("sha", sha).Msg("Reloaded Lua script")
	return nil
}

func (sm *ScriptManager) Execute(ctx context.Context, script *Script, keys []string, args ...interface{}) *redis.Cmd {
	result := sm.kvClient.EvalSha(ctx, script.SHA, keys, args...)
	
	if result.Err() != nil && result.Err().Error() == "NOSCRIPT No matching script. Please use EVAL." {
		log.Warn().Str("name", script.Name).Msg("Script not found in Redis, reloading")
		if err := sm.ReloadScript(ctx, script); err != nil {
			return redis.NewCmd(ctx, err)
		}
		result = sm.kvClient.EvalSha(ctx, script.SHA, keys, args...)
	}
	return result
}
