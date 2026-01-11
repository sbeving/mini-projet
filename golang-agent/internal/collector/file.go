package collector

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"

	"logchat/agent/internal/buffer"
	"logchat/agent/internal/config"
	"logchat/agent/internal/sender"

	"github.com/nxadm/tail"
)

// FileCollector collects logs from files
type FileCollector struct {
	BaseCollector
	mu sync.RWMutex

	config   config.FileCollectorConfig
	tails    map[string]*tail.Tail
	patterns []*regexp.Regexp
	excludes []*regexp.Regexp
	parser   *regexp.Regexp
}

// NewFileCollector creates a new file collector
func NewFileCollector(cfg config.FileCollectorConfig, snd *sender.Sender) *FileCollector {
	fc := &FileCollector{
		BaseCollector: BaseCollector{
			name:   fmt.Sprintf("file:%s", cfg.Service),
			sender: snd,
		},
		config: cfg,
		tails:  make(map[string]*tail.Tail),
	}

	// Compile patterns
	for _, path := range cfg.Paths {
		if pattern, err := regexp.Compile(globToRegex(path)); err == nil {
			fc.patterns = append(fc.patterns, pattern)
		}
	}

	// Compile excludes
	for _, excl := range cfg.Exclude {
		if pattern, err := regexp.Compile(globToRegex(excl)); err == nil {
			fc.excludes = append(fc.excludes, pattern)
		}
	}

	// Compile parser regex
	if cfg.Parser == "regex" && cfg.ParseRegex != "" {
		if pattern, err := regexp.Compile(cfg.ParseRegex); err == nil {
			fc.parser = pattern
		}
	}

	return fc
}

// Name returns the collector name
func (fc *FileCollector) Name() string {
	return fc.name
}

// Start starts the file collector
func (fc *FileCollector) Start(ctx context.Context) {
	fc.mu.Lock()
	fc.running = true
	fc.mu.Unlock()

	// Find files matching patterns
	files := fc.findFiles()
	fmt.Printf("  [%s] Found %d files to monitor\n", fc.name, len(files))

	// Start tailing each file
	var wg sync.WaitGroup
	for _, file := range files {
		wg.Add(1)
		go func(filePath string) {
			defer wg.Done()
			fc.tailFile(ctx, filePath)
		}(file)
	}

	// Wait for all tailers to finish
	wg.Wait()
}

// Stop stops the file collector
func (fc *FileCollector) Stop() {
	fc.mu.Lock()
	defer fc.mu.Unlock()

	fc.running = false
	for _, t := range fc.tails {
		t.Stop()
	}
}

// Stats returns collector statistics
func (fc *FileCollector) Stats() map[string]any {
	fc.mu.RLock()
	defer fc.mu.RUnlock()

	return map[string]any{
		"name":           fc.name,
		"logs_collected": fc.logsCollected,
		"errors_count":   fc.errorsCount,
		"last_collected": fc.lastCollected,
		"files_watched":  len(fc.tails),
		"running":        fc.running,
	}
}

// findFiles finds all files matching the configured patterns
func (fc *FileCollector) findFiles() []string {
	var files []string
	seen := make(map[string]bool)

	for _, path := range fc.config.Paths {
		matches, err := filepath.Glob(path)
		if err != nil {
			continue
		}

		for _, match := range matches {
			// Check if it's a file
			info, err := os.Stat(match)
			if err != nil || info.IsDir() {
				continue
			}

			// Check excludes
			excluded := false
			for _, excl := range fc.excludes {
				if excl.MatchString(match) {
					excluded = true
					break
				}
			}

			if !excluded && !seen[match] {
				seen[match] = true
				files = append(files, match)
			}
		}
	}

	return files
}

