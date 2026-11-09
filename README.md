# PulseTrace

Microservices platform built with Node.js, Express, and PostgreSQL, containerized with Docker Compose.

## Overview

PulseTrace simulates a simple e-commerce workflow (order creation and payment processing) across three independent services. It is a hands-on project focused on building, deploying, monitoring, and troubleshooting a microservices application.

Observability capabilities will be introduced progressively throughout the project.

## Project Status

The application layer, persistence, containerization, structured logging, and metrics with a Grafana dashboard are complete. Tracing, centralized logging, alerting, orchestration, and CI/CD are planned.

| Area | Status |
|---|---|
| API Gateway, Order Service, Payment Service | Implemented |
| PostgreSQL persistence (database per service) with SQL migrations | Implemented |
| Docker images and Docker Compose stack with health checks | Implemented |
| Structured JSON logging with request ID correlation across services | Implemented |
| Prometheus metrics from every service and a provisioned Grafana dashboard | Implemented |
| Unit/API, end-to-end, Docker/PostgreSQL integration, logging correlation, and metrics tests | Implemented |
| Tracing, centralized logging, alerting | Planned |
| Kubernetes, GitHub Actions | Planned |

## Architecture at a Glance

```text
Client -> API Gateway :3000 -> Order Service :3001 -> Payment Service :3002
                                    |                        |
                                 order_db               payment_db
                                    \________ PostgreSQL ______/
```

Only the API Gateway is published to the host. Everything else lives on the private Compose network.

## Quick Start

Prerequisites: Docker with Compose v2.

```bash
cp .env.example .env          # set real passwords
docker compose up -d --build
curl http://localhost:3000/health
```

Create an order:

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"customer-123","amount":1500,"currency":"EGP"}'
```

Follow one request through all three services by its ID:

```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" -H "x-request-id: demo-1" \
  -d '{"customerId":"customer-123","amount":1500,"currency":"EGP"}'

docker compose logs --no-log-prefix api-gateway order-service payment-service \
  | jq -R -c 'fromjson? | select(.req.id == "demo-1") | {time, service, msg}'
```

Start the monitoring stack (Prometheus and Grafana) next to the application:

```bash
docker compose -f docker-compose.yaml -f docker-compose.observability.yaml up -d --build --wait
```

Open Grafana at `http://localhost:3003` (user `admin`, password `GRAFANA_ADMIN_PASSWORD` from `.env`) and Prometheus at `http://localhost:9090`.

See [Running Locally](docs/guides/running-locally.md) for the full workflow and [Observability](docs/architecture/observability.md) for the log format, metrics, and dashboard.

## Technology Stack

Implemented:

- Node.js 24 and Express 5
- PostgreSQL 17
- Docker and Docker Compose
- Pino (structured JSON logging)
- prom-client, Prometheus, and Grafana
- Node.js test runner and Supertest

Planned:

- Loki and Fluent Bit
- OpenTelemetry and Jaeger
- Alertmanager
- Kubernetes
- GitHub Actions

## Documentation

Start at the [documentation index](docs/README.md).
