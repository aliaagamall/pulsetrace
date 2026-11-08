#!/usr/bin/env bash

set -uo pipefail

# --------------------------------------------------
# Configuration
# --------------------------------------------------

# Integration tests must always run in development mode.
export NODE_ENV=development

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
REPORT_DIR="tests/reports"
REPORT_FILE="$REPORT_DIR/postgres-integration-test-$TIMESTAMP.md"
TEMP_DIR="$(mktemp -d)"

PASSED=0
FAILED=0
SKIPPED=0
TOTAL=22

ORDER_ID=""
PAYMENT_ID=""
FAILURE_ORDER_ID=""
FAILURE_PAYMENT_ID=""

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

wait_for_healthy() {
  local service="$1"
  local timeout="${2:-60}"
  local elapsed=0

  while [ "$elapsed" -lt "$timeout" ]; do
    if container_healthy "$service"; then
      return 0
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  return 1
}

db_query() {
  local database="$1"
  local query="$2"

  docker compose exec -T postgres \
    psql -U pulsetrace_admin -d "$database" -tAc "$query" 2>/dev/null |
    tr -d '[:space:]'
}

http_request() {
  local method="$1"
  local url="$2"
  local output_file="$3"
  local payload="${4:-}"

  if [ -n "$payload" ]; then
    curl -sS \
      -X "$method" \
      "$url" \
      -H "Content-Type: application/json" \
      -d "$payload" \
      -o "$output_file" \
      -w "%{http_code}" 2>/dev/null || true
  else
    curl -sS \
      -X "$method" \
      "$url" \
      -o "$output_file" \
      -w "%{http_code}" 2>/dev/null || true
  fi
}

