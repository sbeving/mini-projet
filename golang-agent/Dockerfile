# Multi-stage build for LogChat Agent
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /logchat-agent ./cmd/agent

# Final image
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Copy binary
COPY --from=builder /logchat-agent /usr/local/bin/logchat-agent

# Create config directory
RUN mkdir -p /etc/logchat

# Copy default config if exists
COPY --from=builder /app/logchat-agent.yaml /etc/logchat/agent.yaml 2>/dev/null || true

# Run as non-root
RUN adduser -D -H logchat
USER logchat

ENTRYPOINT ["logchat-agent"]
CMD ["-config", "/etc/logchat/agent.yaml"]
