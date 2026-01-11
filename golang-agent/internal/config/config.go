package config

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Config represents the agent configuration
type Config struct {
	Server     ServerConfig     `yaml:"server"`
	Agent      AgentConfig      `yaml:"agent"`
	Buffer     BufferConfig     `yaml:"buffer"`
	Collectors CollectorsConfig `yaml:"collectors"`
}

// ServerConfig contains LogChat server connection settings
type ServerConfig struct {
	URL           string        `yaml:"url"`
	APIKey        string        `yaml:"api_key"`
	Timeout       time.Duration `yaml:"timeout"`
	Insecure      bool          `yaml:"insecure"` // Skip TLS verification
	BatchSize     int           `yaml:"batch_size"`
	FlushInterval time.Duration `yaml:"flush_interval"`
}

// AgentConfig contains agent identification settings
type AgentConfig struct {
	Hostname    string            `yaml:"hostname"`
	Environment string            `yaml:"environment"`
	Tags        map[string]string `yaml:"tags"`
	LogLevel    string            `yaml:"log_level"`
}

// BufferConfig contains local buffer settings
type BufferConfig struct {
	Type     string `yaml:"type"`      // memory, file
	Path     string `yaml:"path"`      // For file buffer
	MaxSize  int64  `yaml:"max_size"`  // Max buffer size in bytes
	MaxItems int    `yaml:"max_items"` // Max number of items
}

// CollectorsConfig contains all collector configurations
type CollectorsConfig struct {
	Files    []FileCollectorConfig    `yaml:"files"`
	Syslog   *SyslogCollectorConfig   `yaml:"syslog"`
	Journald *JournaldCollectorConfig `yaml:"journald"`
	EventLog *EventLogCollectorConfig `yaml:"eventlog"`
	Docker   *DockerCollectorConfig   `yaml:"docker"`
	Command  []CommandCollectorConfig `yaml:"command"`
}

// FileCollectorConfig for file-based log collection
type FileCollectorConfig struct {
	Enabled    bool              `yaml:"enabled"`
	Paths      []string          `yaml:"paths"`
	Exclude    []string          `yaml:"exclude"`
	Recursive  bool              `yaml:"recursive"`
	Service    string            `yaml:"service"`
	Multiline  *MultilineConfig  `yaml:"multiline"`
	Parser     string            `yaml:"parser"` // json, regex, plain
	ParseRegex string            `yaml:"parse_regex"`
	Tags       map[string]string `yaml:"tags"`
}

// MultilineConfig for handling multiline logs
type MultilineConfig struct {
	Pattern string `yaml:"pattern"`
	Negate  bool   `yaml:"negate"`
	Match   string `yaml:"match"` // after, before
}

// SyslogCollectorConfig for syslog collection (Linux)
type SyslogCollectorConfig struct {
	Enabled  bool   `yaml:"enabled"`
	Address  string `yaml:"address"`  // unix:///dev/log, udp://0.0.0.0:514
	Protocol string `yaml:"protocol"` // rfc3164, rfc5424
	Service  string `yaml:"service"`
}

// JournaldCollectorConfig for systemd journal (Linux)
type JournaldCollectorConfig struct {
	Enabled  bool     `yaml:"enabled"`
	Units    []string `yaml:"units"` // Specific units to collect
	Since    string   `yaml:"since"` // How far back to collect
	Service  string   `yaml:"service"`
	Priority int      `yaml:"priority"` // 0-7, collect this level and above
}

// EventLogCollectorConfig for Windows Event Log
type EventLogCollectorConfig struct {
	Enabled  bool     `yaml:"enabled"`
	Channels []string `yaml:"channels"` // Application, System, Security, etc.
	Query    string   `yaml:"query"`    // XPath query
	Service  string   `yaml:"service"`
}

// DockerCollectorConfig for Docker container logs
type DockerCollectorConfig struct {
	Enabled    bool     `yaml:"enabled"`
	Socket     string   `yaml:"socket"`
	Containers []string `yaml:"containers"` // Container names/IDs, empty = all
	Labels     []string `yaml:"labels"`     // Filter by labels
	Since      string   `yaml:"since"`
}

// CommandCollectorConfig for executing commands and parsing output
type CommandCollectorConfig struct {
	Enabled  bool          `yaml:"enabled"`
	Command  string        `yaml:"command"`
	Args     []string      `yaml:"args"`
	Interval time.Duration `yaml:"interval"`
	Service  string        `yaml:"service"`
	Timeout  time.Duration `yaml:"timeout"`
}