extract_order() {
  jq -er '
    (.data // .) |
    [
      (.id // ""),
      (.status // ""),
      (.paymentId // "")
    ] | @tsv
  ' "$1"
}

# --------------------------------------------------
# Start
# --------------------------------------------------

echo
echo "PulseTrace PostgreSQL Integration Tests"
echo "======================================="
echo "NODE_ENV: $NODE_ENV"
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
# 2. Ensure PostgreSQL is running without recreating it
# --------------------------------------------------

if docker compose up -d postgres >/dev/null 2>&1; then
  if wait_for_healthy postgres 60; then
    record "PostgreSQL health" "PASS" "PostgreSQL is healthy"
  else
    record "PostgreSQL health" "FAIL" "PostgreSQL did not become healthy"
  fi
else
  record "PostgreSQL health" "FAIL" "Could not start PostgreSQL"
fi

# --------------------------------------------------
# 3. Recreate application services in development mode
# --------------------------------------------------

if docker compose up -d --force-recreate \
  api-gateway order-service payment-service >/dev/null 2>&1; then
  echo "Application services recreated with NODE_ENV=$NODE_ENV"
else
  echo "WARNING: Could not recreate application services"
fi

# --------------------------------------------------
# 4-6. Application container health
# --------------------------------------------------

for service in payment-service order-service api-gateway; do
  if wait_for_healthy "$service" 90; then
    record "$service health" "PASS" "Container is healthy"
  else
    record "$service health" "FAIL" "Container did not become healthy"
  fi
done

# --------------------------------------------------
# 7. PostgreSQL connectivity
# --------------------------------------------------

if [ "$(db_query order_db "SELECT 1")" = "1" ]; then
  record "PostgreSQL connectivity" "PASS" "PostgreSQL accepts queries"
else
  record "PostgreSQL connectivity" "FAIL" "Could not query PostgreSQL"
fi

# --------------------------------------------------
# 8. order_db exists
# --------------------------------------------------

ORDER_DB_EXISTS="$(db_query postgres \
  "SELECT COUNT(*) FROM pg_database WHERE datname='order_db'")"

if [ "$ORDER_DB_EXISTS" = "1" ]; then
  record "order_db exists" "PASS" "Database exists"
else
  record "order_db exists" "FAIL" "Database does not exist"
fi

# --------------------------------------------------
# 9. payment_db exists
# --------------------------------------------------

PAYMENT_DB_EXISTS="$(db_query postgres \
  "SELECT COUNT(*) FROM pg_database WHERE datname='payment_db'")"

if [ "$PAYMENT_DB_EXISTS" = "1" ]; then
  record "payment_db exists" "PASS" "Database exists"
else
  record "payment_db exists" "FAIL" "Database does not exist"
fi

# --------------------------------------------------
# 10. Order migration tracking
# --------------------------------------------------

ORDER_MIGRATIONS="$(db_query order_db \
  "SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema='public' AND table_name='schema_migrations'")"

if [ "$ORDER_MIGRATIONS" = "1" ]; then
  record "order_db migration tracking" "PASS" "schema_migrations exists"
else
  record "order_db migration tracking" "FAIL" "schema_migrations is missing"
fi

# --------------------------------------------------
# 11. Payment migration tracking
# --------------------------------------------------

PAYMENT_MIGRATIONS="$(db_query payment_db \
  "SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema='public' AND table_name='schema_migrations'")"

if [ "$PAYMENT_MIGRATIONS" = "1" ]; then
  record "payment_db migration tracking" "PASS" "schema_migrations exists"
else
  record "payment_db migration tracking" "FAIL" "schema_migrations is missing"
fi

# --------------------------------------------------
# 12. API Gateway health
# --------------------------------------------------

HEALTH_FILE="$TEMP_DIR/health.json"

HTTP_CODE="$(http_request GET "$BASE_URL/health" "$HEALTH_FILE")"

if [ "$HTTP_CODE" = "200" ]; then
  record "API Gateway health" "PASS" "HTTP 200"
else
  record "API Gateway health" "FAIL" "Expected HTTP 200, got ${HTTP_CODE:-no response}"
fi

# --------------------------------------------------
# 13. Create successful order
# --------------------------------------------------

SUCCESS_PAYLOAD='{
  "customerId": "postgres-integration-success",
  "amount": 29.99,
  "currency": "USD"
}'

SUCCESS_FILE="$TEMP_DIR/success-order.json"

HTTP_CODE="$(http_request POST \
  "$BASE_URL/api/orders" "$SUCCESS_FILE" "$SUCCESS_PAYLOAD")"

if [ "$HTTP_CODE" = "201" ]; then
  SUCCESS_DATA="$(extract_order "$SUCCESS_FILE" 2>/dev/null || true)"

  if [ -n "$SUCCESS_DATA" ]; then
    IFS=$'\t' read -r ORDER_ID ORDER_STATUS PAYMENT_ID <<< "$SUCCESS_DATA"

    if [ "$ORDER_STATUS" = "PAID" ] &&
      [ -n "$ORDER_ID" ] &&
      [ -n "$PAYMENT_ID" ]; then
      record "Create successful order" "PASS" "Order $ORDER_ID created with PAID status"
    else
      record "Create successful order" "FAIL" "Unexpected response status: $ORDER_STATUS"
    fi
  else
    record "Create successful order" "FAIL" "Could not parse order response"
  fi
else
  record "Create successful order" "FAIL" "Expected HTTP 201, got ${HTTP_CODE:-no response}"
fi

# --------------------------------------------------
# 14. Retrieve order
# --------------------------------------------------

if [ -n "$ORDER_ID" ]; then
  RETRIEVE_FILE="$TEMP_DIR/retrieved-order.json"

  HTTP_CODE="$(http_request GET \
    "$BASE_URL/api/orders/$ORDER_ID" "$RETRIEVE_FILE")"

  if [ "$HTTP_CODE" = "200" ]; then
    RETRIEVED_STATUS="$(jq -r '(.data // .).status // ""' \
      "$RETRIEVE_FILE" 2>/dev/null || true)"

    if [ "$RETRIEVED_STATUS" = "PAID" ]; then
      record "Retrieve order" "PASS" "Order returned with PAID status"
    else
      record "Retrieve order" "FAIL" "Unexpected order status: $RETRIEVED_STATUS"
    fi
  else
    record "Retrieve order" "FAIL" "Expected HTTP 200, got ${HTTP_CODE:-no response}"
  fi
else
  record "Retrieve order" "SKIP" "No successful order ID available"
fi

# --------------------------------------------------
# 15. Verify order persistence
# --------------------------------------------------

if [ -n "$ORDER_ID" ]; then
  DB_ORDER="$(db_query order_db \
    "SELECT COUNT(*) FROM orders WHERE id='$ORDER_ID' AND status='PAID'")"

  if [ "$DB_ORDER" = "1" ]; then
    record "Order database persistence" "PASS" "Order exists in order_db"
  else
    record "Order database persistence" "FAIL" "Order was not found in order_db"
  fi
else
  record "Order database persistence" "SKIP" "No successful order ID available"
fi

# --------------------------------------------------
# 16. Verify payment persistence
# --------------------------------------------------

if [ -n "$PAYMENT_ID" ]; then
  DB_PAYMENT="$(db_query payment_db \
    "SELECT COUNT(*) FROM payments WHERE id='$PAYMENT_ID' AND status='SUCCEEDED'")"

  if [ "$DB_PAYMENT" = "1" ]; then
    record "Payment database persistence" "PASS" "Payment exists in payment_db"
  else
    record "Payment database persistence" "FAIL" "Payment was not found in payment_db"
  fi
else
  record "Payment database persistence" "SKIP" "No payment ID available"
fi

# --------------------------------------------------
# 17. Simulated payment failure
# --------------------------------------------------

FAILURE_PAYLOAD='{
  "customerId": "postgres-integration-failure",
  "amount": 19.99,
  "currency": "USD",
  "simulateFailure": true
}'

FAILURE_FILE="$TEMP_DIR/failure-order.json"

HTTP_CODE="$(http_request POST \
  "$BASE_URL/api/orders" "$FAILURE_FILE" "$FAILURE_PAYLOAD")"

if [ "$HTTP_CODE" = "201" ]; then
  FAILURE_DATA="$(extract_order "$FAILURE_FILE" 2>/dev/null || true)"

  if [ -n "$FAILURE_DATA" ]; then
    IFS=$'\t' read -r FAILURE_ORDER_ID FAILURE_STATUS FAILURE_PAYMENT_ID <<< "$FAILURE_DATA"

    if [ "$FAILURE_STATUS" = "PAYMENT_FAILED" ] &&
      [ -n "$FAILURE_ORDER_ID" ] &&
      [ -n "$FAILURE_PAYMENT_ID" ]; then
      record "Payment failure flow" "PASS" "Order correctly marked PAYMENT_FAILED"
    else
      record "Payment failure flow" "FAIL" "Unexpected failure response: $FAILURE_STATUS"
    fi
  else
    record "Payment failure flow" "FAIL" "Could not parse failure response"
  fi
else
  ERROR_MESSAGE="$(jq -r '.error.message // "No error message"' \
    "$FAILURE_FILE" 2>/dev/null || true)"

  record "Payment failure flow" "FAIL" "Expected HTTP 201, got ${HTTP_CODE:-no response}: $ERROR_MESSAGE"
fi

# --------------------------------------------------
# 18. Verify failed order persistence
# --------------------------------------------------

if [ -n "$FAILURE_ORDER_ID" ]; then
  DB_FAILED_ORDER="$(db_query order_db \
    "SELECT COUNT(*) FROM orders
     WHERE id='$FAILURE_ORDER_ID' AND status='PAYMENT_FAILED'")"

  if [ "$DB_FAILED_ORDER" = "1" ]; then
    record "Failed order persistence" "PASS" "Failed order exists in order_db"
  else
    record "Failed order persistence" "FAIL" "Failed order was not persisted"
  fi
else
  record "Failed order persistence" "SKIP" "No failed order ID available"
fi

# --------------------------------------------------
# 19. Verify failed payment persistence
# --------------------------------------------------

if [ -n "$FAILURE_PAYMENT_ID" ]; then
  DB_FAILED_PAYMENT="$(db_query payment_db \
    "SELECT COUNT(*) FROM payments
     WHERE id='$FAILURE_PAYMENT_ID' AND status='FAILED'")"

  if [ "$DB_FAILED_PAYMENT" = "1" ]; then
    record "Failed payment persistence" "PASS" "Failed payment exists in payment_db"
  else
    record "Failed payment persistence" "FAIL" "Failed payment was not persisted"
  fi
else
  record "Failed payment persistence" "SKIP" "No failed payment ID available"
fi

# --------------------------------------------------
# 20. Invalid order validation
# --------------------------------------------------

INVALID_PAYLOAD='{
  "customerId": "postgres-integration-invalid",
  "amount": 0,
  "currency": "USD"
}'

INVALID_FILE="$TEMP_DIR/invalid-order.json"

HTTP_CODE="$(http_request POST \
  "$BASE_URL/api/orders" "$INVALID_FILE" "$INVALID_PAYLOAD")"

if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "422" ]; then
  record "Invalid order validation" "PASS" "Invalid amount rejected with HTTP $HTTP_CODE"
