#!/usr/bin/env bash

set -uo pipefail

# Configuration
# The running stack must also use development mode for the failure scenario.
export NODE_ENV=development

BASE_URL="${BASE_URL:-http://localhost:3000}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3003}"
COMPOSE=(docker compose -f docker-compose.yaml -f docker-compose.observability.yaml)
DASHBOARD_FILE="observability/grafana/dashboards/pulsetrace-overview.json"

TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
REPORT_DIR="tests/reports"
REPORT_FILE="$REPORT_DIR/metrics-test-$TIMESTAMP.md"
TEMP_DIR="$(mktemp -d)"

PASSED=0
FAILED=0
SKIPPED=0

mkdir -p "$REPORT_DIR"

trap 'rm -rf "$TEMP_DIR"' EXIT

REPORT_ROWS=""

# Grafana admin password: environment first, then .env.
GRAFANA_PASSWORD="${GRAFANA_ADMIN_PASSWORD:-}"
if [ -z "$GRAFANA_PASSWORD" ] && [ -f .env ]; then
  GRAFANA_PASSWORD="$(grep -E '^GRAFANA_ADMIN_PASSWORD=' .env | tail -1 | cut -d= -f2-)"
fi
export GRAFANA_ADMIN_PASSWORD="${GRAFANA_PASSWORD:-unset}"

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

container_healthy() {
  local id

  id="$("${COMPOSE[@]}" ps -q "$1" 2>/dev/null)"

  [ -n "$id" ] || return 1

  [ "$(docker inspect \
    --format '{{.State.Health.Status}}' "$id" 2>/dev/null)" = "healthy" ]
}

# Prints the first value of an instant Prometheus query (empty if no data).
prom_value() {
  curl -s --data-urlencode "query=$1" "$PROMETHEUS_URL/api/v1/query" 2>/dev/null |
    jq -r '.data.result[0].value[1] // empty' 2>/dev/null
}

# Prints how many series an instant Prometheus query returns.
prom_count() {
  curl -s --data-urlencode "query=$1" "$PROMETHEUS_URL/api/v1/query" 2>/dev/null |
    jq -r '.data.result | length' 2>/dev/null
}

# Reads /metrics from inside a container (Order and Payment ports are private).
container_metrics() {
  "${COMPOSE[@]}" exec -T "$1" node -e \
    "fetch('http://127.0.0.1:$2/metrics').then(r=>r.text()).then(t=>process.stdout.write(t))" \
    2>/dev/null
}

# Waits until a Prometheus query returns at least one series (max 40 s).
wait_for_series() {
  local elapsed=0

  while [ "$elapsed" -lt 40 ]; do
    if [ "$(prom_count "$1")" -ge 1 ] 2>/dev/null; then
      return 0
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  return 1
}

# --------------------------------------------------
# Start
# --------------------------------------------------

echo
echo "PulseTrace Metrics Tests"
echo "========================"
echo

# --------------------------------------------------
# 1. Compose configuration (both files)
# --------------------------------------------------

if "${COMPOSE[@]}" config --quiet >/dev/null 2>&1; then
  record "Compose configuration" "PASS" "Both Compose files are valid together"
else
  record "Compose configuration" "FAIL" "Invalid Compose configuration"
fi

# --------------------------------------------------
# 2. Containers are healthy
# --------------------------------------------------

UNHEALTHY=""

for service in payment-service order-service api-gateway prometheus grafana; do
  if ! container_healthy "$service"; then
    UNHEALTHY+="$service "
  fi
done

if [ -z "$UNHEALTHY" ]; then
  record "Containers health" "PASS" "Services, Prometheus, and Grafana are healthy"
else
  record "Containers health" "FAIL" "Not healthy: ${UNHEALTHY% }"
fi

# --------------------------------------------------
# 3. Prometheus targets
# --------------------------------------------------

TARGETS="$(curl -s "$PROMETHEUS_URL/api/v1/targets" 2>/dev/null |
  jq -r '.data.activeTargets[] | select(.health == "up") | .labels.job' 2>/dev/null |
  sort | tr '\n' ' ')"

