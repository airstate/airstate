//go:build mage
// +build mage

package main

import (
	"fmt"
	"os"
	"os/exec"
)

// Default task. Running `mage` will drop you into the server container shell.
var Default = Shell

// Shell drops into an interactive shell inside the server container.
// It prefers `bash` and falls back to `sh` via SHELL env var. It attempts to exec into an
// already running container first, then falls back to `run --rm --service-ports`.
func Shell() error {
	shell := preferredShell()

	// Try to exec into running container by name
	if err := runInteractive("docker", "compose", "exec", "-it", "server", shell); err == nil {
		return nil
	}

	// Fallback: start a one-off container and attach, exposing service ports
	return runInteractive("docker", "compose", "run", "--rm", "--service-ports", "server", shell)
}

func Benchmark() error {
	// Try to exec into running container by name
	if err := runInteractive("docker", "compose", "exec", "-it", "server", "go", "test", "-bench=."); err == nil {
		return nil
	}

	// Fallback: start a one-off container and attach, exposing service ports
	return runInteractive("docker", "compose", "run", "--rm", "--service-ports", "server", "go", "test", "-bench=.")
}

func preferredShell() string {
	return "bash"
}

func runInteractive(name string, args ...string) error {
	fmt.Printf("→ %s %v\n", name, args)
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	return cmd.Run()
}
