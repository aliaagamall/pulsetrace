# PulseTrace — System Overview

## 1. Project Description

PulseTrace is a microservices-based application built with Node.js and Express.

It simulates a simple e-commerce workflow involving order creation and payment processing through independently running services, each backed by its own PostgreSQL database and packaged as a Docker container.

The project focuses on exploring how distributed applications can be monitored, debugged, and maintained using modern observability practices.

The application is intentionally kept simple so that engineering effort can focus on service communication, failure handling, monitoring, centralized logging, and distributed tracing.

## 2. System Components

PulseTrace consists of three microservices and one PostgreSQL instance:

| Component | Responsibility | Port | Published to host |
|---|---|---|---|
| API Gateway | Entry point for client requests | 3000 | Yes |
| Order Service | Order creation and retrieval | 3001 | No |
| Payment Service | Payment processing and retrieval | 3002 | No |
| PostgreSQL | Hosts `order_db` and `payment_db` | 5432 | No |

All components run on a single Docker Compose bridge network (`pulsetrace-network`). Services reach each other by Compose service name.

## 3. Application Workflow

The main application workflow is order creation.

1. A client submits an order through the API Gateway.
2. The Gateway forwards the request to the Order Service.
3. The Order Service creates an order with `PENDING` status in `order_db`.
4. The Order Service sends a payment request to the Payment Service.
5. The Payment Service stores a payment in `payment_db` and returns a successful or failed result.
6. The Order Service updates the order status.
7. The Gateway returns the final response to the client.

Possible final order statuses:

- `PAID`
- `PAYMENT_FAILED`
- `PENDING` when the payment request cannot be completed.

For the detailed request sequence, see [Request Flow](./request-flow.md).

## 4. Technology Stack

### Application

- Node.js 24
- Express.js 5
- JavaScript
- HTTP / REST
- JSON
- `pg` (node-postgres)
- Node.js Test Runner
- Supertest

### Data and Runtime

- PostgreSQL 17 (Alpine image), one database per service
- SQL migrations applied by each service at startup
- Repository pattern (PostgreSQL implementation at runtime, in-memory implementation in tests)
- Docker (multi-stage images, non-root runtime user)
- Docker Compose (health checks, dependency ordering, named volume)
- npm workspaces monorepo

### Planned Infrastructure and Observability

- Prometheus
- Grafana
- Alertmanager
- Loki
- Fluent Bit
- OpenTelemetry
- Jaeger
- Kubernetes
- GitHub Actions

The planned technologies will be introduced incrementally as the project evolves.

## 5. Current Implementation Status

| Capability | Status |
|---|---|
| API Gateway | Implemented |
| Order Service | Implemented |
| Payment Service | Implemented |
| Synchronous service communication | Implemented |
| Request validation | Implemented |
| Centralized error response format | Implemented |
| PostgreSQL persistence (database per service) | Implemented |
| SQL migrations with migration tracking | Implemented |
| In-memory repositories (test use) | Implemented |
| Docker containerization | Implemented |
| Docker Compose orchestration with health checks | Implemented |
| Graceful shutdown (SIGTERM/SIGINT) | Implemented |
| Automated API tests | Implemented |
| End-to-end tests | Implemented |
| Docker Compose and PostgreSQL integration test scripts | Implemented |
| Metrics collection | Planned |
| Centralized logging | Planned |
| Distributed tracing | Planned |
| Alerting | Planned |
| Kubernetes deployment | Planned |
| CI/CD pipeline | Planned |

## 6. Observability Goals

The main objective of PulseTrace is to progressively build a complete observability implementation.

The project aims to provide three complementary capabilities:

### Metrics

Measure application and service behavior, including:

- Request rate
- Request latency
- Error rate
- Service availability
- Resource utilization

### Logging

Centralize application logs to make it easier to:

- Investigate errors.
- Understand service behavior.
- Correlate events across services.
- Troubleshoot failures.

### Distributed Tracing

Trace individual requests across service boundaries to understand:

- Which services handled a request.
- How much time each service spent processing it.
- Where failures occurred.
- How services depend on one another.

### Alerting

Introduce actionable alerts based on application health and monitoring signals.

## 7. Development Approach

PulseTrace is developed incrementally.

Each stage introduces a specific capability, validates its behavior, and documents the implementation before moving forward.

The development approach prioritizes:

- Small, testable changes.
- Clear service boundaries.
- Reproducible local environments.
- Automated validation.
- Practical observability scenarios.
- Documentation that reflects the actual implementation.

## 8. Project Documentation

| Document | Description |
|---|---|
| [Architecture](./architecture.md) | Overall system architecture and design decisions |
| [Deployment](./deployment.md) | Docker images, Compose topology, startup order, configuration |
| [Data Model](./data-model.md) | Databases, tables, migrations, repositories |
| [Request Flow](./request-flow.md) | Order creation sequence and failure scenarios |
| [API Contracts](../api/api-contracts.md) | Service endpoints, request formats, and responses |
| [Error Handling](../api/error-handling.md) | Error codes and failure behavior |
| [Running Locally](../guides/running-locally.md) | Setup and day-to-day commands |
| [Testing](../testing/testing.md) | Test layers, how to run them, reports |
