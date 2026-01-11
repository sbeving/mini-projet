package collector

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"

	"logchat/agent/internal/config"
	"logchat/agent/internal/sender"
)

// CommandCollector executes commands and collects output
type CommandCollector struct {
	BaseCollector
	mu sync.RWMutex

	config config.CommandCollectorConfig
}

// NewCommandCollector creates a new command collector
func NewCommandCollector(cfg config.CommandCollectorConfig, snd *sender.Sender) *CommandCollector {
	return &CommandCollector{
		BaseCollector: BaseCollector{
			name:   fmt.Sprintf("cmd:%s", cfg.Service),
			sender: snd,
		},
		config: cfg,
	}
}

// Name returns the collector name
func (cc *CommandCollector) Name() string {
	return cc.name
}

// Start starts the command collector
func (cc *CommandCollector) Start(ctx context.Context) {
	cc.mu.Lock()
	cc.running = true
	cc.mu.Unlock()

	interval := cc.config.Interval
	if interval == 0 {
		interval = 60 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Run immediately
	cc.runCommand(ctx)

	for {
		select {
		case <-ctx.Done():
			cc.mu.Lock()
			cc.running = false
			cc.mu.Unlock()
			return

		case <-ticker.C:
			cc.runCommand(ctx)
		}
	}
}

// Stop stops the command collector
func (cc *CommandCollector) Stop() {
	cc.mu.Lock()
	cc.running = false
	cc.mu.Unlock()
}

// Stats returns collector statistics
func (cc *CommandCollector) Stats() map[string]any {
	cc.mu.RLock()
	defer cc.mu.RUnlock()

	return map[string]any{
		"name":           cc.name,
		"logs_collected": cc.logsCollected,
		"errors_count":   cc.errorsCount,
		"last_collected": cc.lastCollected,
		"running":        cc.running,
		"command":        cc.config.Command,
	}
}

// runCommand executes the command and processes output
func (cc *CommandCollector) runCommand(ctx context.Context) {
	timeout := cc.config.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	cmdCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(cmdCtx, cc.config.Command, cc.config.Args...)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	// Process stdout as a single log entry
	if stdout.Len() > 0 {
		output := strings.TrimSpace(stdout.String())
		if output != "" {
			cc.processOutput(output, "stdout", err == nil)
		}
	}

	// Process stderr as a single log entry (if any)
	if stderr.Len() > 0 {
		output := strings.TrimSpace(stderr.String())
		if output != "" {
			cc.processOutput(output, "stderr", false)
		}
	}

	if err != nil {
		cc.mu.Lock()
		cc.errorsCount++
		cc.mu.Unlock()
	}
}

// processOutput processes the complete command output as a single log entry
func (cc *CommandCollector) processOutput(text, stream string, success bool) {
	if text == "" {
		return
	}

	level := "INFO"
	if stream == "stderr" || !success {
		level = "ERROR"
	}

	entry := createLogEntry(
		level,
		text,
		cc.config.Service,
		fmt.Sprintf("command:%s", cc.config.Command),
		map[string]string{
			"command": cc.config.Command,
			"stream":  stream,
		},
	)

	entry.Metadata = map[string]any{
		"command": cc.config.Command,
		"args":    cc.config.Args,
		"stream":  stream,
		"success": success,
	}

	if err := cc.sender.Send(entry); err != nil {
		cc.mu.Lock()
		cc.errorsCount++
		cc.mu.Unlock()
		return
	}

	cc.mu.Lock()
	cc.logsCollected++
	cc.lastCollected = time.Now()
	cc.mu.Unlock()
}
