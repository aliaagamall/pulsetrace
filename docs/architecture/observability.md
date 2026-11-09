# Observability

## 1. Overview

PulseTrace builds observability in stages. Each stage is implemented, tested, and documented before the next one starts.

| Capability | Status | Notes |
|---|---|---|
| Structured JSON logging | Implemented | Pino, one logger per service |
| Request ID correlation across services | Implemented | `x-request-id` header |
| Logging correlation test | Implemented | `tests/logging-correlation-test.sh` |
| Metrics (Prometheus) | Implemented | `/metrics` on every service, scraped every 10 s |
| Dashboards (Grafana) | Implemented | Provisioned from files |
| Metrics test | Implemented | `tests/metrics-test.sh` |
| Distributed tracing (OpenTelemetry, Jaeger) | Planned | |
| Centralized logging (Fluent Bit, Loki) | Planned | |
| Alerting (Alertmanager) | Planned | |

This document describes what is implemented today: structured logs, request ID correlation, metrics, and the Grafana dashboard. Planned capabilities are listed in [section 14](#14-roadmap).

## 2. Logging Design

Every service writes one JSON object per line to standard output. Docker captures the output, and `docker compose logs` reads it.

| Component | Where | Responsibility |
|---|---|---|
| `config/logger.js` | Each service | Creates the Pino logger: service name, ISO timestamp, text level, error serializer |
| `middleware/request-id.js` | Each service | Accepts or generates the request ID |
| `pino-http` | `app.js` of each service | Logs one line per request and exposes `req.log` and `req.id` |
| Business logs | Order and Payment services | Log the result of payment processing with the request logger |

The Gateway has its own copy of the two helper files. Services are built and deployed independently, so they do not share a package.

Controllers pass the request logger to the service layer through a small `context` argument (`{ requestId, logger }`). Code that is called without a context, such as unit tests, simply does not log.

## 3. Request ID Correlation

A request ID links the log lines that one client request produces in all three services.

```mermaid
sequenceDiagram
    participant C as Client
    participant G as API Gateway
    participant O as Order Service
    participant P as Payment Service

    C->>G: POST /api/orders (x-request-id: abc-123, optional)
    Note over G: Accept abc-123 or generate a UUID
    G->>O: POST /orders (x-request-id: abc-123)
    O->>P: POST /payments (x-request-id: abc-123)
    P-->>O: 201 (logs request abc-123)
    O-->>G: 201 (logs request abc-123)
    G-->>C: 201 (x-request-id: abc-123)
```

How the ID is chosen:

```mermaid
flowchart TD
    In["Incoming request"] --> H{"x-request-id header present?"}
    H -- "No" --> Gen["Generate a UUID"]
    H -- "Yes" --> V{"Matches ^[A-Za-z0-9-]{1,64}$ ?"}
    V -- "Yes" --> Keep["Use the supplied ID"]
    V -- "No" --> Gen
    Keep --> Out["Set req.id and the x-request-id response header"]
    Gen --> Out
```

Rules:

- A client may supply `x-request-id`. Only letters, digits, and hyphens are accepted, up to 64 characters. This stops arbitrary text from reaching the logs.
- Any other value is replaced with a generated UUID. The request is not rejected.
- Every Gateway response carries the ID in the `x-request-id` header.
- The Gateway forwards the ID to the Order Service, and the Order Service forwards it to the Payment Service.

## 4. Log Format

Every line has these fields:

| Field | Description |
|---|---|
| `level` | `info`, `warn`, `error` (text, not a number) |
| `time` | ISO 8601 timestamp in UTC |
| `service` | `api-gateway`, `order-service`, or `payment-service` |
| `msg` | Short message |

Request lines (written by `pino-http`) add:

| Field | Description |
|---|---|
| `req.id` | The request ID |
| `req.method` | HTTP method |
| `req.path` | Path without the query string |
| `res.statusCode` | Response status |
| `responseTime` | Duration in milliseconds |

Example request line:

```json
{"level":"info","time":"2026-11-08T16:33:09.727Z","service":"api-gateway","req":{"id":"abc-123","method":"POST","path":"/api/orders"},"res":{"statusCode":201},"responseTime":38,"msg":"request completed"}
```

Example business line from the Payment Service:

```json
{"level":"info","time":"2026-11-08T16:33:09.700Z","service":"payment-service","req":{"id":"abc-123","method":"POST","path":"/payments"},"paymentId":"13f67bcb-42ab-40d9-976b-5057e32ba4be","orderId":"ea0811ff-832e-4bcc-a797-aae75694a4df","status":"SUCCEEDED","msg":"Payment processed"}
```

### Messages

| Service | Message | Level | Extra fields |
|---|---|---|---|
| All | `request completed` | `info`, `warn` for `4xx` | request fields |
| All | `request failed` | `error` for `5xx` | request fields, `err` created by `pino-http` |
| All | `... listening` | `info` | `port` |
| All | `Shutting down ...` | `info` | `signal` |
| Gateway | `gateway error` | `error` for `5xx`, `warn` otherwise | `error` |
| Order, Payment | `Applied migration` | `info` | `migration` |
| Order, Payment | `Unhandled error` | `error` | `error` |
| Order | `Order payment processed` | `info` | `orderId`, `status`, `paymentId` |
| Order | `Payment processing failed, order left PENDING` | `error` | `orderId`, `error` |
| Payment | `Payment processed` | `info` | `paymentId`, `orderId`, `status` |

### Log Levels

The level of a request line follows the response status:

| Condition | Level |
|---|---|
| Status `5xx` or an error | `error` |
| Status `4xx` | `warn` |
| Anything else | `info` |

The minimum level comes from the `LOG_LEVEL` environment variable (default `info`). The `npm test` scripts set `LOG_LEVEL=silent`. Compose does not set `LOG_LEVEL`, so containers use `info`.

## 5. What Is and Is Not Logged

| Logged | Never logged |
|---|---|
| Request ID, method, path, status, duration | Request and response bodies |
| Order and payment IDs | Query strings |
| Payment status | Request headers (including `authorization` and `cookie`) |
| Error type, message, code, cause, and stack | Database credentials and `PG*` variables |

`customerId` and amounts are request data, so they are not written to logs. The correlation test checks this.

`GET /health` and `GET /metrics` requests are not logged. Compose and Prometheus call them every few seconds, and they would hide real traffic.

## 6. Error Logging

Errors are logged under the `error` key with a compact serializer:

```json
{"level":"error","time":"2026-11-08T16:24:10.120Z","service":"order-service","req":{"id":"abc-123","method":"POST","path":"/orders"},"error":{"type":"AbortError","message":"This operation was aborted","code":20,"stack":"AbortError: This operation was aborted"},"orderId":"52f5ae32-53c4-42b0-90f7-c449a70fa164","msg":"Payment processing failed, order left PENDING"}
```

The key is `error`, not `err`. `pino-http` forces its own serializer on `err` for request loggers, and the default one copies every property of errors such as `AbortError`, which adds dozens of useless fields. A custom serializer on `err` is ignored there.

The serializer keeps `type`, `message`, `code`, `cause`, and `stack`.

For a `5xx` response `pino-http` also writes its own `request failed` line, with a generic `err` and an internal stack. The `gateway error` or `Unhandled error` line next to it holds the real cause.

## 7. Tracing One Request

Send a request with a known ID, then collect the lines of all services:

```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "x-request-id: trace-demo-1" \
  -d '{"customerId":"customer-123","amount":1500,"currency":"EGP"}'

docker compose logs --no-log-prefix api-gateway order-service payment-service \
  | jq -R -c 'fromjson? | select(.req.id == "trace-demo-1") | {time, service, msg}' \
  | sort
```

Expected output, in order:

```text
{"time":"...","service":"payment-service","msg":"Payment processed"}
{"time":"...","service":"payment-service","msg":"request completed"}
{"time":"...","service":"order-service","msg":"Order payment processed"}
{"time":"...","service":"order-service","msg":"request completed"}
{"time":"...","service":"api-gateway","msg":"request completed"}
```

- `jq -R` reads each line as text, and `fromjson?` skips lines that are not JSON.
- `sort` orders the lines by `time`, which is the first field.

More queries:

| Goal | Command |
|---|---|
| Only errors of a service | `docker compose logs --no-log-prefix order-service \| jq -R -c 'fromjson? \| select(.level == "error")'` |
| Slow requests (over 500 ms) | `docker compose logs --no-log-prefix api-gateway \| jq -R -c 'fromjson? \| select(.responseTime > 500)'` |
| Failed payments | `docker compose logs --no-log-prefix payment-service \| jq -R -c 'fromjson? \| select(.status == "FAILED")'` |

## 8. Metrics Design

Logs explain what happened to one request. Metrics show the overall picture over time: how many requests per second, how many failed, and how slow the slowest 5% are.

```mermaid
flowchart LR
    GW["api-gateway :3000/metrics"] --> P["Prometheus :9090<br/>scrapes every 10 s"]
    ORD["order-service :3001/metrics"] --> P
    PAY["payment-service :3002/metrics"] --> P
    P --> G["Grafana :3003<br/>PulseTrace Overview"]
```

| Component | Where | Responsibility |
|---|---|---|
| `config/metrics.js` | Each service | Creates a registry per app and defines the metrics |
| `middleware/metrics.js` | Each service | Counts and times every request after the response is sent |
| `GET /metrics` | Each service | Exposes the registry in Prometheus text format |

Each `createApp()` call creates its own registry, so unit tests never register the same metric twice. Every metric carries a `service` label.

### Metrics

| Metric | Type | Labels | Service |
|---|---|---|---|
| `http_requests_total` | Counter | `method`, `route`, `status_code` | All |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | All |
| `orders_created_total` | Counter | `status` | Order |
| `payments_processed_total` | Counter | `status` | Payment |
| `gateway_upstream_errors_total` | Counter | `code` | Gateway |
| `process_*`, `nodejs_*` | Default | none | All (from `prom-client`) |

The histogram buckets are 5 ms, 10 ms, 25 ms, 50 ms, 100 ms, 250 ms, 500 ms, 1 s, 2.5 s, and 5 s.

The error rate is not a metric of its own. It is calculated in Prometheus from `http_requests_total` with `status_code=~"5.."`, so nothing is stored twice.

### Route Label Rule

The `route` label holds the route pattern, never the real path.

| Request | `route` label |
|---|---|
| `GET /api/orders/ea0811ff-...` | `/api/orders/:id` |
| `POST /orders` | `/orders` |
| `GET /payments/<id>` | `/payments/:id` |
| A path no route matches | `unmatched` |

A real path would create a new time series for every order, which makes Prometheus slow and large (a cardinality explosion). The pattern keeps the number of series fixed.

Express resets `req.baseUrl` when an error is thrown, so a lookup that ends in a `404` would lose its router prefix. The Order and Payment routers store the mount path in `res.locals.routeBase` before the controller runs, and the metrics middleware reads it.

### What Is Not Counted

`GET /health` and `GET /metrics` are not counted and not logged. Probes would hide real traffic.

## 9. Prometheus

Prometheus runs from `docker-compose.observability.yaml`, a separate Compose file, so the application stack and its test scripts stay unchanged.

| Property | Value |
|---|---|
| Image | `prom/prometheus:v3.5.0` |
| Port | `9090` (published to the host) |
| Config | `observability/prometheus/prometheus.yml` |
| Scrape interval | 10 s |
| Retention | 7 days |
| Storage | Named volume `prometheus-data` |

It joins the existing application network and reaches the services by Compose name (`api-gateway:3000`, `order-service:3001`, `payment-service:3002`). The Order and Payment ports stay private. The targets are visible at `http://localhost:9090/targets`.

Counters restart from zero when a container restarts. `rate()` and `increase()` handle this correctly, but a raw counter value drops after a restart.

## 10. Grafana

Grafana runs from the same observability Compose file and is configured entirely from files, so nothing is set up by hand in the UI.

| Property | Value |
|---|---|
| Image | `grafana/grafana:12.1.0` |
| Port | `3003` on the host (`3000` is used by the Gateway) |
| Login | User `admin`, password from `GRAFANA_ADMIN_PASSWORD` in `.env` |
| Data source | `observability/grafana/provisioning/datasources/datasources.yml` |
| Dashboard provider | `observability/grafana/provisioning/dashboards/dashboards.yml` |
| Dashboard | `observability/grafana/dashboards/pulsetrace-overview.json` |

The dashboard file is reloaded every 30 seconds and cannot be edited from the UI (`allowUiUpdates: false`). To change a panel, edit the JSON file.

## 11. PulseTrace Overview Dashboard

| Row | Panels |
|---|---|
| Key numbers | Services up, Request rate, Error rate (5xx), p95 latency, Orders PAID, Payments FAILED |
| Traffic | Request rate by service, Requests by status code |
| Latency | p95 latency by service, Gateway latency percentiles (p50, p95, p99) |
| Business | Orders by status, Payments by status |
| Health | Gateway upstream errors, Event loop lag |

Some panels are empty until the matching event happens:

- **Gateway upstream errors** has data only after the Gateway fails to reach the Order Service. Normal traffic produces no such errors.
- **Orders by status** shows `PENDING` only after a payment failure that the Order Service could not complete, for example when the Payment Service is stopped.

`scripts/generate-traffic.sh` produces normal traffic, `PENDING` orders, and upstream errors, so every panel has data. Set the time range to the last 15 minutes after running it.

The error rate uses a 5 minute window and shows `0%` when there is no traffic. A 1 minute window made the panel turn red from a single failed request after the traffic stopped.

## 12. Useful Queries

| Goal | PromQL |
|---|---|
| Request rate per service | `sum(rate(http_requests_total[1m])) by (service)` |
| Error rate of the Gateway | `sum(rate(http_requests_total{service="api-gateway",status_code=~"5.."}[5m])) / sum(rate(http_requests_total{service="api-gateway"}[5m]))` |
| p95 latency of the Gateway | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="api-gateway"}[5m])) by (le))` |
| Orders by status | `sum(orders_created_total) by (status)` |
| Upstream errors by code | `sum(gateway_upstream_errors_total) by (code)` |

Run a query from the terminal without opening Grafana:

```bash
curl -s --data-urlencode 'query=sum(orders_created_total) by (status)' \
  http://localhost:9090/api/v1/query | jq -c '.data.result[] | {status: .metric.status, value: .value[1]}'
