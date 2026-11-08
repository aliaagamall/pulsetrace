#!/usr/bin/env bash

set -uo pipefail

# Configuration
# --------------------------------------------------

# Compose needs NODE_ENV to validate the configuration.
# The running stack must also use development mode for the failure scenario.
export NODE_ENV=development

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
REPORT_DIR="tests/reports"
REPORT_FILE="$REPORT_DIR/logging-correlation-test-$TIMESTAMP.md"
TEMP_DIR="$(mktemp -d)"

PASSED=0
FAILED=0
SKIPPED=0

# Unique values for this run so old log lines never match.
RUN_ID="$(date +%s)-$RANDOM"
REQUEST_ID="corr-$RUN_ID"
FAILURE_REQUEST_ID="corr-fail-$RUN_ID"
SECRET_CUSTOMER="secret-customer-$RUN_ID"

UUID_PATTERN='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

mkdir -p "$REPORT_DIR"

trap 'rm -rf "$TEMP_DIR"' EXIT

REPORT_ROWS=""

# --------------------------------------------------
# Helpers
# --------------------------------------------------

record() {
  local name="$1"
  local result="$2"
  local details="$3"

  case "$result" in
    PASS)
      PASSED=$((PASSED + 1))
      printf '[PASS] %s - %s\n' "$name" "$details"
      ;;
    FAIL)
      FAILED=$((FAILED + 1))
      printf '[FAIL] %s - %s\n' "$name" "$details"
      ;;
    SKIP)
      SKIPPED=$((SKIPPED + 1))
      printf '[SKIP] %s - %s\n' "$name" "$details"
      ;;
  esac

  REPORT_ROWS+="| $name | $result | $details |"$'\n'
}

container_id() {
  docker compose ps -q "$1" 2>/dev/null
}

container_healthy() {
  local service="$1"
  local id

  id="$(container_id "$service")"

  [ -n "$id" ] || return 1

  [ "$(docker inspect \
    --format '{{.State.Health.Status}}' "$id" 2>/dev/null)" = "healthy" ]
}

# Sends a request and prints the HTTP status code.
# Arguments: method url body_file header_file [payload] [request_id]
http_call() {
  local method="$1"
  local url="$2"
  local output_file="$3"
  local header_file="$4"
  local payload="${5:-}"
  local request_id="${6:-}"

  local args=(
    -sS -X "$method" "$url"
    -o "$output_file"
    -D "$header_file"
    -w "%{http_code}"
  )

  if [ -n "$payload" ]; then
    args+=(-H "Content-Type: application/json" -d "$payload")
  fi

  if [ -n "$request_id" ]; then
    args+=(-H "x-request-id: $request_id")
  fi

  curl "${args[@]}" 2>/dev/null || true
}

# Prints the value of a response header (case-insensitive, no spaces).
response_header() {
  grep -i "^$2:" "$1" | tail -1 | cut -d: -f2- | tr -d '[:space:]'
}

# Counts log lines of one service that contain every given text.
# Arguments: service text [text...]
count_logs() {
  local service="$1"
  shift

  local lines
  local text

  lines="$(docker compose logs --no-log-prefix --since 10m "$service" 2>/dev/null)"

  for text in "$@"; do
    lines="$(printf '%s\n' "$lines" | grep -F -- "$text" || true)"
  done

  if [ -z "$lines" ]; then
    echo 0
  else
    printf '%s\n' "$lines" | wc -l | tr -d ' '
  fi
}

# Waits up to 10 seconds until a matching log line appears.
wait_for_logs() {
  local timeout=10
  local elapsed=0

  while [ "$elapsed" -lt "$timeout" ]; do
    if [ "$(count_logs "$@")" -ge 1 ]; then
      return 0
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done

  return 1
}

# --------------------------------------------------
# Start
# --------------------------------------------------

echo
echo "PulseTrace Logging Correlation Tests"
echo "===================================="
echo "Request ID: $REQUEST_ID"
echo

# --------------------------------------------------
# 1. Validate Compose configuration
# --------------------------------------------------