if [ "${TARGETS% }" = "api-gateway order-service payment-service" ]; then
  record "Prometheus targets" "PASS" "All three targets are up"
else
  record "Prometheus targets" "FAIL" "Targets up: ${TARGETS:-none}"
fi

# --------------------------------------------------
# 4-6. /metrics of each service
# --------------------------------------------------

GATEWAY_METRICS="$(curl -s "$BASE_URL/metrics" 2>/dev/null)"

if grep -q '^process_cpu_user_seconds_total' <<< "$GATEWAY_METRICS"; then
  record "api-gateway /metrics" "PASS" "Default process metrics are exposed"
else
  record "api-gateway /metrics" "FAIL" "Process metrics missing"
fi

ORDER_METRICS="$(container_metrics order-service 3001)"

if grep -q '^process_cpu_user_seconds_total' <<< "$ORDER_METRICS"; then
  record "order-service /metrics" "PASS" "Default process metrics are exposed"
else
  record "order-service /metrics" "FAIL" "Process metrics missing"
fi

PAYMENT_METRICS="$(container_metrics payment-service 3002)"

if grep -q '^process_cpu_user_seconds_total' <<< "$PAYMENT_METRICS"; then
  record "payment-service /metrics" "PASS" "Default process metrics are exposed"
else
  record "payment-service /metrics" "FAIL" "Process metrics missing"
fi

# --------------------------------------------------
# 7. Business metrics increase after real orders
# --------------------------------------------------

PAID_BEFORE="$(prom_value 'sum(orders_created_total{status="PAID"})')"
FAILED_BEFORE="$(prom_value 'sum(payments_processed_total{status="FAILED"})')"
PAID_BEFORE="${PAID_BEFORE:-0}"
FAILED_BEFORE="${FAILED_BEFORE:-0}"

curl -s -o /dev/null -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"metrics-success","amount":10,"currency":"USD"}'

curl -s -o /dev/null -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"metrics-failure","amount":10,"currency":"USD","simulateFailure":true}'

curl -s -o /dev/null "$BASE_URL/api/orders/not-a-uuid"

# Wait two scrape intervals so Prometheus has the new values.
sleep 25

PAID_AFTER="$(prom_value 'sum(orders_created_total{status="PAID"})')"
FAILED_AFTER="$(prom_value 'sum(payments_processed_total{status="FAILED"})')"
PAID_AFTER="${PAID_AFTER:-0}"
FAILED_AFTER="${FAILED_AFTER:-0}"

if [ "${PAID_AFTER%.*}" -gt "${PAID_BEFORE%.*}" ] 2>/dev/null; then
  record "Orders PAID counted" "PASS" "orders_created_total went from $PAID_BEFORE to $PAID_AFTER"
else
  record "Orders PAID counted" "FAIL" "Expected an increase, got $PAID_BEFORE -> $PAID_AFTER"
fi

if [ "${FAILED_AFTER%.*}" -gt "${FAILED_BEFORE%.*}" ] 2>/dev/null; then
  record "Payments FAILED counted" "PASS" "payments_processed_total went from $FAILED_BEFORE to $FAILED_AFTER"
else
  record "Payments FAILED counted" "FAIL" "Expected an increase, got $FAILED_BEFORE -> $FAILED_AFTER"
fi

# --------------------------------------------------
# 9. Route labels use patterns, never real IDs
# --------------------------------------------------

BAD_ROUTES="$(curl -s --data-urlencode \
  'query=http_requests_total{route=~".*[0-9a-f]{8}-[0-9a-f]{4}-.*"}' \
  "$PROMETHEUS_URL/api/v1/query" 2>/dev/null | jq -r '.data.result | length' 2>/dev/null)"

if [ "${BAD_ROUTES:-1}" = "0" ]; then
  record "Route labels use patterns" "PASS" "No route label contains an ID"
else
  record "Route labels use patterns" "FAIL" "Found $BAD_ROUTES series with an ID in the route"
fi

