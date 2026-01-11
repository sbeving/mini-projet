//go:build linux
// +build linux

package collector

import (
	"context"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"logchat/agent/internal/config"
	"logchat/agent/internal/sender"
)

// SyslogCollector collects logs via syslog
type SyslogCollector struct {
	BaseCollector
	mu sync.RWMutex

	config   config.SyslogCollectorConfig
	listener net.Listener
	conn     net.PacketConn
}

// NewSyslogCollector creates a new syslog collector
func NewSyslogCollector(cfg config.SyslogCollectorConfig, snd *sender.Sender) *SyslogCollector {
	return &SyslogCollector{
		BaseCollector: BaseCollector{
			name:   "syslog",
			sender: snd,
		},
		config: cfg,
	}
}

// Name returns the collector name
func (sc *SyslogCollector) Name() string {
	return sc.name
}

// Start starts the syslog collector
func (sc *SyslogCollector) Start(ctx context.Context) {
	sc.mu.Lock()
	sc.running = true
	sc.mu.Unlock()

	address := sc.config.Address
	if address == "" {
		address = "unix:///dev/log"
	}

	fmt.Printf("  [syslog] Starting syslog listener on %s\n", address)

	// Parse address
	var network, addr string
	if strings.HasPrefix(address, "unix://") {
		network = "unixgram"
		addr = strings.TrimPrefix(address, "unix://")
	} else if strings.HasPrefix(address, "udp://") {
		network = "udp"
		addr = strings.TrimPrefix(address, "udp://")
	} else if strings.HasPrefix(address, "tcp://") {
		network = "tcp"
		addr = strings.TrimPrefix(address, "tcp://")
	} else {
		network = "udp"
		addr = address
	}

	if network == "tcp" {
		sc.startTCP(ctx, addr)
	} else {
		sc.startUDP(ctx, network, addr)
	}
}

// startUDP starts UDP/Unix listener
func (sc *SyslogCollector) startUDP(ctx context.Context, network, addr string) {
	conn, err := net.ListenPacket(network, addr)
	if err != nil {
		fmt.Printf("  [syslog] Error listening: %v\n", err)
		return
	}
	sc.conn = conn
	defer conn.Close()

	buf := make([]byte, 65536)

	for {
		select {
		case <-ctx.Done():
			return
		default:
			conn.SetReadDeadline(time.Now().Add(1 * time.Second))
			n, _, err := conn.ReadFrom(buf)
			if err != nil {
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					continue
				}
				continue
			}

			sc.processMessage(string(buf[:n]))
		}
	}
}

// startTCP starts TCP listener
func (sc *SyslogCollector) startTCP(ctx context.Context, addr string) {
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		fmt.Printf("  [syslog] Error listening: %v\n", err)
		return
	}
	sc.listener = listener
	defer listener.Close()

	for {
		select {
		case <-ctx.Done():
			return
		default:
			conn, err := listener.Accept()
			if err != nil {
				continue
			}

			go sc.handleTCPConn(ctx, conn)
		}
	}
}

// handleTCPConn handles a TCP connection
func (sc *SyslogCollector) handleTCPConn(ctx context.Context, conn net.Conn) {
	defer conn.Close()

	buf := make([]byte, 65536)

	for {
		select {
		case <-ctx.Done():
			return
		default:
			conn.SetReadDeadline(time.Now().Add(5 * time.Second))
			n, err := conn.Read(buf)
			if err != nil {
				return
			}

			sc.processMessage(string(buf[:n]))
		}
	}
}

// Stop stops the syslog collector
func (sc *SyslogCollector) Stop() {
	sc.mu.Lock()
	sc.running = false
	if sc.listener != nil {
		sc.listener.Close()
	}
	if sc.conn != nil {
		sc.conn.Close()
	}
	sc.mu.Unlock()
}

// Stats returns collector statistics
func (sc *SyslogCollector) Stats() map[string]any {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	return map[string]any{
		"name":           sc.name,
		"logs_collected": sc.logsCollected,
		"errors_count":   sc.errorsCount,
		"last_collected": sc.lastCollected,
		"running":        sc.running,
		"address":        sc.config.Address,
	}
}

// SyslogMessage represents a parsed syslog message
type SyslogMessage struct {
	Priority  int
	Timestamp time.Time
	Hostname  string
	Tag       string
	Message   string
}

// processMessage processes a syslog message
func (sc *SyslogCollector) processMessage(text string) {
	if text == "" {
		return
	}

	// Parse syslog message
	msg := sc.parseSyslog(text)

	// Convert priority to level
	level := syslogPriorityToLevel(msg.Priority)

	service := sc.config.Service
	if service == "" {
		if msg.Tag != "" {
			service = msg.Tag
		} else {
			service = "syslog"
		}
	}

	entry := createLogEntry(
		level,
		msg.Message,
		service,
		"syslog",
		map[string]string{
			"syslog_tag":      msg.Tag,
			"syslog_hostname": msg.Hostname,
		},
	)

	if !msg.Timestamp.IsZero() {
		entry.Timestamp = msg.Timestamp
	}

	entry.Metadata = map[string]any{
		"priority": msg.Priority,
		"facility": msg.Priority / 8,
		"severity": msg.Priority % 8,
	}

	if err := sc.sender.Send(entry); err != nil {
		sc.mu.Lock()
		sc.errorsCount++
		sc.mu.Unlock()
		return
	}

	sc.mu.Lock()
	sc.logsCollected++
	sc.lastCollected = time.Now()
	sc.mu.Unlock()
}

// parseSyslog parses a syslog message (RFC 3164)
func (sc *SyslogCollector) parseSyslog(text string) SyslogMessage {
	msg := SyslogMessage{
		Message: text,
	}

	// Try to parse priority
	if len(text) > 0 && text[0] == '<' {
		end := strings.Index(text, ">")
		if end > 0 && end < 5 {
			var pri int
			fmt.Sscanf(text[1:end], "%d", &pri)
			msg.Priority = pri
			text = text[end+1:]
		}
	}

	// Try to parse timestamp (RFC 3164: "Jan  2 15:04:05")
	if len(text) >= 15 {
		if t, err := time.Parse("Jan  2 15:04:05", text[:15]); err == nil {
			msg.Timestamp = t.AddDate(time.Now().Year(), 0, 0)
			text = strings.TrimLeft(text[15:], " ")
		} else if t, err := time.Parse("Jan 2 15:04:05", text[:14]); err == nil {
			msg.Timestamp = t.AddDate(time.Now().Year(), 0, 0)
			text = strings.TrimLeft(text[14:], " ")
		}
	}

	// Try to parse hostname and tag
	parts := strings.SplitN(text, " ", 3)
	if len(parts) >= 2 {
		msg.Hostname = parts[0]
		if len(parts) >= 3 {
			// Tag might end with : or [pid]:
			tag := parts[1]
			if idx := strings.Index(tag, "["); idx != -1 {
				tag = tag[:idx]
			}
			tag = strings.TrimSuffix(tag, ":")
			msg.Tag = tag
			msg.Message = parts[2]
		} else {
			msg.Message = parts[1]
		}
	}

	return msg
}

// syslogPriorityToLevel converts syslog priority to log level
func syslogPriorityToLevel(priority int) string {
	severity := priority % 8
	switch severity {
	case 0, 1, 2: // Emergency, Alert, Critical
		return "FATAL"
	case 3: // Error
		return "ERROR"
	case 4: // Warning
		return "WARN"
	case 5, 6: // Notice, Informational
		return "INFO"
	case 7: // Debug
		return "DEBUG"
	default:
		return "INFO"
	}
}
