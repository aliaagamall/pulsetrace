# PulseTrace Logging Correlation Test Report

- **Date:** 2026-11-08_18-37-58
- **Environment:** development
- **Base URL:** http://localhost:3000
- **Request ID:** corr-1794155878-10653

## Summary

| Result | Count |
|---|---:|
| Passed | 13 |
| Failed | 0 |
| Skipped | 0 |
| Total | 13 |

## Test Results

| Test | Result | Details |
|---|---|---|
| Compose configuration | PASS | Configuration is valid |
| Application services health | PASS | All three services are healthy |
| API Gateway health | PASS | HTTP 200 |
| Supplied request ID returned | PASS | Response carries corr-1794155878-10653 |
| api-gateway logs request ID | PASS | Log entry found for corr-1794155878-10653 |
| order-service logs request ID | PASS | Log entry found for corr-1794155878-10653 |
| payment-service logs request ID | PASS | Log entry found for corr-1794155878-10653 |
| Payment result logged | PASS | Payment processed entry has the request ID |
| Generated request ID | PASS | Gateway generated a UUID |
| Invalid request ID replaced | PASS | Unsafe ID was replaced with a UUID |
| Failed payment logged | PASS | FAILED payment entry has the request ID |
| Health checks not logged | PASS | No /health entries in service logs |
| Request bodies not logged | PASS | Customer data from the request body is absent from logs |