if docker compose config >/dev/null 2>&1; then
  record "Compose configuration" "PASS" "Configuration is valid"
else
  record "Compose configuration" "FAIL" "Invalid Compose configuration"
fi

# --------------------------------------------------
# 2. Application services are healthy
# --------------------------------------------------

UNHEALTHY=""

for service in payment-service order-service api-gateway; do
  if ! container_healthy "$service"; then
    UNHEALTHY+="$service "
  fi
done

if [ -z "$UNHEALTHY" ]; then
  record "Application services health" "PASS" "All three services are healthy"
else
  record "Application services health" "FAIL" "Not healthy: ${UNHEALTHY% }"
fi

# --------------------------------------------------
# 3. API Gateway health
# --------------------------------------------------

HTTP_CODE="$(http_call GET "$BASE_URL/health" \
  "$TEMP_DIR/health.json" "$TEMP_DIR/health.headers")"

if [ "$HTTP_CODE" = "200" ]; then
  record "API Gateway health" "PASS" "HTTP 200"
else
  record "API Gateway health" "FAIL" "Expected HTTP 200, got ${HTTP_CODE:-no response}"
fi

# --------------------------------------------------
# 4. Supplied request ID is returned
# --------------------------------------------------

SUCCESS_PAYLOAD='{
  "customerId": "correlation-success",
  "amount": 15.5,
  "currency": "USD"
}'

HTTP_CODE="$(http_call POST "$BASE_URL/api/orders" \
  "$TEMP_DIR/order.json" "$TEMP_DIR/order.headers" \
  "$SUCCESS_PAYLOAD" "$REQUEST_ID")"

RETURNED_ID="$(response_header "$TEMP_DIR/order.headers" x-request-id)"

if [ "$HTTP_CODE" = "201" ] && [ "$RETURNED_ID" = "$REQUEST_ID" ]; then
  record "Supplied request ID returned" "PASS" "Response carries $REQUEST_ID"
else
  record "Supplied request ID returned" "FAIL" "HTTP ${HTTP_CODE:-none}, returned ID: ${RETURNED_ID:-none}"
fi

# --------------------------------------------------
# 5-7. The same request ID appears in every service log
# --------------------------------------------------

for service in api-gateway order-service payment-service; do
  if wait_for_logs "$service" "\"id\":\"$REQUEST_ID\""; then
    record "$service logs request ID" "PASS" "Log entry found for $REQUEST_ID"
  else
    record "$service logs request ID" "FAIL" "No log entry found for $REQUEST_ID"
  fi
done

# --------------------------------------------------
# 8. Payment result is logged with the request ID
# --------------------------------------------------

if wait_for_logs payment-service \
  "\"id\":\"$REQUEST_ID\"" '"msg":"Payment processed"' '"status":"SUCCEEDED"'; then
  record "Payment result logged" "PASS" "Payment processed entry has the request ID"
else
  record "Payment result logged" "FAIL" "Payment processed entry not found"
fi

# --------------------------------------------------
# 9. Generated request ID when none is supplied
# --------------------------------------------------

UNKNOWN_ORDER_ID="00000000-0000-4000-8000-000000000000"

http_call GET "$BASE_URL/api/orders/$UNKNOWN_ORDER_ID" \
  "$TEMP_DIR/generated.json" "$TEMP_DIR/generated.headers" >/dev/null

GENERATED_ID="$(response_header "$TEMP_DIR/generated.headers" x-request-id)"

if [[ "$GENERATED_ID" =~ $UUID_PATTERN ]]; then
  record "Generated request ID" "PASS" "Gateway generated a UUID"
else
  record "Generated request ID" "FAIL" "Expected a UUID, got: ${GENERATED_ID:-none}"
fi

# --------------------------------------------------
# 10. Invalid request ID is replaced
# --------------------------------------------------

BAD_ID='bad id with spaces!'

http_call GET "$BASE_URL/api/orders/$UNKNOWN_ORDER_ID" \
  "$TEMP_DIR/replaced.json" "$TEMP_DIR/replaced.headers" "" "$BAD_ID" >/dev/null

