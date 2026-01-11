#!/bin/bash
#
# LogChat Agent Installation Script for Linux/macOS
# 
# Usage:
#   curl -sSL https://raw.githubusercontent.com/logchat/agent/main/scripts/install.sh | bash
#   or
#   wget -qO- https://raw.githubusercontent.com/logchat/agent/main/scripts/install.sh | bash
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO="logchat/agent"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/logchat"
SERVICE_NAME="logchat-agent"
BINARY_NAME="logchat-agent"

# Detect OS and architecture
detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case $ARCH in
        x86_64|amd64)
            ARCH="amd64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        i386|i686)
            ARCH="386"
            ;;
        *)
            echo -e "${RED}Unsupported architecture: $ARCH${NC}"
            exit 1
            ;;
    esac
    
    case $OS in
        linux)
            OS="linux"
            ;;
        darwin)
            OS="darwin"
            ;;
        *)
            echo -e "${RED}Unsupported OS: $OS${NC}"
            exit 1
            ;;
    esac
    
    PLATFORM="${OS}-${ARCH}"
    echo -e "${BLUE}Detected platform: ${PLATFORM}${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}Note: Running without root. Some features may require sudo.${NC}"
        USE_SUDO="sudo"
    else
        USE_SUDO=""
    fi
}

# Download latest release
download_agent() {
    echo -e "${BLUE}Downloading LogChat Agent...${NC}"
    
    # Get latest version
    VERSION=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' || echo "v1.0.0")
    
    if [ -z "$VERSION" ]; then
        VERSION="v1.0.0"
    fi
    
    echo -e "${BLUE}Installing version: ${VERSION}${NC}"
    
    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_NAME}-${PLATFORM}.tar.gz"
    
    # Create temp directory
    TMP_DIR=$(mktemp -d)
    trap "rm -rf $TMP_DIR" EXIT
    
    # Download
    if command -v curl &> /dev/null; then
        curl -sL "$DOWNLOAD_URL" -o "$TMP_DIR/agent.tar.gz" || {
            echo -e "${YELLOW}Could not download from GitHub. Trying alternative method...${NC}"
            # Fallback: Build from source
            build_from_source
            return
        }
    elif command -v wget &> /dev/null; then
        wget -q "$DOWNLOAD_URL" -O "$TMP_DIR/agent.tar.gz" || {
            build_from_source
            return
        }
    fi
    
    # Extract
    cd "$TMP_DIR"
    tar -xzf agent.tar.gz
    
    # Install binary
    $USE_SUDO mkdir -p "$INSTALL_DIR"
    $USE_SUDO mv "${BINARY_NAME}-${PLATFORM}" "$INSTALL_DIR/$BINARY_NAME"
    $USE_SUDO chmod +x "$INSTALL_DIR/$BINARY_NAME"
    
    echo -e "${GREEN}✓ Binary installed to $INSTALL_DIR/$BINARY_NAME${NC}"
}

# Build from source if download fails
build_from_source() {
    echo -e "${YELLOW}Building from source...${NC}"
    
    if ! command -v go &> /dev/null; then
        echo -e "${RED}Go is not installed. Please install Go 1.21+ and try again.${NC}"
        exit 1
    fi
    
    TMP_DIR=$(mktemp -d)
    trap "rm -rf $TMP_DIR" EXIT
    
    git clone --depth 1 "https://github.com/${REPO}.git" "$TMP_DIR/agent"
    cd "$TMP_DIR/agent"
    
    go build -ldflags="-s -w" -o "$BINARY_NAME" ./cmd/agent
    
    $USE_SUDO mkdir -p "$INSTALL_DIR"
    $USE_SUDO mv "$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"
    $USE_SUDO chmod +x "$INSTALL_DIR/$BINARY_NAME"
    
    echo -e "${GREEN}✓ Built and installed from source${NC}"
}

