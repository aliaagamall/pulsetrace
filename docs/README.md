# PulseTrace Documentation

## Reading Order

| # | Document | Read it to learn |
|---|---|---|
| 1 | [System Overview](architecture/system-overview.md) | What the project is, components, implementation status |
| 2 | [Architecture](architecture/architecture.md) | Topology, service responsibilities, layering, principles |
| 3 | [Request Flow](architecture/request-flow.md) | Sequence diagrams for success, failure, retrieval, startup |
| 4 | [Deployment](architecture/deployment.md) | Docker images, Compose topology, startup order, configuration |
| 5 | [Data Model](architecture/data-model.md) | Databases, tables, migrations, repositories |
| 6 | [API Contracts](api/api-contracts.md) | Endpoints, request and response formats |
| 7 | [Error Handling](api/error-handling.md) | Error codes, failure behavior, consistency limits |
| 8 | [Running Locally](guides/running-locally.md) | Setup, commands, troubleshooting |
| 9 | [Testing](testing/testing.md) | Test layers, how to run, reports |

## Folder Layout

```text
docs/
├── README.md
├── architecture/
│   ├── system-overview.md
│   ├── architecture.md
│   ├── request-flow.md
│   ├── deployment.md
│   └── data-model.md
├── api/
│   ├── api-contracts.md
│   └── error-handling.md
├── guides/
│   └── running-locally.md
└── testing/
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
| How do I run the stack? | [Running Locally](guides/running-locally.md) |
| Which test do I run after a change? | [Testing](testing/testing.md#7-choosing-a-layer) |

## Scope Note

These documents describe the implemented system: services, PostgreSQL persistence, Docker, and Docker Compose. Metrics, logging, tracing, alerting, Kubernetes, and CI/CD are planned and are described only as roadmap items until they are implemented and verified.