```

## 13. Testing

- `tests/logging-correlation-test.sh` checks the running stack with 13 checks: the supplied ID is returned, the same ID is logged by all three services, a generated ID is returned when none is supplied, unsafe IDs are replaced, failed payments are logged, health checks are not logged, and request data never reaches the logs. See [Testing](../guides/testing.md#6-logging-correlation-test).
- `tests/metrics-test.sh` checks the observability stack with 15 checks: Prometheus targets, the `/metrics` endpoints, order and payment counters after real requests, route labels without IDs, probes missing from metrics and logs, Grafana provisioning, and every dashboard query. See [Testing](../guides/testing.md#7-metrics-test).
- The unit tests of each service cover the `/metrics` endpoint, the route label, and the business counters.

## 14. Roadmap

| Phase | Adds | Builds on |
|---|---|---|
| Tracing | OpenTelemetry and Jaeger, with trace and span IDs in the logs | Request ID stays next to the trace ID |
| Centralized logging | Fluent Bit and Loki, queried from Grafana | JSON log format |
| Alerting | Prometheus alert rules and Alertmanager | Metrics |

## 15. Known Limitations

- Logs exist only in Docker's container logs. They are not collected, rotated, or searchable across restarts until Loki is added.
- The request ID is per HTTP request. It is not a trace ID, and it does not show timing inside a service.
- When a client disconnects before the response is sent, `pino-http` still logs the request with the default status `200`.
- `responseTime` in the logs uses the system clock. If the clock jumps (for example WSL2 after the host sleeps), a value can be negative. The metrics histogram uses a monotonic timer and is not affected.
- Stack traces are logged in full. This is acceptable for local development, not for production.
- A payment timeout is logged as an `AbortError` with the message `This operation was aborted`. See [Error Handling](../api/error-handling.md#52-payment-service-timeout).
- `/metrics` of the Gateway is reachable from the host on port `3000`, without authentication, because the Gateway is the only published service. This is acceptable for local development.
- Counters restart from zero when a container restarts, and old time series stay in Prometheus for 7 days. Old route labels from earlier versions can therefore appear in queries.
- Metrics are scraped every 10 seconds, so a very short spike can be missed.
- Prometheus and Grafana data live in named volumes. `docker compose down -v` deletes them together with the database volume.
- There are no alerts yet. A failing service is visible on the dashboard but nothing notifies anyone.