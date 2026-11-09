# Running Locally

Two ways to run PulseTrace: the full Docker Compose stack (default), or individual services with npm.

## 1. Prerequisites

| Tool | Needed for |
|---|---|
| Docker with Compose v2 | Compose stack, PostgreSQL |
| Node.js 24 and npm | Running services or tests without Docker |
| `curl` | Manual requests, shell test scripts |
| `jq` | Reading logs, `tests/postgres-integration-test.sh`, `tests/logging-correlation-test.sh`, `tests/metrics-test.sh` |

## 2. Docker Compose (default)

### Setup

```bash
cp .env.example .env
```

Edit `.env` and replace every `change_me_*` value. `.env` is git-ignored and docker-ignored.

| Variable | Meaning |
|---|---|
| `NODE_ENV` | `development` allows `simulateFailure`; `production` rejects it |
| `POSTGRES_PASSWORD` | Admin role `pulsetrace_admin` |
| `ORDER_DB_PASSWORD` | Role `order_service` |
| `PAYMENT_DB_PASSWORD` | Role `payment_service` |
| `GRAFANA_ADMIN_PASSWORD` | Grafana `admin` user (only needed for the observability stack) |

### Commands

| Task | Command |
|---|---|
| Build and start | `docker compose up -d --build` |
| Status and health | `docker compose ps` |
| Follow logs (JSON lines) | `docker compose logs -f order-service` |
| Stop, keep data | `docker compose down` |
| Stop, delete data | `docker compose down -v` |
| Recreate app containers only | `docker compose up -d --force-recreate api-gateway order-service payment-service` |