else
  record "Invalid order validation" "FAIL" "Expected HTTP 400/422, got ${HTTP_CODE:-no response}"
fi

# --------------------------------------------------
# 21. Restart application services
# --------------------------------------------------

if docker compose restart order-service payment-service >/dev/null 2>&1 &&
  wait_for_healthy order-service 90 &&
  wait_for_healthy payment-service 90; then
  record "Service restart health" "PASS" "Order and Payment services recovered"
else
  record "Service restart health" "FAIL" "Services did not recover after restart"
fi

# --------------------------------------------------
# 22. Verify order and database after restart
# --------------------------------------------------

if [ -n "$ORDER_ID" ]; then
  RESTART_FILE="$TEMP_DIR/restarted-order.json"

  HTTP_CODE="$(http_request GET \
    "$BASE_URL/api/orders/$ORDER_ID" "$RESTART_FILE")"

  if [ "$HTTP_CODE" = "200" ]; then
    record "Order survives service restart" "PASS" "Order remains available after restart"
  else
    record "Order survives service restart" "FAIL" "Order unavailable after restart"
  fi

  DB_AFTER_RESTART="$(db_query order_db \
    "SELECT COUNT(*) FROM orders WHERE id='$ORDER_ID' AND status='PAID'")"

  if [ "$DB_AFTER_RESTART" = "1" ]; then
    record "Database survives service restart" "PASS" "PostgreSQL data remains available"
  else
    record "Database survives service restart" "FAIL" "Order data missing after restart"
  fi
else
  record "Order survives service restart" "SKIP" "No order ID available"
  record "Database survives service restart" "SKIP" "No order ID available"
fi

# --------------------------------------------------
# Report
# --------------------------------------------------

cat > "$REPORT_FILE" <<EOF
# PulseTrace PostgreSQL Integration Test Report

- **Date:** $TIMESTAMP
- **Environment:** development
- **Base URL:** $BASE_URL

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
echo "======================================="
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
