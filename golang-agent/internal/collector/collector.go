package collector

import (
	"context"
	"time"

	"logchat/agent/internal/buffer"
	"logchat/agent/internal/sender"
)

// Collector interface for log collection
type Collector interface {
	Name() string
	Start(ctx context.Context)
	Stop()
	Stats() map[string]any
}

// BaseCollector provides common functionality for collectors
type BaseCollector struct {
	name   string
	sender *sender.Sender

	// Stats
	logsCollected int64
	errorsCount   int64
	lastCollected time.Time
	running       bool
}

// createLogEntry creates a log entry with common fields
func createLogEntry(level, message, service, source string, tags map[string]string) buffer.LogEntry {
	entry := buffer.LogEntry{
		Timestamp: time.Now(),
		Level:     level,
		Message:   message,
		Service:   service,
		Source:    source,
		Tags:      make(map[string]string),
	}

	for k, v := range tags {
		entry.Tags[k] = v
	}

	return entry
}

// parseLevel attempts to extract log level from message
func parseLevel(message string) string {
	// Common patterns
	patterns := map[string][]string{
		"FATAL": {"FATAL", "fatal", "CRITICAL", "critical", "EMERG", "emerg"},
		"ERROR": {"ERROR", "error", "ERR", "err", "SEVERE", "severe"},
		"WARN":  {"WARN", "warn", "WARNING", "warning"},
		"INFO":  {"INFO", "info", "NOTICE", "notice"},
		"DEBUG": {"DEBUG", "debug", "TRACE", "trace"},
	}

	for level, keywords := range patterns {
		for _, kw := range keywords {
			if containsWord(message, kw) {
				return level
			}
		}
	}

	return "INFO"
}

// containsWord checks if message contains a word (simple implementation)
func containsWord(message, word string) bool {
	for i := 0; i <= len(message)-len(word); i++ {
		if message[i:i+len(word)] == word {
			// Check word boundaries
			before := i == 0 || !isAlphanumeric(message[i-1])
			after := i+len(word) == len(message) || !isAlphanumeric(message[i+len(word)])
			if before && after {
				return true
			}
		}
	}
	return false
}

func isAlphanumeric(c byte) bool {
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
}
