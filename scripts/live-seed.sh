#!/bin/bash

# Live Log Seeder - Continuously generates logs for real-time testing
# Usage: ./scripts/live-seed.sh [interval_seconds]
# Default interval: 3 seconds

API_URL="${API_URL:-http://localhost:3001}"
INTERVAL="${1:-3}"

# Services
SERVICES=("api-gateway" "auth-service" "user-service" "payment-service" "notification-service" "inventory-service" "order-service" "search-service")

# Log levels with weights (more INFO/DEBUG, fewer ERROR/FATAL)
LEVELS=("DEBUG" "DEBUG" "INFO" "INFO" "INFO" "INFO" "WARN" "WARN" "ERROR" "FATAL")

# Sample messages by level
DEBUG_MESSAGES=(
  "Cache miss for key: user_session_"
  "Database query executed in {time}ms"
  "Processing request with correlation ID: "
  "Memory usage: {mem}MB"
  "Connection pool status: {active}/{total}"
  "Entering function: processRequest"
  "Exiting function: validateInput"
)

INFO_MESSAGES=(
  "Request completed successfully"
  "User logged in successfully"
  "Order created with ID: ORD-"
  "Payment processed for amount: \${amount}"
  "Email notification sent to user"
  "Inventory updated for product: SKU-"
  "Search query returned {count} results"
  "API rate limit check passed"
  "Health check passed"
  "Background job completed: cleanup_sessions"
)

WARN_MESSAGES=(
  "High memory usage detected: {mem}%"
  "API rate limit approaching: {current}/{max}"
  "Slow database query detected: {time}ms"
  "Retry attempt {n}/3 for external service"
  "Deprecated API endpoint called: /v1/users"
  "Connection pool running low: {available} remaining"
  "Cache eviction triggered due to memory pressure"
  "Request timeout approaching threshold"
)

ERROR_MESSAGES=(
  "Failed to connect to database: Connection refused"
  "Authentication failed for user: invalid credentials"
  "Payment processing error: Card declined"
  "External API returned 500: Service unavailable"
  "File upload failed: Size exceeds limit"
  "Invalid request payload: Missing required field 'email'"
  "Order creation failed: Insufficient inventory"
  "Search index corrupted: Rebuilding required"
  "SSL certificate validation failed"
  "Rate limit exceeded for IP: "
)

FATAL_MESSAGES=(
  "CRITICAL: Database connection pool exhausted"
  "CRITICAL: Out of memory - service restarting"
  "CRITICAL: Unhandled exception in main thread"
  "CRITICAL: Data corruption detected in orders table"
  "CRITICAL: Security breach detected - suspicious activity"
)

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Function to get random element from array
random_element() {
  local arr=("$@")
  echo "${arr[$RANDOM % ${#arr[@]}]}"
}

# Function to generate random number in range
random_range() {
  local min=$1
  local max=$2
  echo $((RANDOM % (max - min + 1) + min))
}

# Function to generate realistic message
generate_message() {
  local level=$1
  local message=""
  
  case $level in
    "DEBUG")
      message=$(random_element "${DEBUG_MESSAGES[@]}")
      message="${message//\{time\}/$(random_range 5 150)}"
      message="${message//\{mem\}/$(random_range 128 512)}"
      message="${message//\{active\}/$(random_range 5 20)}"
      message="${message//\{total\}/25}"
      message="${message}$(cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 8 | head -n 1)"
      ;;
    "INFO")
      message=$(random_element "${INFO_MESSAGES[@]}")
      message="${message//\{count\}/$(random_range 10 500)}"
      message="${message//\{amount\}/$(random_range 10 999).$(random_range 10 99)}"
      message="${message}$(random_range 1000 9999)"
      ;;
    "WARN")
      message=$(random_element "${WARN_MESSAGES[@]}")
      message="${message//\{mem\}/$(random_range 75 95)}"
      message="${message//\{current\}/$(random_range 80 95)}"
      message="${message//\{max\}/100}"
      message="${message//\{time\}/$(random_range 500 3000)}"
      message="${message//\{n\}/$(random_range 1 3)}"
      message="${message//\{available\}/$(random_range 2 5)}"
      ;;
    "ERROR")
      message=$(random_element "${ERROR_MESSAGES[@]}")
      message="${message}$(random_range 1 255).$(random_range 1 255).$(random_range 1 255).$(random_range 1 255)"
      ;;
    "FATAL")
      message=$(random_element "${FATAL_MESSAGES[@]}")
      ;;
  esac
  
  echo "$message"
}

# Function to colorize level
colorize_level() {
  local level=$1
  case $level in
    "DEBUG") echo -e "${GRAY}$level${NC}" ;;
    "INFO")  echo -e "${BLUE}$level${NC}" ;;
    "WARN")  echo -e "${YELLOW}$level${NC}" ;;
    "ERROR") echo -e "${RED}$level${NC}" ;;
    "FATAL") echo -e "${RED}$level${NC}" ;;
  esac
}

# Function to send log
send_log() {
  local service=$(random_element "${SERVICES[@]}")
  local level=$(random_element "${LEVELS[@]}")
  local message=$(generate_message "$level")
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
  
  # Create JSON payload
  local payload=$(cat <<EOF
{
  "timestamp": "$timestamp",
  "level": "$level",
  "service": "$service",
  "message": "$message",
  "meta": {
    "hostname": "prod-server-$(random_range 1 5)",
    "pid": $(random_range 1000 9999),
    "requestId": "req-$(cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 12 | head -n 1)"
  }
}
EOF
)
  
  # Send to API
  response=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API_URL/api/logs" \
    -H "Content-Type: application/json" \
    -d "$payload")
  
  # Display result
  local colored_level=$(colorize_level "$level")
  local time=$(date +"%H:%M:%S")
  
  if [ "$response" = "201" ] || [ "$response" = "200" ]; then
    echo -e "[$time] ${GREEN}✓${NC} [$colored_level] $service: ${message:0:60}..."
  else
    echo -e "[$time] ${RED}✗${NC} Failed to send log (HTTP $response)"
  fi
}

# Main loop
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           🔴 Live Log Seeder - Real-time Testing          ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  API:      $API_URL                          ║"
echo "║  Interval: ${INTERVAL}s between logs                             ║"
echo "║  Press Ctrl+C to stop                                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check API health first
echo "Checking API health..."
health=$(curl -s "$API_URL/health" 2>/dev/null)
if echo "$health" | grep -q "healthy"; then
  echo -e "${GREEN}✓ API is healthy${NC}"
  echo ""
  echo "Starting live log generation..."
  echo "─────────────────────────────────────────────────────────────"
else
  echo -e "${RED}✗ API is not responding. Make sure the backend is running.${NC}"
  exit 1
fi

# Counter
count=0

while true; do
  send_log
  count=$((count + 1))
  
  # Occasionally send a burst of logs (simulates high activity)
  if [ $((RANDOM % 10)) -eq 0 ]; then
    echo -e "${YELLOW}⚡ Burst mode - sending multiple logs${NC}"
    for i in {1..3}; do
      send_log
      sleep 0.5
    done
  fi
  
  # Show stats every 20 logs
  if [ $((count % 20)) -eq 0 ]; then
    echo ""
    echo -e "─────────────────────────────────────────────────────────────"
    echo -e "📊 Stats: $count logs sent"
    echo -e "─────────────────────────────────────────────────────────────"
    echo ""
  fi
  
  sleep "$INTERVAL"
done
