#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="docker-compose.yaml"
REPORT_DIR="tests/reports"
TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
REPORT_FILE="$REPORT_DIR/docker-compose-test-$TIMESTAMP.md"
TMP_DIR="$(mktemp -d)"
RESULTS_FILE="$TMP_DIR/results.md"
PASS_COUNT=0
FAIL_COUNT=0
ORDER_ID=""

mkdir -p "$REPORT_DIR"
: > "$RESULTS_FILE"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

record() {
  local name="$1"
  local status="$2"
  local details="$3"

  details="${details//$'\n'/ }"
  details="${details//|/\\|}"

  printf '| %s | **%s** | %s |\n' "$name" "$status" "$details" >> "$RESULTS_FILE"

  if [[ "$status" == "PASS" ]]; then
    ((PASS_COUNT += 1))
  else
    ((FAIL_COUNT += 1))
  fi
}

fail_if() {
  local name="$1"
  local details="$2"
  record "$name" "FAIL" "$details"
}

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Error: $COMPOSE_FILE was not found. Run this script from its saved location inside the repository."
  exit 1
fi

if [[ -z "${NODE_ENV:-}" ]]; then
  echo "Set NODE_ENV first: export NODE_ENV=production"
  exit 1
fi

if [[ "$NODE_ENV" != "production" ]]; then
  echo "This test expects production mode. Run: export NODE_ENV=production"
  exit 1
fi

for command in docker curl node; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command"
    exit 1
  fi
done

if docker compose -f "$COMPOSE_FILE" config --quiet; then
  record "Compose configuration" "PASS" "Configuration is valid."
else
  record "Compose configuration" "FAIL" "docker compose config failed."
fi

check_health() {
  local service="$1"
  local container_id
  local health

  container_id="$(docker compose -f "$COMPOSE_FILE" ps -q "$service")"
  if [[ -z "$container_id" ]]; then
    fail_if "$service health" "Container is not running."
    return
  fi

  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container_id")"
  if [[ "$health" == "healthy" ]]; then
    record "$service health" "PASS" "Container is healthy."
  else
    fail_if "$service health" "Expected healthy, received: $health."
  fi
}

check_health "payment-service"
check_health "order-service"
check_health "api-gateway"

gateway_health="$(curl -sS -o "$TMP_DIR/gateway-health.json" -w '%{http_code}' http://localhost:3000/health || true)"
if [[ "$gateway_health" == "200" ]] && grep -q '"service":"api-gateway"' "$TMP_DIR/gateway-health.json"; then
  record "Gateway health endpoint" "PASS" "HTTP 200."
else
  fail_if "Gateway health endpoint" "Expected HTTP 200; received $gateway_health."
fi

order_to_payment="$(docker compose -f "$COMPOSE_FILE" exec -T order-service node -e "fetch('http://payment-service:3002/health').then(async r => { console.log(r.status); process.exit(r.ok ? 0 : 1); }).catch(() => process.exit(1))" 2>&1 || true)"
if grep -q '^200$' <<< "$order_to_payment"; then
  record "Order to Payment connectivity" "PASS" "Service DNS resolved and returned HTTP 200."
else
  fail_if "Order to Payment connectivity" "$order_to_payment"
fi

gateway_to_order="$(docker compose -f "$COMPOSE_FILE" exec -T api-gateway node -e "fetch('http://order-service:3001/health').then(async r => { console.log(r.status); process.exit(r.ok ? 0 : 1); }).catch(() => process.exit(1))" 2>&1 || true)"
if grep -q '^200$' <<< "$gateway_to_order"; then
  record "Gateway to Order connectivity" "PASS" "Service DNS resolved and returned HTTP 200."
else
  fail_if "Gateway to Order connectivity" "$gateway_to_order"
fi

create_status="$(curl -sS -o "$TMP_DIR/create-order.json" -w '%{http_code}' \
  -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"compose-test-customer","amount":250,"currency":"USD"}' || true)"

if [[ "$create_status" == "201" ]]; then
  ORDER_ID="$(node -e "const r=require(process.argv[1]); process.stdout.write(r.data?.id || '')" "$TMP_DIR/create-order.json")"
  order_state="$(node -e "const r=require(process.argv[1]); process.stdout.write(r.data?.status || '')" "$TMP_DIR/create-order.json")"
  if [[ -n "$ORDER_ID" && "$order_state" == "PAID" ]]; then
    record "Create order (end-to-end)" "PASS" "HTTP 201; order status is PAID; ID: $ORDER_ID."
  else
    fail_if "Create order (end-to-end)" "HTTP 201 received, but order ID or PAID status is missing."
  fi
else
  fail_if "Create order (end-to-end)" "Expected HTTP 201; received $create_status."
fi

if [[ -n "$ORDER_ID" ]]; then
  get_status="$(curl -sS -o "$TMP_DIR/get-order.json" -w '%{http_code}' \
    "http://localhost:3000/api/orders/$ORDER_ID" || true)"
  if [[ "$get_status" == "200" ]]; then
    retrieved_id="$(node -e "const r=require(process.argv[1]); process.stdout.write(r.data?.id || '')" "$TMP_DIR/get-order.json")"
    if [[ "$retrieved_id" == "$ORDER_ID" ]]; then
      record "Retrieve created order" "PASS" "HTTP 200; returned the same order ID."
    else
      fail_if "Retrieve created order" "Response did not contain the created order ID."
    fi
  else
    fail_if "Retrieve created order" "Expected HTTP 200; received $get_status."
  fi
else
  fail_if "Retrieve created order" "Skipped because order creation did not return an ID."
fi

simulation_status="$(curl -sS -o "$TMP_DIR/simulation.json" -w '%{http_code}' \
  -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"compose-test-failure","amount":150,"currency":"USD","simulateFailure":true}' || true)"

if [[ "$simulation_status" == "400" ]] && grep -q 'SIMULATION_NOT_ALLOWED' "$TMP_DIR/simulation.json"; then
  record "Production simulation guard" "PASS" "HTTP 400; simulation is blocked in production."
else
  fail_if "Production simulation guard" "Expected HTTP 400 with SIMULATION_NOT_ALLOWED; received $simulation_status."
fi

{
  echo "# Docker Compose Test Report"
  echo
  echo "| Field | Value |"
  echo "|---|---|"
  echo "| Date | $(date '+%Y-%m-%d %H:%M:%S %Z') |"
  echo "| Compose file | \`$COMPOSE_FILE\` |"
  echo "| NODE_ENV | \`$NODE_ENV\` |"
  echo "| Result | **$([[ "$FAIL_COUNT" -eq 0 ]] && echo "PASSED" || echo "FAILED")** |"
  echo "| Passed | $PASS_COUNT |"
  echo "| Failed | $FAIL_COUNT |"
  echo
  echo "## Test Results"
  echo
  echo "| Test | Result | Details |"
  echo "|---|---|---|"
  cat "$RESULTS_FILE"
  echo
  echo "## Notes"
  echo
  echo "- The script tests the currently running Compose stack; it does not start or stop containers."
  echo "- Order and payment data are stored in memory and may be lost when containers restart."
  echo "- The production simulation test expects \`NODE_ENV=production\`."
} > "$REPORT_FILE"

echo
echo "Test report: $REPORT_FILE"
echo "Passed: $PASS_COUNT | Failed: $FAIL_COUNT"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
