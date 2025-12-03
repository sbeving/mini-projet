#!/bin/bash

# Seed sample logs into LogChat database
# Usage: ./scripts/seed-logs.sh [count]

API_URL="${API_URL:-http://localhost:3001}"
LOG_COUNT="${1:-100}"

# Array of sample services
SERVICES=("auth-service" "api-gateway" "user-service" "payment-service" "notification-service" "inventory-service")

# Array of sample log levels
LEVELS=("DEBUG" "INFO" "INFO" "INFO" "WARN" "WARN" "ERROR" "ERROR" "FATAL")

# Sample messages by level
DEBUG_MESSAGES=(
  "Processing request with params: {id: 123}"
  "Cache hit for key: user_session_abc"
  "Database query executed in 45ms"
  "HTTP request to external service"
  "Validating input parameters"
)

INFO_MESSAGES=(
  "User logged in successfully"
  "Request processed successfully"
  "Service started on port 8080"
  "Configuration loaded from environment"
  "Health check passed"
  "Background job completed"
  "Session created for user"
)

WARN_MESSAGES=(
  "High memory usage detected: 85%"
  "Slow database query: 2500ms"
  "Rate limit approaching for client"
  "Deprecated API endpoint called"
  "Certificate expires in 7 days"
  "Retry attempt 2 of 3 for external service"
)

ERROR_MESSAGES=(
  "Failed to connect to database"
  "Authentication failed: invalid token"
  "Payment processing failed: insufficient funds"
  "External API returned 500 error"
  "Failed to send notification: invalid email"
  "Request timeout after 30 seconds"
  "Invalid JSON in request body"
  "User not found: ID 999"
)

FATAL_MESSAGES=(
  "Database connection pool exhausted"
  "Out of memory error"
  "Critical configuration missing"
  "Service crash: unhandled exception"
)

echo "🚀 Seeding $LOG_COUNT sample logs to $API_URL/api/logs"
echo ""

# Function to get random element from array
random_element() {
  local arr=("$@")
  echo "${arr[$RANDOM % ${#arr[@]}]}"
}

# Function to generate random timestamp within last 24 hours
random_timestamp() {
  local now=$(date +%s)
  local hours_ago=$((RANDOM % 24))
  local minutes_ago=$((RANDOM % 60))
  local seconds_ago=$((RANDOM % 60))
  local timestamp=$((now - hours_ago * 3600 - minutes_ago * 60 - seconds_ago))
  date -u -d "@$timestamp" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -r "$timestamp" +"%Y-%m-%dT%H:%M:%SZ"
}

# Seed logs
success_count=0
error_count=0

for i in $(seq 1 $LOG_COUNT); do
  SERVICE=$(random_element "${SERVICES[@]}")
  LEVEL=$(random_element "${LEVELS[@]}")
  
  # Select message based on level
  case $LEVEL in
    DEBUG) MESSAGE=$(random_element "${DEBUG_MESSAGES[@]}") ;;
    INFO)  MESSAGE=$(random_element "${INFO_MESSAGES[@]}") ;;
    WARN)  MESSAGE=$(random_element "${WARN_MESSAGES[@]}") ;;
    ERROR) MESSAGE=$(random_element "${ERROR_MESSAGES[@]}") ;;
    FATAL) MESSAGE=$(random_element "${FATAL_MESSAGES[@]}") ;;
  esac
  
  TIMESTAMP=$(random_timestamp)
  
  # Create JSON payload
  JSON=$(cat <<EOF
{
  "timestamp": "$TIMESTAMP",
  "level": "$LEVEL",
  "service": "$SERVICE",
  "message": "$MESSAGE",
  "meta": {
    "request_id": "req_$(openssl rand -hex 4 2>/dev/null || echo $RANDOM$RANDOM)",
    "host": "server-$(( (RANDOM % 3) + 1 ))"
  }
}
EOF
)

  # Send to API
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/logs" \
    -H "Content-Type: application/json" \
    -d "$JSON")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  
  if [ "$HTTP_CODE" == "201" ]; then
    ((success_count++))
    if [ $((i % 10)) -eq 0 ]; then
      echo "  ✓ Seeded $i/$LOG_COUNT logs..."
    fi
  else
    ((error_count++))
    echo "  ✗ Failed to seed log $i (HTTP $HTTP_CODE)"
  fi
  
  # Small delay to avoid overwhelming the API
  sleep 0.05
done

echo ""
echo "✅ Seeding complete!"
echo "   Success: $success_count"
echo "   Errors:  $error_count"
echo ""

# Test some raw format logs too
echo "📝 Seeding some raw format logs..."

RAW_LOGS=(
  "2025-01-01T12:00:00Z [ERROR] auth-service: Failed to validate token for user 12345"
  "2025-01-01T12:01:00Z [WARN] api-gateway: Rate limit exceeded for IP 192.168.1.100"
  "2025-01-01T12:02:00Z [INFO] user-service: User registration completed"
  "2025-01-01T12:03:00Z [ERROR] payment-service: Transaction failed: card declined"
  "2025-01-01T12:04:00Z [FATAL] inventory-service: Connection to database lost"
)

for RAW_LOG in "${RAW_LOGS[@]}"; do
  curl -s -X POST "$API_URL/api/logs" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$RAW_LOG\"}" > /dev/null
done

echo "✅ Raw format logs seeded!"
echo ""
echo "🎉 All done! Visit http://localhost:3000/dashboard to see your logs."
