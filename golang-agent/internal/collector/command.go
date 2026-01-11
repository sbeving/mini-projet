package collector

import (
	"bufio"
	"context"
	"fmt"
	"os/exec"
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

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cc.mu.Lock()
		cc.errorsCount++
		cc.mu.Unlock()
		return
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		cc.mu.Lock()
		cc.errorsCount++
		cc.mu.Unlock()
		return
	}

	if err := cmd.Start(); err != nil {
		cc.mu.Lock()
		cc.errorsCount++
		cc.mu.Unlock()
		return
	}

	// Process stdout
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			cc.processLine(scanner.Text(), "stdout")
		}
	}()

	// Process stderr
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			cc.processLine(scanner.Text(), "stderr")
		}
	}()

	cmd.Wait()
}

// processLine processes a single output line
func (cc *CommandCollector) processLine(text, stream string) {
	if text == "" {
		return
	}

	level := parseLevel(text)
	if stream == "stderr" && level == "INFO" {
		level = "WARN"
	}

	entry := createLogEntry(
		level,
		text,
		cc.config.Service,
		fmt.Sprintf("command:%s", cc.config.Command),
		map[string]string{
			"stream":  stream,
			"command": cc.config.Command,
		},
	)

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
