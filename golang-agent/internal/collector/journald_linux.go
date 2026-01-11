//go:build linux
// +build linux

package collector

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"sync"
	"time"

	"logchat/agent/internal/config"
	"logchat/agent/internal/sender"
)

// JournaldCollector collects logs from systemd journal
type JournaldCollector struct {
	BaseCollector
	mu sync.RWMutex

	config config.JournaldCollectorConfig
	cmd    *exec.Cmd
}

// NewJournaldCollector creates a new journald collector
func NewJournaldCollector(cfg config.JournaldCollectorConfig, snd *sender.Sender) *JournaldCollector {
	return &JournaldCollector{
		BaseCollector: BaseCollector{
			name:   "journald",
			sender: snd,
		},
		config: cfg,
	}
}

// Name returns the collector name
func (jc *JournaldCollector) Name() string {
	return jc.name
}

// Start starts the journald collector
func (jc *JournaldCollector) Start(ctx context.Context) {
	jc.mu.Lock()
	jc.running = true
	jc.mu.Unlock()

	fmt.Printf("  [journald] Starting systemd journal collector\n")

	// Build journalctl command
	args := []string{
		"--follow",
		"--output=json",
		"--no-pager",
	}

	// Add since parameter
	if jc.config.Since != "" {
		args = append(args, fmt.Sprintf("--since=%s", jc.config.Since))
	} else {
		args = append(args, "--since=now")
	}

	// Add priority filter
	if jc.config.Priority > 0 && jc.config.Priority <= 7 {
		args = append(args, fmt.Sprintf("--priority=%d", jc.config.Priority))
	}

	// Add specific units
	for _, unit := range jc.config.Units {
		args = append(args, fmt.Sprintf("--unit=%s", unit))
	}

	jc.cmd = exec.CommandContext(ctx, "journalctl", args...)

	stdout, err := jc.cmd.StdoutPipe()
	if err != nil {
		fmt.Printf("  [journald] Error creating pipe: %v\n", err)
		return
	}

	if err := jc.cmd.Start(); err != nil {
		fmt.Printf("  [journald] Error starting journalctl: %v\n", err)
		return
	}

	scanner := bufio.NewScanner(stdout)
	// Increase buffer size for long log lines
	buf := make([]byte, 0, 1024*1024)
	scanner.Buffer(buf, 1024*1024)

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			jc.Stop()
			return
		default:
			jc.processLine(scanner.Text())
		}
	}

	if err := scanner.Err(); err != nil {
		fmt.Printf("  [journald] Scanner error: %v\n", err)
	}
}

// Stop stops the journald collector
func (jc *JournaldCollector) Stop() {
	jc.mu.Lock()
	jc.running = false
	if jc.cmd != nil && jc.cmd.Process != nil {
		jc.cmd.Process.Kill()
	}
	jc.mu.Unlock()
}

// Stats returns collector statistics
func (jc *JournaldCollector) Stats() map[string]any {
	jc.mu.RLock()
	defer jc.mu.RUnlock()

	return map[string]any{
		"name":           jc.name,
		"logs_collected": jc.logsCollected,
		"errors_count":   jc.errorsCount,
		"last_collected": jc.lastCollected,
		"running":        jc.running,
		"units":          jc.config.Units,
	}
}

// JournaldEntry represents a journald JSON entry
type JournaldEntry struct {
	Timestamp        int64  `json:"__REALTIME_TIMESTAMP,string"`
	Message          string `json:"MESSAGE"`
	Priority         string `json:"PRIORITY"`
	SyslogIdentifier string `json:"SYSLOG_IDENTIFIER"`
	Unit             string `json:"_SYSTEMD_UNIT"`
	Hostname         string `json:"_HOSTNAME"`
	PID              string `json:"_PID"`
	UID              string `json:"_UID"`
	GID              string `json:"_GID"`
	Comm             string `json:"_COMM"`
	Exe              string `json:"_EXE"`
	CmdLine          string `json:"_CMDLINE"`
	SystemdSlice     string `json:"_SYSTEMD_SLICE"`
	SystemdCGroup    string `json:"_SYSTEMD_CGROUP"`
	MachineID        string `json:"_MACHINE_ID"`
	BootID           string `json:"_BOOT_ID"`
	Transport        string `json:"_TRANSPORT"`
	Cursor           string `json:"__CURSOR"`
}

// processLine processes a single journald JSON line
func (jc *JournaldCollector) processLine(text string) {
	if text == "" {
		return
	}

	var jEntry JournaldEntry
	if err := json.Unmarshal([]byte(text), &jEntry); err != nil {
		// Try to send as plain text
		entry := createLogEntry(
			"INFO",
			text,
			jc.config.Service,
			"journald",
			nil,
		)
		jc.sender.Send(entry)
		return
	}

	// Convert priority to level
	level := priorityToLevel(jEntry.Priority)

	// Build service name
	service := jc.config.Service
	if service == "" {
		if jEntry.Unit != "" {
			service = jEntry.Unit
		} else if jEntry.SyslogIdentifier != "" {
			service = jEntry.SyslogIdentifier
		} else {
			service = "journald"
		}
	}

	// Convert timestamp
	var ts time.Time
	if jEntry.Timestamp > 0 {
		ts = time.Unix(0, jEntry.Timestamp*1000) // Convert microseconds to nanoseconds
	} else {
		ts = time.Now()
	}

	entry := createLogEntry(
		level,
		jEntry.Message,
		service,
		"journald",
		map[string]string{
			"unit":       jEntry.Unit,
			"identifier": jEntry.SyslogIdentifier,
			"hostname":   jEntry.Hostname,
			"pid":        jEntry.PID,
		},
	)
	entry.Timestamp = ts

	// Add metadata
	entry.Metadata = map[string]any{
		"comm":          jEntry.Comm,
		"exe":           jEntry.Exe,
		"uid":           jEntry.UID,
		"gid":           jEntry.GID,
		"transport":     jEntry.Transport,
		"systemd_slice": jEntry.SystemdSlice,
	}

	if err := jc.sender.Send(entry); err != nil {
		jc.mu.Lock()
		jc.errorsCount++
		jc.mu.Unlock()
		return
	}

	jc.mu.Lock()
	jc.logsCollected++
	jc.lastCollected = time.Now()
	jc.mu.Unlock()
}

// priorityToLevel converts syslog priority to log level
func priorityToLevel(priority string) string {
	switch priority {
	case "0": // Emergency
		return "FATAL"
	case "1": // Alert
		return "FATAL"
	case "2": // Critical
		return "FATAL"
	case "3": // Error
		return "ERROR"
	case "4": // Warning
		return "WARN"
	case "5": // Notice
		return "INFO"
	case "6": // Informational
		return "INFO"
	case "7": // Debug
		return "DEBUG"
	default:
		return "INFO"
	}
}

// InitializeLinux adds Linux-specific collectors
func InitializeLinux(cfg config.CollectorsConfig, snd *sender.Sender) []Collector {
	var collectors []Collector

	// Add journald collector
	if cfg.Journald != nil && cfg.Journald.Enabled {
		collectors = append(collectors, NewJournaldCollector(*cfg.Journald, snd))
	}

	// Add syslog collector
	if cfg.Syslog != nil && cfg.Syslog.Enabled {
		collectors = append(collectors, NewSyslogCollector(*cfg.Syslog, snd))
	}

	return collectors
}
