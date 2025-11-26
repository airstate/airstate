package kv_scripts

import (
	"context"
	_ "embed"
	"fmt"
	"log"
	"sync"

	"github.com/redis/go-redis/v9"
)

type ScriptManager struct {
	kvClient *redis.Client
	scripts  map[string]*Script
	mu       sync.RWMutex
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
			scripts:  make(map[string]*Script),
		}
		managerInstance.registerScript("replace", ReplaceScript)
		managerInstance.registerScript("remove", RemoveScript)
		managerInstance.registerScript("deep_merge", DeepMergeScript)
		managerInstance.registerScript("atomic_ops", AtomicOpsScript)

		if err := managerInstance.LoadAll(context.Background()); err != nil {
			log.Fatalf("Failed to load Lua kv_scripts: %v", err)
		}
	})

	return managerInstance
}

func (sm *ScriptManager) registerScript(name, content string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.scripts[name] = &Script{
		Name:    name,
		Content: content,
	}
}

func (sm *ScriptManager) LoadAll(ctx context.Context) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	for name, script := range sm.scripts {
		sha, err := sm.kvClient.ScriptLoad(ctx, script.Content).Result()
		if err != nil {
			return fmt.Errorf("failed to load script %s: %w", name, err)
		}
		script.SHA = sha
		log.Printf("Loaded Lua script '%s' with SHA: %s", name, sha)
	}

	return nil
}

func (sm *ScriptManager) GetScriptSHA(name string) string {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	if script, exists := sm.scripts[name]; exists {
		return script.SHA
	}
	return ""
}

func (sm *ScriptManager) GetScript(name string) *Script {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	return sm.scripts[name]
}

func (sm *ScriptManager) ReloadScript(ctx context.Context, name string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	script, exists := sm.scripts[name]
	if !exists {
		return fmt.Errorf("script %s not found", name)
	}

	sha, err := sm.kvClient.ScriptLoad(ctx, script.Content).Result()
	if err != nil {
		return fmt.Errorf("failed to reload script %s: %w", name, err)
	}

	script.SHA = sha
	log.Printf("Reloaded Lua script '%s' with SHA: %s", name, sha)
	return nil
}

func (sm *ScriptManager) Execute(ctx context.Context, name string, keys []string, args ...interface{}) *redis.Cmd {
	script := sm.GetScript(name)
	if script == nil {
		return redis.NewCmd(ctx, fmt.Errorf("script %s not found", name))
	}

	result := sm.kvClient.EvalSha(ctx, script.SHA, keys, args...)

	if result.Err() != nil && result.Err().Error() == "NOSCRIPT No matching script. Please use EVAL." {
		log.Printf("Script %s not found in Redis, reloading...", name)
		if err := sm.ReloadScript(ctx, name); err != nil {
			return redis.NewCmd(ctx, err)
		}
		result = sm.kvClient.EvalSha(ctx, script.SHA, keys, args...)
	}

	return result
}
