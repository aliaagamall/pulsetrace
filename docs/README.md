# PulseTrace Documentation

## Reading Order

| # | Document | Read it to learn |
|---|---|---|
| 1 | [System Overview](architecture/system-overview.md) | What the project is, components, implementation status |
| 2 | [Architecture](architecture/architecture.md) | Topology, service responsibilities, layering, principles |
| 3 | [Request Flow](architecture/request-flow.md) | Sequence diagrams for success, failure, retrieval, startup |
| 4 | [Deployment](architecture/deployment.md) | Docker images, Compose topology, startup order, configuration |
| 5 | [Data Model](architecture/data-model.md) | Databases, tables, migrations, repositories |
| 6 | [Observability](architecture/observability.md) | Structured logs, request ID correlation, metrics, Grafana dashboard, roadmap |
| 7 | [API Contracts](api/api-contracts.md) | Endpoints, request and response formats |
| 8 | [Error Handling](api/error-handling.md) | Error codes, failure behavior, consistency limits |
| 9 | [Running Locally](guides/running-locally.md) | Setup, commands, troubleshooting |
| 10 | [Testing](guides/testing.md) | Test layers, how to run, reports |

## Folder Layout

```text
docs/
├── README.md
├── architecture/
│   ├── system-overview.md
│   ├── architecture.md
│   ├── request-flow.md
│   ├── deployment.md
│   ├── data-model.md
│   └── observability.md
├── api/
│   ├── api-contracts.md
│   └── error-handling.md
└── guides/
    ├── running-locally.md
    └── testing.md
```

## Where to Look

| Question | Document |
|---|---|
| Which containers run and in what order? | [Deployment](architecture/deployment.md) |
| What does `order_db` contain? | [Data Model](architecture/data-model.md) |
| How do I add a migration? | [Data Model](architecture/data-model.md#4-migrations) |
| What happens if the Payment Service is down? | [Request Flow](architecture/request-flow.md#payment-service-failure) |
| Why is my order `PENDING`? | [Error Handling](api/error-handling.md#8-order-state-consistency) |
| How do I follow one request across services? | [Observability](architecture/observability.md#7-tracing-one-request) |
| What does a log line look like? | [Observability](architecture/observability.md#4-log-format) |
| How do I run the stack? | [Running Locally](guides/running-locally.md) |
| Which metrics exist and what do the labels mean? | [Observability](architecture/observability.md#8-metrics-design) |
| How do I open the dashboard and fill it with data? | [Running Locally](guides/running-locally.md#3-metrics-and-dashboards) |
| Which containers does the monitoring stack add? | [Deployment](architecture/deployment.md#10-observability-stack) |
| Which test do I run after a change? | [Testing](guides/testing.md#9-choosing-a-layer) |

## Scope Note

These documents describe the implemented system: services, PostgreSQL persistence, Docker, Docker Compose, structured logging with request ID correlation, Prometheus metrics, and the Grafana dashboard. Tracing, centralized logging, alerting, Kubernetes, and CI/CD are planned and are described only as roadmap items until they are implemented and verified.