// Load loads configuration from file or defaults
func Load(path string) (*Config, error) {
	cfg := defaultConfig()

	// Try to find config file
	configPath := path
	if configPath == "" {
		configPath = findConfigFile()
	}

	if configPath != "" {
		data, err := os.ReadFile(configPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}

		// Expand environment variables
		expanded := os.ExpandEnv(string(data))

		if err := yaml.Unmarshal([]byte(expanded), cfg); err != nil {
			return nil, fmt.Errorf("failed to parse config file: %w", err)
		}
	}

	// Apply defaults and validate
	if err := cfg.applyDefaults(); err != nil {
		return nil, err
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// findConfigFile searches for config file in common locations
func findConfigFile() string {
	locations := []string{
		"logchat-agent.yaml",
		"logchat-agent.yml",
		"config.yaml",
		"config.yml",
	}

	// Add platform-specific locations
	if runtime.GOOS == "windows" {
		locations = append(locations,
			filepath.Join(os.Getenv("PROGRAMDATA"), "LogChat", "agent.yaml"),
			filepath.Join(os.Getenv("APPDATA"), "LogChat", "agent.yaml"),
		)
	} else {
		locations = append(locations,
			"/etc/logchat/agent.yaml",
			"/etc/logchat-agent.yaml",
			filepath.Join(os.Getenv("HOME"), ".config", "logchat", "agent.yaml"),
		)
	}

	for _, loc := range locations {
		if _, err := os.Stat(loc); err == nil {
			return loc
		}
	}

	return ""
}

// defaultConfig returns the default configuration
func defaultConfig() *Config {
	hostname, _ := os.Hostname()

	return &Config{
		Server: ServerConfig{
			URL:           "http://localhost:3001",
			Timeout:       30 * time.Second,
			BatchSize:     100,
			FlushInterval: 5 * time.Second,
		},
		Agent: AgentConfig{
			Hostname:    hostname,
			Environment: "production",
			LogLevel:    "info",
			Tags:        make(map[string]string),
		},
		Buffer: BufferConfig{
			Type:     "memory",
			MaxSize:  100 * 1024 * 1024, // 100MB
			MaxItems: 10000,
		},
		Collectors: CollectorsConfig{
			Files: []FileCollectorConfig{},
		},
	}
}

// applyDefaults applies default values to empty fields
func (c *Config) applyDefaults() error {
	if c.Agent.Hostname == "" {
		hostname, err := os.Hostname()
		if err != nil {
			c.Agent.Hostname = "unknown"
		} else {
			c.Agent.Hostname = hostname
		}
	}

	if c.Server.BatchSize == 0 {
		c.Server.BatchSize = 100
	}

	if c.Server.FlushInterval == 0 {
		c.Server.FlushInterval = 5 * time.Second
	}

	if c.Server.Timeout == 0 {
		c.Server.Timeout = 30 * time.Second
	}

	if c.Buffer.MaxItems == 0 {
		c.Buffer.MaxItems = 10000
	}

	if c.Buffer.MaxSize == 0 {
		c.Buffer.MaxSize = 100 * 1024 * 1024
	}

	return nil
}

// validate validates the configuration
func (c *Config) validate() error {
	if c.Server.URL == "" {
		return fmt.Errorf("server.url is required")
	}

	if !strings.HasPrefix(c.Server.URL, "http://") && !strings.HasPrefix(c.Server.URL, "https://") {
		return fmt.Errorf("server.url must start with http:// or https://")
	}

	return nil
}

// GenerateSampleConfig generates a sample configuration file
func GenerateSampleConfig() error {
	hostname, _ := os.Hostname()

	sample := fmt.Sprintf(`# LogChat Agent Configuration
# Generated for %s

# Server connection settings
server:
  # LogChat API URL
  url: "http://localhost:3001"
  
  # API key for authentication (get from admin panel)
  api_key: "${LOGCHAT_API_KEY}"
  
  # Request timeout
  timeout: 30s
  
  # Skip TLS verification (for self-signed certs)
  insecure: false
  
  # Batch settings
  batch_size: 100
  flush_interval: 5s

# Agent identification
agent:
  # Hostname (auto-detected if empty)
  hostname: "%s"
  
  # Environment name
  environment: "production"
  
  # Log level: debug, info, warn, error
  log_level: "info"
  
  # Custom tags added to all logs
  tags:
    datacenter: "dc1"
    team: "platform"

# Local buffer for when server is unavailable
buffer:
  # Type: memory, file
  type: "memory"
  
  # Path for file buffer
  path: "/var/lib/logchat/buffer"
  
  # Maximum buffer size in bytes (100MB)
  max_size: 104857600
  
  # Maximum number of buffered items
  max_items: 10000

# Log collectors configuration
collectors:
  # File-based log collection
  files:
    - enabled: true
      paths:
        - "/var/log/*.log"
        - "/var/log/syslog"
        - "/var/log/messages"
      exclude:
        - "*.gz"
        - "*.old"
      recursive: false
      service: "system"
      parser: "plain"
      tags:
        source: "file"
    
    - enabled: true
      paths:
        - "/var/log/nginx/*.log"
      service: "nginx"
      parser: "regex"
      parse_regex: '^(?P<remote_addr>\S+) .* \[(?P<time_local>[^\]]+)\] "(?P<request>[^"]*)" (?P<status>\d+)'
      tags:
        source: "nginx"
`, runtime.GOOS, hostname)

	// Add platform-specific collectors
	if runtime.GOOS == "linux" {
		sample += `
  # Systemd Journal (Linux only)
  journald:
    enabled: true
    units:
      - "docker.service"
      - "nginx.service"
      - "sshd.service"
    since: "-1h"
    service: "journald"
    priority: 4  # Warning and above

  # Syslog listener (Linux only)
  syslog:
    enabled: false
    address: "unix:///dev/log"
    protocol: "rfc3164"
    service: "syslog"
`
	}

	if runtime.GOOS == "windows" {
		sample += `
  # Windows Event Log (Windows only)
  eventlog:
    enabled: true
    channels:
      - "Application"
      - "System"
      - "Security"
    service: "windows"
`
	}

	sample += `
  # Docker container logs
  docker:
    enabled: false
    socket: "/var/run/docker.sock"
    containers: []  # Empty = all containers
    since: "1h"

  # Command execution (run commands periodically)
  command:
    - enabled: false
      command: "df"
      args: ["-h"]
      interval: 60s
      service: "disk-usage"
      timeout: 10s
`

	return os.WriteFile("logchat-agent.yaml", []byte(sample), 0644)
}
