package buffer

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"logchat/agent/internal/config"
)

// LogEntry represents a log entry in the buffer
type LogEntry struct {
	Timestamp   time.Time         `json:"timestamp"`
	Level       string            `json:"level"`
	Message     string            `json:"message"`
	Service     string            `json:"service"`
	Source      string            `json:"source"`
	Hostname    string            `json:"hostname"`
	Environment string            `json:"environment"`
	Tags        map[string]string `json:"tags,omitempty"`
	Metadata    map[string]any    `json:"metadata,omitempty"`
}

// Buffer interface for log buffering
type Buffer interface {
	Push(entry LogEntry) error
	Pop(count int) ([]LogEntry, error)
	Peek(count int) ([]LogEntry, error)
	Remove(count int) error
	Len() int
	Close() error
}

// MemoryBuffer implements in-memory buffering
type MemoryBuffer struct {
	mu       sync.RWMutex
	entries  []LogEntry
	maxItems int
	maxSize  int64
	curSize  int64
}

// FileBuffer implements file-based buffering for persistence
type FileBuffer struct {
	mu       sync.RWMutex
	path     string
	maxItems int
	maxSize  int64
	file     *os.File
	entries  []LogEntry
}

// New creates a new buffer based on configuration
func New(cfg config.BufferConfig) (Buffer, error) {
	switch cfg.Type {
	case "file":
		return newFileBuffer(cfg)
	case "memory", "":
		return newMemoryBuffer(cfg), nil
	default:
		return nil, fmt.Errorf("unknown buffer type: %s", cfg.Type)
	}
}

// newMemoryBuffer creates a new memory buffer
func newMemoryBuffer(cfg config.BufferConfig) *MemoryBuffer {
	return &MemoryBuffer{
		entries:  make([]LogEntry, 0, cfg.MaxItems),
		maxItems: cfg.MaxItems,
		maxSize:  cfg.MaxSize,
	}
}

// Push adds an entry to the memory buffer
func (b *MemoryBuffer) Push(entry LogEntry) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	// Calculate entry size
	data, _ := json.Marshal(entry)
	entrySize := int64(len(data))

	// Check if we need to evict old entries
	for b.curSize+entrySize > b.maxSize && len(b.entries) > 0 {
		oldData, _ := json.Marshal(b.entries[0])
		b.curSize -= int64(len(oldData))
		b.entries = b.entries[1:]
	}

	// Check max items
	for len(b.entries) >= b.maxItems {
		oldData, _ := json.Marshal(b.entries[0])
		b.curSize -= int64(len(oldData))
		b.entries = b.entries[1:]
	}

	b.entries = append(b.entries, entry)
	b.curSize += entrySize

	return nil
}

// Pop removes and returns entries from the buffer
func (b *MemoryBuffer) Pop(count int) ([]LogEntry, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if count > len(b.entries) {
		count = len(b.entries)
	}

	entries := make([]LogEntry, count)
	copy(entries, b.entries[:count])
	b.entries = b.entries[count:]

	// Update size
	for _, entry := range entries {
		data, _ := json.Marshal(entry)
		b.curSize -= int64(len(data))
	}

	return entries, nil
}

// Peek returns entries without removing them
func (b *MemoryBuffer) Peek(count int) ([]LogEntry, error) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if count > len(b.entries) {
		count = len(b.entries)
	}

	entries := make([]LogEntry, count)
	copy(entries, b.entries[:count])

	return entries, nil
}

// Remove removes entries from the buffer
func (b *MemoryBuffer) Remove(count int) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if count > len(b.entries) {
		count = len(b.entries)
	}

	for i := 0; i < count; i++ {
		data, _ := json.Marshal(b.entries[i])
		b.curSize -= int64(len(data))
	}

	b.entries = b.entries[count:]
	return nil
}

// Len returns the number of entries in the buffer
func (b *MemoryBuffer) Len() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.entries)
}

// Close closes the memory buffer
func (b *MemoryBuffer) Close() error {
	return nil
}

// newFileBuffer creates a new file-based buffer
func newFileBuffer(cfg config.BufferConfig) (*FileBuffer, error) {
	if cfg.Path == "" {
		cfg.Path = filepath.Join(os.TempDir(), "logchat-buffer")
	}

	// Ensure directory exists
	if err := os.MkdirAll(cfg.Path, 0755); err != nil {
		return nil, fmt.Errorf("failed to create buffer directory: %w", err)
	}

	bufferFile := filepath.Join(cfg.Path, "buffer.json")

	buf := &FileBuffer{
		path:     bufferFile,
		maxItems: cfg.MaxItems,
		maxSize:  cfg.MaxSize,
		entries:  make([]LogEntry, 0),
	}

	// Load existing buffer if it exists
	if err := buf.load(); err != nil {
		// It's okay if the file doesn't exist
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("failed to load existing buffer: %w", err)
		}
	}

	return buf, nil
}

// load loads entries from the file
func (b *FileBuffer) load() error {
	data, err := os.ReadFile(b.path)
	if err != nil {
		return err
	}

	return json.Unmarshal(data, &b.entries)
}

// save saves entries to the file
func (b *FileBuffer) save() error {
	data, err := json.Marshal(b.entries)
	if err != nil {
		return err
	}

	return os.WriteFile(b.path, data, 0644)
}

// Push adds an entry to the file buffer
func (b *FileBuffer) Push(entry LogEntry) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	// Evict old entries if needed
	for len(b.entries) >= b.maxItems {
		b.entries = b.entries[1:]
	}

	b.entries = append(b.entries, entry)

	return b.save()
}

// Pop removes and returns entries from the file buffer
func (b *FileBuffer) Pop(count int) ([]LogEntry, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if count > len(b.entries) {
		count = len(b.entries)
	}

	entries := make([]LogEntry, count)
	copy(entries, b.entries[:count])
	b.entries = b.entries[count:]

	if err := b.save(); err != nil {
		return entries, err
	}

	return entries, nil
}

// Peek returns entries without removing them
func (b *FileBuffer) Peek(count int) ([]LogEntry, error) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if count > len(b.entries) {
		count = len(b.entries)
	}

	entries := make([]LogEntry, count)
	copy(entries, b.entries[:count])

	return entries, nil
}

// Remove removes entries from the file buffer
func (b *FileBuffer) Remove(count int) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if count > len(b.entries) {
		count = len(b.entries)
	}

	b.entries = b.entries[count:]
	return b.save()
}

// Len returns the number of entries in the buffer
func (b *FileBuffer) Len() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.entries)
}

// Close closes the file buffer
func (b *FileBuffer) Close() error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if err := b.save(); err != nil {
		return err
	}

	if b.file != nil {
		return b.file.Close()
	}

	return nil
}