REPLACED_ID="$(response_header "$TEMP_DIR/replaced.headers" x-request-id)"

if [[ "$REPLACED_ID" =~ $UUID_PATTERN ]]; then
  record "Invalid request ID replaced" "PASS" "Unsafe ID was replaced with a UUID"
else
  record "Invalid request ID replaced" "FAIL" "Unexpected ID returned: ${REPLACED_ID:-none}"
fi

# --------------------------------------------------
# 11. Failed payment is logged with the request ID
# --------------------------------------------------

FAILURE_PAYLOAD="{
  \"customerId\": \"$SECRET_CUSTOMER\",
  \"amount\": 9.99,
  \"currency\": \"USD\",
  \"simulateFailure\": true
}"

HTTP_CODE="$(http_call POST "$BASE_URL/api/orders" \
  "$TEMP_DIR/failure.json" "$TEMP_DIR/failure.headers" \
  "$FAILURE_PAYLOAD" "$FAILURE_REQUEST_ID")"

if [ "$HTTP_CODE" = "201" ]; then
  if wait_for_logs payment-service \
    "\"id\":\"$FAILURE_REQUEST_ID\"" '"msg":"Payment processed"' '"status":"FAILED"'; then
    record "Failed payment logged" "PASS" "FAILED payment entry has the request ID"
  else
    record "Failed payment logged" "FAIL" "FAILED payment entry not found"
  fi
else
  ERROR_MESSAGE="$(jq -r '.error.message // "No error message"' \
    "$TEMP_DIR/failure.json" 2>/dev/null || true)"

  record "Failed payment logged" "FAIL" "Expected HTTP 201, got ${HTTP_CODE:-no response}: $ERROR_MESSAGE (stack must run with NODE_ENV=development)"
fi

# --------------------------------------------------
# 12. Health checks are not logged
# --------------------------------------------------

HEALTH_LOG_LINES=0

for service in api-gateway order-service payment-service; do
  HEALTH_LOG_LINES=$((HEALTH_LOG_LINES + \
    $(count_logs "$service" '"path":"/health"')))
done

if [ "$HEALTH_LOG_LINES" -eq 0 ]; then
  record "Health checks not logged" "PASS" "No /health entries in service logs"
else
  record "Health checks not logged" "FAIL" "Found $HEALTH_LOG_LINES /health log entries"
fi

# --------------------------------------------------
# 13. Request bodies are not logged
# --------------------------------------------------

BODY_LOG_LINES=0

for service in api-gateway order-service payment-service; do
  BODY_LOG_LINES=$((BODY_LOG_LINES + \
    $(count_logs "$service" "$SECRET_CUSTOMER")))
done

if [ "$BODY_LOG_LINES" -eq 0 ]; then
  record "Request bodies not logged" "PASS" "Customer data from the request body is absent from logs"
else
  record "Request bodies not logged" "FAIL" "Found request data in $BODY_LOG_LINES log entries"
fi

# --------------------------------------------------
# Report
# --------------------------------------------------

TOTAL=$((PASSED + FAILED + SKIPPED))

cat > "$REPORT_FILE" <<EOF
# PulseTrace Logging Correlation Test Report

- **Date:** $TIMESTAMP
- **Environment:** development
- **Base URL:** $BASE_URL
- **Request ID:** $REQUEST_ID

## Summary

| Result | Count |
|---|---:|
| Passed | $PASSED |
| Failed | $FAILED |
| Skipped | $SKIPPED |
| Total | $TOTAL |

## Test Results

| Test | Result | Details |
|---|---|---|
$REPORT_ROWS
EOF

# --------------------------------------------------
# Final summary
# --------------------------------------------------

echo
echo "===================================="
echo "Test execution completed"
echo "Passed : $PASSED"
echo "Failed : $FAILED"
echo "Skipped: $SKIPPED"
echo "Total  : $TOTAL"
echo
echo "Report: $REPORT_FILE"
echo

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
