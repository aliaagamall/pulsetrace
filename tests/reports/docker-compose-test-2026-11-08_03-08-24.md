# Docker Compose Test Report

| Field | Value |
|---|---|
| Date | 2026-11-08 03:08:26 EET |
| Compose file | `docker-compose.yaml` |
| NODE_ENV | `production` |
| Result | **PASSED** |
| Passed | 10 |
| Failed | 0 |

## Test Results

| Test | Result | Details |
|---|---|---|
| Compose configuration | **PASS** | Configuration is valid. |
| payment-service health | **PASS** | Container is healthy. |
| order-service health | **PASS** | Container is healthy. |
| api-gateway health | **PASS** | Container is healthy. |
| Gateway health endpoint | **PASS** | HTTP 200. |
| Order to Payment connectivity | **PASS** | Service DNS resolved and returned HTTP 200. |
| Gateway to Order connectivity | **PASS** | Service DNS resolved and returned HTTP 200. |
| Create order (end-to-end) | **PASS** | HTTP 201; order status is PAID; ID: e3608d14-9b34-4f44-ab79-09b9351701ff. |
| Retrieve created order | **PASS** | HTTP 200; returned the same order ID. |
| Production simulation guard | **PASS** | HTTP 400; simulation is blocked in production. |

## Notes

- The script tests the currently running Compose stack; it does not start or stop containers.
- Order and payment data are stored in memory and may be lost when containers restart.
- The production simulation test expects `NODE_ENV=production`.