# Create configuration
create_config() {
    echo -e "${BLUE}Creating configuration...${NC}"
    
    $USE_SUDO mkdir -p "$CONFIG_DIR"
    
    if [ ! -f "$CONFIG_DIR/agent.yaml" ]; then
        # Generate sample config
        $USE_SUDO $INSTALL_DIR/$BINARY_NAME --generate-config
        $USE_SUDO mv logchat-agent.yaml "$CONFIG_DIR/agent.yaml"
        echo -e "${GREEN}✓ Configuration created at $CONFIG_DIR/agent.yaml${NC}"
    else
        echo -e "${YELLOW}Configuration already exists at $CONFIG_DIR/agent.yaml${NC}"
    fi
}

# Install systemd service (Linux)
install_systemd_service() {
    if [ "$OS" != "linux" ]; then
        return
    fi
    
    if ! command -v systemctl &> /dev/null; then
        echo -e "${YELLOW}systemd not found. Skipping service installation.${NC}"
        return
    fi
    
    echo -e "${BLUE}Installing systemd service...${NC}"
    
    $USE_SUDO tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=LogChat Log Collection Agent
Documentation=https://github.com/${REPO}
After=network.target

[Service]
Type=simple
User=root
ExecStart=${INSTALL_DIR}/${BINARY_NAME} -config ${CONFIG_DIR}/agent.yaml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/logchat

[Install]
WantedBy=multi-user.target
EOF

    # Create data directory
    $USE_SUDO mkdir -p /var/lib/logchat
    
    # Reload systemd
    $USE_SUDO systemctl daemon-reload
    
    echo -e "${GREEN}✓ Systemd service installed${NC}"
    echo -e "${BLUE}To start the agent:${NC}"
    echo -e "  sudo systemctl start ${SERVICE_NAME}"
    echo -e "  sudo systemctl enable ${SERVICE_NAME}  # Start on boot"
}

# Install launchd service (macOS)
install_launchd_service() {
    if [ "$OS" != "darwin" ]; then
        return
    fi
    
    echo -e "${BLUE}Installing launchd service...${NC}"
    
    PLIST_PATH="$HOME/Library/LaunchAgents/com.logchat.agent.plist"
    
    mkdir -p "$HOME/Library/LaunchAgents"
    
    cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.logchat.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>${INSTALL_DIR}/${BINARY_NAME}</string>
        <string>-config</string>
        <string>${CONFIG_DIR}/agent.yaml</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/logchat-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/logchat-agent.err</string>
</dict>
</plist>
EOF
    
    echo -e "${GREEN}✓ launchd service installed${NC}"
    echo -e "${BLUE}To start the agent:${NC}"
    echo -e "  launchctl load ${PLIST_PATH}"
}

# Print completion message
print_completion() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║       LogChat Agent Installation Complete! 🎉             ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo ""
    echo -e "1. Edit the configuration file:"
    echo -e "   ${YELLOW}sudo nano ${CONFIG_DIR}/agent.yaml${NC}"
    echo ""
    echo -e "2. Set your LogChat server URL and API key"
    echo ""
    echo -e "3. Start the agent:"
    if [ "$OS" = "linux" ]; then
        echo -e "   ${YELLOW}sudo systemctl start ${SERVICE_NAME}${NC}"
        echo -e "   ${YELLOW}sudo systemctl enable ${SERVICE_NAME}${NC}"
    elif [ "$OS" = "darwin" ]; then
        echo -e "   ${YELLOW}launchctl load ~/Library/LaunchAgents/com.logchat.agent.plist${NC}"
    fi
    echo ""
    echo -e "4. Check status:"
    if [ "$OS" = "linux" ]; then
        echo -e "   ${YELLOW}sudo systemctl status ${SERVICE_NAME}${NC}"
        echo -e "   ${YELLOW}sudo journalctl -u ${SERVICE_NAME} -f${NC}"
    fi
    echo ""
    echo -e "For help: ${YELLOW}${BINARY_NAME} --help${NC}"
    echo ""
}

# Main installation
main() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║           LogChat Agent Installer                          ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    detect_platform
    check_root
    download_agent
    create_config
    
    if [ "$OS" = "linux" ]; then
        install_systemd_service
    elif [ "$OS" = "darwin" ]; then
        install_launchd_service
    fi
    
    print_completion
}

# Run main
main "$@"
