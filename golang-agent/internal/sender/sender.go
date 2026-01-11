package sender

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"logchat/agent/internal/buffer"
	"logchat/agent/internal/config"
)

// LogPayload represents the payload sent to the server
type LogPayload struct {
	Logs []buffer.LogEntry `json:"logs"`
}

// Sender handles sending logs to the LogChat server
type Sender struct {
	mu sync.RWMutex

	serverURL     string
	apiKey        string
	timeout       time.Duration
	batchSize     int
	flushInterval time.Duration
	insecure      bool

	hostname    string
	environment string
	tags        map[string]string

	buffer buffer.Buffer
	client *http.Client

	// Metrics
	sentCount   int64
	errorCount  int64
	lastSent    time.Time
	lastError   string
	serverAlive bool
}

// New creates a new sender
func New(serverCfg config.ServerConfig, agentCfg config.AgentConfig, buf buffer.Buffer) (*Sender, error) {
	// Create HTTP client
	transport := &http.Transport{
		MaxIdleConns:        10,
		IdleConnTimeout:     30 * time.Second,
		DisableCompression:  false,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	if serverCfg.Insecure {
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   serverCfg.Timeout,
	}

	return &Sender{
		serverURL:     serverCfg.URL,
		apiKey:        serverCfg.APIKey,
		timeout:       serverCfg.Timeout,
		batchSize:     serverCfg.BatchSize,
		flushInterval: serverCfg.FlushInterval,
		insecure:      serverCfg.Insecure,
		hostname:      agentCfg.Hostname,
		environment:   agentCfg.Environment,
		tags:          agentCfg.Tags,
		buffer:        buf,
		client:        client,
		serverAlive:   true,
	}, nil
}

// Start starts the sender loop
func (s *Sender) Start(ctx context.Context) {
	ticker := time.NewTicker(s.flushInterval)
	defer ticker.Stop()

	// Health check ticker
	healthTicker := time.NewTicker(30 * time.Second)
	defer healthTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			// Final flush before shutdown
			s.flush(context.Background())
			return

		case <-ticker.C:
			s.flush(ctx)

		case <-healthTicker.C:
			s.checkHealth(ctx)
		}
	}
}

// Send queues a log entry for sending
func (s *Sender) Send(entry buffer.LogEntry) error {
	// Enrich entry with agent info
	entry.Hostname = s.hostname
	entry.Environment = s.environment

	if entry.Tags == nil {
		entry.Tags = make(map[string]string)
	}
	for k, v := range s.tags {
		if _, exists := entry.Tags[k]; !exists {
			entry.Tags[k] = v
		}
	}

	return s.buffer.Push(entry)
}

// flush sends buffered logs to the server
func (s *Sender) flush(ctx context.Context) {
	s.mu.Lock()
	bufLen := s.buffer.Len()
	s.mu.Unlock()

	if bufLen == 0 {
		return
	}

	// Process in batches
	for {
		s.mu.Lock()
		if s.buffer.Len() == 0 {
			s.mu.Unlock()
			break
		}

		entries, err := s.buffer.Peek(s.batchSize)
		s.mu.Unlock()

		if err != nil || len(entries) == 0 {
			break
		}

		// Send batch
		if err := s.sendBatch(ctx, entries); err != nil {
			s.mu.Lock()
			s.errorCount++
			s.lastError = err.Error()
			s.serverAlive = false
			s.mu.Unlock()

			// Don't remove entries if send failed - they'll be retried
			break
		}

		// Remove sent entries
		s.mu.Lock()
		s.buffer.Remove(len(entries))
		s.sentCount += int64(len(entries))
		s.lastSent = time.Now()
		s.serverAlive = true
		s.mu.Unlock()
	}
}

// sendBatch sends a batch of logs to the server
func (s *Sender) sendBatch(ctx context.Context, entries []buffer.LogEntry) error {
	payload := LogPayload{Logs: entries}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal logs: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.serverURL+"/api/logs/ingest", bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "LogChat-Agent/1.0")

	if s.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+s.apiKey)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("server returned %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// checkHealth checks if the server is reachable
func (s *Sender) checkHealth(ctx context.Context) {
	req, err := http.NewRequestWithContext(ctx, "GET", s.serverURL+"/api/health", nil)
	if err != nil {
		return
	}

	resp, err := s.client.Do(req)
	if err != nil {
		s.mu.Lock()
		s.serverAlive = false
		s.mu.Unlock()
		return
	}
	defer resp.Body.Close()

	s.mu.Lock()
	s.serverAlive = resp.StatusCode == 200
	s.mu.Unlock()
}

// Stats returns sender statistics
func (s *Sender) Stats() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return map[string]any{
		"sent_count":    s.sentCount,
		"error_count":   s.errorCount,
		"last_sent":     s.lastSent,
		"last_error":    s.lastError,
		"server_alive":  s.serverAlive,
		"buffer_length": s.buffer.Len(),
	}
}

// IsServerAlive returns whether the server is reachable
func (s *Sender) IsServerAlive() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.serverAlive
}
