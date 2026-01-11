# LogChat Agent Makefile
# Cross-platform build system for the log collection agent

BINARY_NAME=logchat-agent
VERSION?=1.0.0
BUILD_TIME=$(shell date -u '+%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=$(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod

# Build flags
LDFLAGS=-ldflags "-s -w -X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME) -X main.GitCommit=$(GIT_COMMIT)"

# Output directories
BUILD_DIR=build
DIST_DIR=dist

# Platforms
PLATFORMS=linux/amd64 linux/arm64 linux/386 windows/amd64 windows/386 darwin/amd64 darwin/arm64

.PHONY: all build clean test lint deps help

# Default target
all: clean deps test build

# Help
help:
	@echo "LogChat Agent Build System"
	@echo ""
	@echo "Usage:"
	@echo "  make build         - Build for current platform"
	@echo "  make build-all     - Build for all platforms"
	@echo "  make build-linux   - Build for Linux (amd64, arm64)"
	@echo "  make build-windows - Build for Windows (amd64, 386)"
	@echo "  make build-darwin  - Build for macOS (amd64, arm64)"
	@echo "  make test          - Run tests"
	@echo "  make lint          - Run linter"
	@echo "  make deps          - Download dependencies"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make install       - Install to /usr/local/bin (Unix)"
	@echo "  make package       - Create distribution packages"
	@echo ""

# Download dependencies
deps:
	@echo "📦 Downloading dependencies..."
	$(GOMOD) download
	$(GOMOD) tidy

# Run tests
test:
	@echo "🧪 Running tests..."
	$(GOTEST) -v -race -cover ./...

# Run linter
lint:
	@echo "🔍 Running linter..."
	@which golangci-lint > /dev/null || (echo "Installing golangci-lint..." && go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest)
	golangci-lint run ./...

# Build for current platform
build:
	@echo "🔨 Building for current platform..."
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/agent
	@echo "✅ Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

# Build for all platforms
build-all: build-linux build-windows build-darwin
	@echo "✅ All builds complete!"

# Build for Linux
build-linux:
	@echo "🐧 Building for Linux..."
	@mkdir -p $(DIST_DIR)
	GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/$(BINARY_NAME)-linux-amd64 ./cmd/agent
	GOOS=linux GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/$(BINARY_NAME)-linux-arm64 ./cmd/agent
	GOOS=linux GOARCH=386 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/$(BINARY_NAME)-linux-386 ./cmd/agent
	@echo "✅ Linux builds complete!"

# Build for Windows
build-windows:
	@echo "🪟 Building for Windows..."
	@mkdir -p $(DIST_DIR)
	GOOS=windows GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/$(BINARY_NAME)-windows-amd64.exe ./cmd/agent
	GOOS=windows GOARCH=386 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/$(BINARY_NAME)-windows-386.exe ./cmd/agent
	@echo "✅ Windows builds complete!"

# Build for macOS
build-darwin:
	@echo "🍎 Building for macOS..."
	@mkdir -p $(DIST_DIR)
	GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/$(BINARY_NAME)-darwin-amd64 ./cmd/agent
	GOOS=darwin GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/$(BINARY_NAME)-darwin-arm64 ./cmd/agent
	@echo "✅ macOS builds complete!"

# Clean build artifacts
clean:
	@echo "🧹 Cleaning..."
	$(GOCLEAN)
	rm -rf $(BUILD_DIR)
	rm -rf $(DIST_DIR)

# Install (Unix only)
install: build
	@echo "📥 Installing to /usr/local/bin..."
	sudo cp $(BUILD_DIR)/$(BINARY_NAME) /usr/local/bin/$(BINARY_NAME)
	sudo chmod +x /usr/local/bin/$(BINARY_NAME)
	@echo "✅ Installed to /usr/local/bin/$(BINARY_NAME)"

# Create distribution packages
package: build-all
	@echo "📦 Creating distribution packages..."
	@mkdir -p $(DIST_DIR)/packages
	
	# Linux packages
	cd $(DIST_DIR) && tar -czf packages/$(BINARY_NAME)-$(VERSION)-linux-amd64.tar.gz $(BINARY_NAME)-linux-amd64
	cd $(DIST_DIR) && tar -czf packages/$(BINARY_NAME)-$(VERSION)-linux-arm64.tar.gz $(BINARY_NAME)-linux-arm64
	
	# Windows packages
	cd $(DIST_DIR) && zip -q packages/$(BINARY_NAME)-$(VERSION)-windows-amd64.zip $(BINARY_NAME)-windows-amd64.exe
	cd $(DIST_DIR) && zip -q packages/$(BINARY_NAME)-$(VERSION)-windows-386.zip $(BINARY_NAME)-windows-386.exe
	
	# macOS packages
	cd $(DIST_DIR) && tar -czf packages/$(BINARY_NAME)-$(VERSION)-darwin-amd64.tar.gz $(BINARY_NAME)-darwin-amd64
	cd $(DIST_DIR) && tar -czf packages/$(BINARY_NAME)-$(VERSION)-darwin-arm64.tar.gz $(BINARY_NAME)-darwin-arm64
	
	@echo "✅ Packages created in $(DIST_DIR)/packages/"

# Generate sample config
config:
	@echo "📝 Generating sample configuration..."
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/agent
	./$(BUILD_DIR)/$(BINARY_NAME) --generate-config
	@echo "✅ Sample config generated: logchat-agent.yaml"

# Development run
run: build
	./$(BUILD_DIR)/$(BINARY_NAME) -config logchat-agent.yaml

# Docker build
docker:
	@echo "🐳 Building Docker image..."
	docker build -t logchat-agent:$(VERSION) .
	@echo "✅ Docker image built: logchat-agent:$(VERSION)"
