# Running Locally

Two ways to run PulseTrace: the full Docker Compose stack (default), or individual services with npm.

## 1. Prerequisites

| Tool | Needed for |
|---|---|
| Docker with Compose v2 | Compose stack, PostgreSQL |
| Node.js 24 and npm | Running services or tests without Docker |
| `curl` | Manual requests, shell test scripts |
| `jq` | `tests/postgres-integration-test.sh` only |

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

### Commands

| Task | Command |
|---|---|
| Build and start | `docker compose up -d --build` |
| Status and health | `docker compose ps` |
| Follow logs | `docker compose logs -f order-service` |
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

## 3. Running Services with npm

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

## 4. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `NODE_ENV must be set` or similar on `compose up` | Missing `.env` or variable | Copy `.env.example` and fill it |
| `order-service` restarts, logs show authentication failure | Passwords in `.env` changed after the first start; roles keep the old password | `docker compose down -v` (deletes data), or `ALTER ROLE` inside PostgreSQL |
| `order-service` waits or is unhealthy | `payment-service` or `postgres` not healthy yet | `docker compose ps`, then check `docker compose logs <service>` |
| `400 SIMULATION_NOT_ALLOWED` | Stack runs with `NODE_ENV=production` | Set `NODE_ENV=development`, then recreate the app containers |
| `GET /api/orders/<text>` returns `500` | Non-UUID id reaches a UUID column | Use a UUID; see [Error Handling](../api/error-handling.md#73-known-behavior-non-uuid-identifiers) |
| Order stays `PENDING` | Payment call failed or timed out | Check `payment-service` logs; see [Request Flow](../architecture/request-flow.md#payment-service-failure) |

## 5. Next Steps

- Run the tests: [Testing](../testing/testing.md)
- Understand the containers: [Deployment](../architecture/deployment.md)
