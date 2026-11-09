#!/usr/bin/env bash
set -uo pipefail

# Generates mixed traffic so every Grafana panel has data.

BASE_URL="${BASE_URL:-http://localhost:3000}"
ROUNDS="${1:-20}"

post_order() {
  curl -s -o /dev/null -X POST "$BASE_URL/api/orders" \
    -H "Content-Type: application/json" -d "$1"
}

echo "== 1. normal traffic: PAID, PAYMENT_FAILED, 404, 400 ($ROUNDS rounds) =="
for i in $(seq 1 "$ROUNDS"); do
  post_order '{"customerId":"c1","amount":100,"currency":"EGP"}'
  post_order '{"customerId":"c2","amount":50,"currency":"EGP","simulateFailure":true}'
  curl -s -o /dev/null "$BASE_URL/api/orders/not-a-uuid"
  post_order '{"customerId":"c3","amount":-1,"currency":"EGP"}'
  sleep 1
done

echo "== 2. payment service down: orders stay PENDING (~3s each) =="
docker compose stop payment-service >/dev/null
for i in 1 2 3 4 5; do
  post_order '{"customerId":"c4","amount":75,"currency":"EGP"}'
done
docker compose start payment-service >/dev/null

echo "== 3. order service down: gateway 503 upstream errors =="
docker compose stop order-service >/dev/null
for i in $(seq 1 10); do
  post_order '{"customerId":"c5","amount":20,"currency":"EGP"}'
  sleep 1
done
docker compose start order-service >/dev/null

echo "== waiting for services to recover =="
docker compose up -d --wait >/dev/null 2>&1

echo "Done. Open http://localhost:3003 (set the time range to Last 15 minutes)."