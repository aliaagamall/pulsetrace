# PulseTrace

A local-first microservices platform built with Node.js, Express, and PostgreSQL, containerized with Docker Compose.

## Overview

PulseTrace simulates a simple e-commerce workflow (order creation and payment processing) across three independent services. It is a hands-on project focused on building, deploying, monitoring, and troubleshooting a microservices application.

Observability capabilities will be introduced progressively throughout the project.

## Project Status

The application layer, persistence, and containerization are complete. Observability, orchestration, and CI/CD are planned.

| Area | Status |
|---|---|
| API Gateway, Order Service, Payment Service | Implemented |
| PostgreSQL persistence (database per service) with SQL migrations | Implemented |
| Docker images and Docker Compose stack with health checks | Implemented |
| Unit/API, end-to-end, and Docker/PostgreSQL integration tests | Implemented |
| Metrics, logging, tracing, alerting | Planned |
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

See [Running Locally](docs/guides/running-locally.md) for the full workflow.

## Technology Stack

Implemented:

- Node.js 24 and Express 5
- PostgreSQL 17
- Docker and Docker Compose
- Node.js test runner and Supertest

Planned:

- Prometheus and Grafana
- Loki and Fluent Bit
- OpenTelemetry and Jaeger
- Alertmanager
- Kubernetes
- GitHub Actions

## Documentation

Start at the [documentation index](docs/README.md).