# --------------------------------------------------
# 10. Health and metrics requests are not counted
# --------------------------------------------------

PROBE_SERIES="$(prom_count 'http_requests_total{route=~"/health|/metrics"}')"

if [ "${PROBE_SERIES:-1}" = "0" ]; then
  record "Probes not counted" "PASS" "No /health or /metrics series"
else
  record "Probes not counted" "FAIL" "Found $PROBE_SERIES probe series"
fi

# --------------------------------------------------
# 11. Probes are not logged
# --------------------------------------------------

PROBE_LOGS=0

for service in api-gateway order-service payment-service; do
  count="$("${COMPOSE[@]}" logs --no-log-prefix --since 10m "$service" 2>/dev/null |
    grep -c -E '"path":"/(metrics|health)"' || true)"
  PROBE_LOGS=$((PROBE_LOGS + count))
done

if [ "$PROBE_LOGS" -eq 0 ]; then
  record "Probes not logged" "PASS" "No /health or /metrics log entries"
else
  record "Probes not logged" "FAIL" "Found $PROBE_LOGS probe log entries"
fi

# --------------------------------------------------
# 12. Grafana provisioning
# --------------------------------------------------

DATASOURCES="$(curl -s -u "admin:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/datasources" 2>/dev/null |
  jq -r '.[].name' 2>/dev/null | tr '\n' ' ')"

if grep -q 'Prometheus' <<< "$DATASOURCES"; then
  record "Grafana data source" "PASS" "Prometheus data source is provisioned"
else
  record "Grafana data source" "FAIL" "Data sources found: ${DATASOURCES:-none}"
fi

DASHBOARDS="$(curl -s -u "admin:$GRAFANA_PASSWORD" \
  "$GRAFANA_URL/api/search?query=PulseTrace" 2>/dev/null |
  jq -r '.[].title' 2>/dev/null | tr '\n' ',')"

if grep -q 'PulseTrace Overview' <<< "$DASHBOARDS"; then
  record "Grafana dashboard" "PASS" "PulseTrace Overview is provisioned"
else
  record "Grafana dashboard" "FAIL" "Dashboards found: ${DASHBOARDS:-none}"
fi

# --------------------------------------------------
# 13. Dashboard file and its queries
# --------------------------------------------------

if jq empty "$DASHBOARD_FILE" >/dev/null 2>&1; then
  record "Dashboard JSON" "PASS" "File is valid JSON"
else
  record "Dashboard JSON" "FAIL" "$DASHBOARD_FILE is not valid JSON"
fi

# Every query must be accepted by Prometheus (empty results are fine).
BAD_QUERIES=0
QUERY_COUNT=0

while IFS= read -r expr; do
  [ -n "$expr" ] || continue
  QUERY_COUNT=$((QUERY_COUNT + 1))

  status="$(curl -s --data-urlencode "query=$expr" \
    "$PROMETHEUS_URL/api/v1/query" 2>/dev/null | jq -r '.status' 2>/dev/null)"

  if [ "$status" != "success" ]; then
    BAD_QUERIES=$((BAD_QUERIES + 1))
  fi
done < <(jq -r '.panels[].targets[].expr' "$DASHBOARD_FILE" 2>/dev/null)

if [ "$QUERY_COUNT" -gt 0 ] && [ "$BAD_QUERIES" -eq 0 ]; then
  record "Dashboard queries" "PASS" "All $QUERY_COUNT queries are valid in Prometheus"
else
  record "Dashboard queries" "FAIL" "$BAD_QUERIES of $QUERY_COUNT queries failed"
fi

# --------------------------------------------------
# Report
# --------------------------------------------------

TOTAL=$((PASSED + FAILED + SKIPPED))

cat > "$REPORT_FILE" <<EOF
# PulseTrace Metrics Test Report

- **Date:** $TIMESTAMP
- **Environment:** development
- **Base URL:** $BASE_URL
- **Prometheus:** $PROMETHEUS_URL
- **Grafana:** $GRAFANA_URL

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
echo "========================"
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