// tailFile tails a single file
func (fc *FileCollector) tailFile(ctx context.Context, filePath string) {
	t, err := tail.TailFile(filePath, tail.Config{
		Follow:    true,
		ReOpen:    true,
		MustExist: false,
		Location:  &tail.SeekInfo{Offset: 0, Whence: 2}, // Start at end
		Logger:    tail.DiscardingLogger,
	})
	if err != nil {
		fmt.Printf("  [%s] Error tailing %s: %v\n", fc.name, filePath, err)
		return
	}

	fc.mu.Lock()
	fc.tails[filePath] = t
	fc.mu.Unlock()

	defer func() {
		fc.mu.Lock()
		delete(fc.tails, filePath)
		fc.mu.Unlock()
		t.Stop()
	}()

	for {
		select {
		case <-ctx.Done():
			return

		case line, ok := <-t.Lines:
			if !ok {
				return
			}
			if line.Err != nil {
				fc.mu.Lock()
				fc.errorsCount++
				fc.mu.Unlock()
				continue
			}

			fc.processLine(filePath, line.Text)
		}
	}
}

// processLine processes a single log line
func (fc *FileCollector) processLine(filePath, text string) {
	if text == "" {
		return
	}

	entry := createLogEntry(
		parseLevel(text),
		text,
		fc.config.Service,
		filePath,
		fc.config.Tags,
	)

	// Parse based on parser type
	switch fc.config.Parser {
	case "json":
		fc.parseJSON(text, &entry)
	case "regex":
		fc.parseRegex(text, &entry)
	}

	if err := fc.sender.Send(entry); err != nil {
		fc.mu.Lock()
		fc.errorsCount++
		fc.mu.Unlock()
		return
	}

	fc.mu.Lock()
	fc.logsCollected++
	fc.lastCollected = time.Now()
	fc.mu.Unlock()
}

// parseJSON parses JSON log lines
func (fc *FileCollector) parseJSON(text string, entry *buffer.LogEntry) {
	var data map[string]any
	if err := json.Unmarshal([]byte(text), &data); err != nil {
		return
	}

	entry.Metadata = data

	// Extract common fields
	if level, ok := data["level"].(string); ok {
		entry.Level = level
	}
	if msg, ok := data["message"].(string); ok {
		entry.Message = msg
	} else if msg, ok := data["msg"].(string); ok {
		entry.Message = msg
	}
	if ts, ok := data["timestamp"].(string); ok {
		if t, err := time.Parse(time.RFC3339, ts); err == nil {
			entry.Timestamp = t
		}
	}
}

// parseRegex parses log lines using regex
func (fc *FileCollector) parseRegex(text string, entry *buffer.LogEntry) {
	if fc.parser == nil {
		return
	}

	matches := fc.parser.FindStringSubmatch(text)
	if matches == nil {
		return
	}

	names := fc.parser.SubexpNames()
	metadata := make(map[string]any)

	for i, name := range names {
		if i > 0 && name != "" && i < len(matches) {
			metadata[name] = matches[i]

			// Extract common fields
			switch name {
			case "level":
				entry.Level = matches[i]
			case "message", "msg":
				entry.Message = matches[i]
			case "timestamp", "time":
				if t, err := time.Parse(time.RFC3339, matches[i]); err == nil {
					entry.Timestamp = t
				}
			}
		}
	}

	entry.Metadata = metadata
}

// globToRegex converts a glob pattern to regex
func globToRegex(glob string) string {
	result := ""
	for i := 0; i < len(glob); i++ {
		c := glob[i]
		switch c {
		case '*':
			if i+1 < len(glob) && glob[i+1] == '*' {
				result += ".*"
				i++
			} else {
				result += "[^/]*"
			}
		case '?':
			result += "."
		case '.', '+', '^', '$', '[', ']', '(', ')', '{', '}', '|', '\\':
			result += "\\" + string(c)
		default:
			result += string(c)
		}
	}
	return "^" + result + "$"
}

// ReadExistingLines reads existing lines from a file (for initial load)
func ReadExistingLines(filePath string, maxLines int) ([]string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		lines = append(lines, scanner.Text())
		if len(lines) > maxLines {
			lines = lines[1:]
		}
	}

	return lines, scanner.Err()
}
