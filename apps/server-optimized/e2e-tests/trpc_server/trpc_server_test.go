package trpc_server

import (
	"context"
	"os/exec"
	"server-optimized/boot"
	"testing"
	"time"

	"github.com/bytedance/sonic"
	"github.com/rs/zerolog"
)

func init() {
	boot.SetupGlobals()
	zerolog.SetGlobalLevel(zerolog.DebugLevel)
}

func runNodeClientTest(t *testing.T, ctx context.Context, script string) {
	bootErr := boot.Boot(ctx)

	if bootErr != nil {
		t.Fatal(bootErr)
	}

	time.Sleep(1 * time.Second)

	cmd := exec.Command("pnpm", "tsx", "src/"+script)
	cmd.Dir = "./client"

	output, execOutputError := cmd.Output()

	if execOutputError != nil {
		t.Fatal(execOutputError)
	}

	var testOutput map[string]interface{}
	unmarshalErr := sonic.Unmarshal(output, &testOutput)

	if unmarshalErr != nil {
		t.Fatal(unmarshalErr)
	}

	if testOutput["passed"] != true {
		t.Fatalf("error %v", testOutput["error"])
	}
}

func TestTRPCServerSimpleQuery(t *testing.T) {
	runNodeClientTest(t, t.Context(), "test-basic-query.mts")
}

func TestTRPCServerSubscription(t *testing.T) {
	runNodeClientTest(t, t.Context(), "test-subscription.mts")
}

func TestTRPCServerSubscriptionEndByServer(t *testing.T) {
	runNodeClientTest(t, t.Context(), "test-subscription-end-by-server.mts")
}
