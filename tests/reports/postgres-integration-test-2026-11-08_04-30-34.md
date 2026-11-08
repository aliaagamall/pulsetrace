# PulseTrace PostgreSQL Integration Test Report

- **Date:** 2026-11-08_04-30-34
- **Environment:** development
- **Base URL:** http://localhost:3000

## Summary

| Result | Count |
|---|---:|
| Passed | 22 |
| Failed | 0 |
| Skipped | 0 |
| Total | 22 |

## Test Results

| Test | Result | Details |
|---|---|---|
| Compose configuration | PASS | Configuration is valid |
| PostgreSQL health | PASS | PostgreSQL is healthy |
| payment-service health | PASS | Container is healthy |
| order-service health | PASS | Container is healthy |
| api-gateway health | PASS | Container is healthy |
| PostgreSQL connectivity | PASS | PostgreSQL accepts queries |
| order_db exists | PASS | Database exists |
| payment_db exists | PASS | Database exists |
| order_db migration tracking | PASS | schema_migrations exists |
| payment_db migration tracking | PASS | schema_migrations exists |
| API Gateway health | PASS | HTTP 200 |
| Create successful order | PASS | Order b849deba-8cd3-475e-818e-9bb270078a3b created with PAID status |
| Retrieve order | PASS | Order returned with PAID status |
| Order database persistence | PASS | Order exists in order_db |
| Payment database persistence | PASS | Payment exists in payment_db |
| Payment failure flow | PASS | Order correctly marked PAYMENT_FAILED |
| Failed order persistence | PASS | Failed order exists in order_db |
| Failed payment persistence | PASS | Failed payment exists in payment_db |
| Invalid order validation | PASS | Invalid amount rejected with HTTP 400 |
| Service restart health | PASS | Order and Payment services recovered |
| Order survives service restart | PASS | Order remains available after restart |
| Database survives service restart | PASS | PostgreSQL data remains available |