Services become healthy in this order: `postgres`, `payment-service`, `order-service`, `api-gateway` (see [Deployment](../architecture/deployment.md#3-startup-order)).

### Try it

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"customer-123","amount":1500,"currency":"EGP"}'

curl http://localhost:3000/api/orders/<order-id>
```

Simulated payment failure (requires `NODE_ENV=development`):

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"customer-123","amount":1500,"currency":"EGP","simulateFailure":true}'
```

The order comes back with `status: "PAYMENT_FAILED"`. With `NODE_ENV=production` the same request returns `400 SIMULATION_NOT_ALLOWED`.

### Read the logs

Services write one JSON object per line. Use `jq` to read them:

```bash
# one service, readable
docker compose logs --no-log-prefix api-gateway | jq -R 'fromjson?'

# follow one request across all services by its ID
curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" -H "x-request-id: demo-1" \
  -d '{"customerId":"customer-123","amount":1500,"currency":"EGP"}'

docker compose logs --no-log-prefix api-gateway order-service payment-service \
  | jq -R -c 'fromjson? | select(.req.id == "demo-1") | {time, service, msg}' \
  | sort

# only errors
docker compose logs --no-log-prefix order-service \
  | jq -R -c 'fromjson? | select(.level == "error")'
```

Without the `x-request-id` header the Gateway generates an ID and returns it in the response headers (`curl -i`). The log format and more queries are in [Observability](../architecture/observability.md).

### Inspect the databases

PostgreSQL is not published to the host. Use the container:

```bash
docker compose exec postgres psql -U pulsetrace_admin -d order_db \
  -c "SELECT id, status, payment_id FROM orders ORDER BY created_at DESC LIMIT 5;"

docker compose exec postgres psql -U pulsetrace_admin -d payment_db \
  -c "SELECT id, order_id, status FROM payments ORDER BY created_at DESC LIMIT 5;"

docker compose exec postgres psql -U pulsetrace_admin -d order_db \
  -c "SELECT * FROM schema_migrations;"
```

### Call internal services

Order and Payment ports are not published. Reach them from inside the network:

```bash
docker compose exec order-service node -e \
  "fetch('http://payment-service:3002/health').then(r=>r.text()).then(console.log)"
```

## 3. Metrics and Dashboards

The monitoring stack (Prometheus and Grafana) lives in a second Compose file. Start both files together:

`````bash
export NODE_ENV=development
docker compose -f docker-compose.yaml -f docker-compose.observability.yaml up -d --build --wait
`````

Set `GRAFANA_ADMIN_PASSWORD` in `.env` first.

| What | Where |
|---|---|
| Grafana dashboard | `http://localhost:3003` (user `admin`, password from `.env`) |
| Prometheus targets | `http://localhost:9090/targets` (three targets should be `up`) |
| Gateway metrics | `http://localhost:3000/metrics` |

Order and Payment metrics are not published. Read them from inside the network:

`````bash
docker compose exec -T order-service node -e \
  "fetch('http://127.0.0.1:3001/metrics').then(r=>r.text()).then(console.log)"
`````

Stop the monitoring stack without touching the application:

`````bash
docker compose -f docker-compose.yaml -f docker-compose.observability.yaml stop prometheus grafana
`````

### Fill the dashboard with data

Normal traffic leaves some panels empty (upstream errors and `PENDING` orders need failures). The traffic generator creates every scenario:

`````bash
./scripts/generate-traffic.sh 20
`````

It sends normal orders, stops the Payment Service to create `PENDING` orders, and stops the Order Service to create Gateway `503` errors. It takes about 1.5 minutes and restarts the services at the end. Set the dashboard time range to the last 15 minutes afterwards.

### Read the numbers from the terminal

`````bash
curl -s --data-urlencode 'query=sum(orders_created_total) by (status)' \
  http://localhost:9090/api/v1/query | jq -c '.data.result[] | {status: .metric.status, value: .value[1]}'
`````

More queries are in [Observability](../architecture/observability.md#12-useful-queries).

## 4. Running Services with npm

Useful for debugging with `node --watch`. Install once from the repository root:

```bash
npm ci
```

Services listen on `3000`, `3001`, and `3002` of `localhost`, and the default client URLs already point there. Order and Payment need PostgreSQL, so start only the database through Compose, but note that PostgreSQL's port is not published by the default Compose file. Either publish it in a local override file, or use the in-memory mode below.

| Task | Command |
|---|---|
| Gateway (watch mode) | `npm run dev:gateway` |
| Order Service (watch mode) | `npm run dev:orders` |
| Payment Service (watch mode) | `npm run dev:payments` |
| Production-style start | `npm run start:gateway`, `start:orders`, `start:payments` |

`server.js` of Order and Payment always uses PostgreSQL, so it needs `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` set. The in-memory repositories are used only when the app is created in code without a repository, which is what the tests do.

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `NODE_ENV must be set` or similar on `compose up` | Missing `.env` or variable | Copy `.env.example` and fill it |
| `order-service` restarts, logs show authentication failure | Passwords in `.env` changed after the first start; roles keep the old password | `docker compose down -v` (deletes data), or `ALTER ROLE` inside PostgreSQL |
| `order-service` waits or is unhealthy | `payment-service` or `postgres` not healthy yet | `docker compose ps`, then check `docker compose logs <service>` |
| `400 SIMULATION_NOT_ALLOWED` | Stack runs with `NODE_ENV=production` | Set `NODE_ENV=development`, then recreate the app containers |
| `404 ORDER_NOT_FOUND` for an ID you just copied | The ID is not a complete UUID, or the order was created before `docker compose down -v` | Check the full ID; see [Error Handling](../api/error-handling.md#73-malformed-identifiers) |
| Prometheus target is `down` | The service is stopped or restarting | `docker compose ps`, then wait for the service to become healthy |
| Grafana panel shows "No data" | The event has not happened yet (upstream errors need a failure), or the time range is too short | Run `./scripts/generate-traffic.sh`, set the range to 15 minutes |
| Grafana does not start, `GRAFANA_ADMIN_PASSWORD must be set` | Variable missing from `.env` | Add it and start the stack again |
| Error `network pulsetrace_pulsetrace-network not found` | The application stack is not running | Start `docker compose up -d` first, or use both files together |
| Order stays `PENDING` | Payment call failed or timed out | Search the logs by the request ID and look for `Payment processing failed, order left PENDING`; see [Request Flow](../architecture/request-flow.md#payment-service-failure) |

## 6. Next Steps

- Run the tests: [Testing](testing.md)
- Understand the containers: [Deployment](../architecture/deployment.md)
