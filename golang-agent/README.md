# LogChat Agent

<p align="center">
  <img src="https://img.shields.io/badge/go-%2300ADD8.svg?style=for-the-badge&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux">
  <img src="https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS">
</p>

A cross-platform log collection agent that sends logs to the LogChat server for AI-powered analysis.

## Features

- 🐧 **Linux Support**: journald, syslog, file tailing
- 🪟 **Windows Support**: Event Log, file tailing
- 🍎 **macOS Support**: File tailing
- 📁 **File Collector**: Tail log files with glob patterns
- 🔄 **Auto-reconnect**: Buffers logs when server is unavailable
- 🔒 **Secure**: TLS support, API key authentication
- ⚡ **Lightweight**: Single binary, minimal resource usage
- 🏷️ **Tagging**: Add custom tags to all logs
- 📊 **Parsing**: JSON, regex, and plain text parsing

## Quick Start

### Linux/macOS

```bash
# One-line install
curl -sSL https://raw.githubusercontent.com/logchat/agent/main/scripts/install.sh | sudo bash

# Configure
sudo nano /etc/logchat/agent.yaml

# Start
sudo systemctl start logchat-agent
sudo systemctl enable logchat-agent
```

### Windows (PowerShell as Administrator)

```powershell
# Download and install
iex (irm 'https://raw.githubusercontent.com/logchat/agent/main/scripts/install.ps1')

# Configure
notepad C:\ProgramData\LogChat\agent.yaml

# Start
Start-Service LogChatAgent
```

### Docker

```bash
docker run -d \
  --name logchat-agent \
  -v /var/log:/var/log:ro \
  -v /path/to/config.yaml:/etc/logchat/agent.yaml:ro \
  logchat/agent:latest
```

## Configuration

Generate a sample configuration:

```bash
logchat-agent --generate-config
```

### Basic Configuration

```yaml
# Server connection
server:
  url: "http://your-logchat-server:3001"
  api_key: "your-api-key-here"
  timeout: 30s
  batch_size: 100
  flush_interval: 5s

# Agent identification
agent:
  hostname: "my-server"
  environment: "production"
  tags:
    datacenter: "dc1"
    team: "platform"

# Local buffer for offline operation
buffer:
  type: "memory"  # or "file"
  max_size: 104857600  # 100MB
  max_items: 10000

# Log collectors
collectors:
  # File-based logs
  files:
    - enabled: true
      paths:
        - "/var/log/*.log"
        - "/var/log/syslog"
      service: "system"
      parser: "plain"

    - enabled: true
      paths:
        - "/var/log/nginx/*.log"
      service: "nginx"
      parser: "regex"
      parse_regex: '^(?P<remote_addr>\S+) .* \[(?P<time_local>[^\]]+)\]'

  # Systemd journal (Linux)
  journald:
    enabled: true
    units:
      - "docker.service"
      - "nginx.service"
    priority: 4  # Warning and above

  # Windows Event Log
  eventlog:
    enabled: true
    channels:
      - "Application"
      - "System"
      - "Security"
```

## Collectors

### File Collector (All Platforms)

Tail log files in real-time with support for:
- Glob patterns (`/var/log/*.log`)
- File rotation handling
- Multiline log support
- JSON and regex parsing

```yaml
collectors:
  files:
    - enabled: true
      paths:
        - "/var/log/app/*.log"
      exclude:
        - "*.gz"
        - "*.old"
      service: "my-app"
      parser: "json"
      tags:
        app: "my-app"
```

### Journald Collector (Linux)

Collect logs from systemd journal:

```yaml
collectors:
  journald:
    enabled: true
    units:
      - "docker.service"
      - "nginx.service"
      - "sshd.service"
    since: "-1h"
    priority: 4  # 0=Emergency to 7=Debug
```

### Syslog Collector (Linux)

Listen for syslog messages:

```yaml
collectors:
  syslog:
    enabled: true
    address: "udp://0.0.0.0:514"  # or "unix:///dev/log"
    protocol: "rfc3164"
```

### Windows Event Log Collector

Collect Windows Event Logs:

```yaml
collectors:
  eventlog:
    enabled: true
    channels:
      - "Application"
      - "System"
      - "Security"
      - "Setup"
```

### Command Collector (All Platforms)

Execute commands and capture output:

```yaml
collectors:
  command:
    - enabled: true
      command: "df"
      args: ["-h"]
      interval: 60s
      service: "disk-usage"
      timeout: 10s
```

## Building from Source

### Prerequisites

- Go 1.21 or later
- Git
- Make (optional)

### Build

```bash
# Clone
git clone https://github.com/logchat/agent.git
cd agent

# Build for current platform
make build

# Build for all platforms
make build-all

# Run tests
make test
```

### Cross-compilation

```bash
# Linux
GOOS=linux GOARCH=amd64 go build -o logchat-agent-linux ./cmd/agent

# Windows
GOOS=windows GOARCH=amd64 go build -o logchat-agent.exe ./cmd/agent

# macOS
GOOS=darwin GOARCH=arm64 go build -o logchat-agent-darwin ./cmd/agent
```

## Running as a Service

### Linux (systemd)

```bash
# Copy binary
sudo cp logchat-agent /usr/local/bin/

# Create service file
sudo tee /etc/systemd/system/logchat-agent.service << EOF
[Unit]
Description=LogChat Log Collection Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/logchat-agent -config /etc/logchat/agent.yaml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable logchat-agent
sudo systemctl start logchat-agent
```

### Windows (Service)

```powershell
# Create service
New-Service -Name "LogChatAgent" `
            -DisplayName "LogChat Log Collection Agent" `
            -BinaryPathName "C:\LogChat\logchat-agent.exe -config C:\LogChat\config.yaml" `
            -StartupType Automatic

# Start service
Start-Service LogChatAgent
```

### macOS (launchd)

```bash
# Create plist
cat > ~/Library/LaunchAgents/com.logchat.agent.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.logchat.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/logchat-agent</string>
        <string>-config</string>
        <string>/etc/logchat/agent.yaml</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

# Load
launchctl load ~/Library/LaunchAgents/com.logchat.agent.plist
```

## Command Line Options

```
logchat-agent [options]

Options:
  -config string       Path to config file (default: auto-detect)
  -version             Show version information
  -generate-config     Generate a sample config file
  -validate            Validate config file and exit
```

## Environment Variables

Configuration values can reference environment variables:

```yaml
server:
  url: "${LOGCHAT_URL}"
  api_key: "${LOGCHAT_API_KEY}"
```

## Troubleshooting

### Check agent status

```bash
# Linux
sudo systemctl status logchat-agent
sudo journalctl -u logchat-agent -f

# Windows
Get-Service LogChatAgent
Get-EventLog -LogName Application -Source LogChatAgent -Newest 20
```

### Test configuration

```bash
logchat-agent -config /path/to/config.yaml -validate
```

### Debug mode

Set `log_level: debug` in your config for verbose output.

### Common issues

1. **Connection refused**: Check server URL and firewall
2. **Authentication failed**: Verify API key
3. **No logs collected**: Check file paths and permissions
4. **High memory usage**: Reduce buffer size

## License

MIT License - See [LICENSE](LICENSE) for details.