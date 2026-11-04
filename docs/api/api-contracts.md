# API Contracts

## 1. Overview

This document defines the HTTP API contracts for the PulseTrace application.

The application consists of three services:

- API Gateway
- Order Service
- Payment Service

The API Gateway exposes public endpoints to clients. The Order Service and Payment Service communicate through internal REST APIs.

## 2. API Conventions

### Base URLs

The following URLs represent the local development configuration:

| Service | Base URL |
|---|---|
| API Gateway | `http://localhost:3000` |
| Order Service | `http://order-service:3001` |
| Payment Service | `http://payment-service:3002` |

Internal service URLs will be configured through environment variables.

### Data Format

- Request and response bodies use JSON.
- Content-Type: `application/json`.
- Resource identifiers use UUIDs.
- Timestamps use ISO 8601 format in UTC.
- Currency codes use uppercase ISO 4217 format.
- Amounts must be positive decimal numbers.

### Order Statuses

| Status | Description |
|---|---|
| `PENDING` | Order created; payment result is not finalized. |
| `PAID` | Payment completed successfully. |
| `PAYMENT_FAILED` | Payment was processed but unsuccessful. |

### Payment Statuses

| Status | Description |
|---|---|
| `SUCCEEDED` | Simulated payment succeeded. |
| `FAILED` | Simulated payment failed. |

## 3. API Gateway

The API Gateway is the only public entry point for client requests.

### 3.1 Health Check

**Endpoint:** `GET /health`

**Purpose:** Check whether the API Gateway process is running.

**Success Response:** `200 OK`

```json
{
  "status": "ok",
  "service": "api-gateway"
}
```

### 3.2 Create Order

**Endpoint:** `POST /api/orders`

**Purpose:** Create an order and initiate payment processing.

**Request Body:**

```json
{
  "customerId": "customer-123",
  "amount": 1500,
  "currency": "EGP"
}
```

**Optional Development/Test Field:**

```json
{
  "customerId": "customer-123",
  "amount": 1500,
  "currency": "EGP",
  "simulateFailure": true
}
```

`simulateFailure` is allowed only in development and test environments. Production requests containing this field must be rejected.

**Validation Rules:**

| Field | Required | Validation |
|---|---|---|
| `customerId` | Yes | Non-empty string |
| `amount` | Yes | Positive number |
| `currency` | Yes | Three uppercase letters |
| `simulateFailure` | No | Boolean; development/test only |

**Success Response:** `201 Created`

```json
{
  "data": {
    "id": "order-uuid",
    "customerId": "customer-123",
    "amount": 1500,
    "currency": "EGP",
    "status": "PAID",
    "paymentId": "payment-uuid",
    "createdAt": "2026-11-04T18:00:00.000Z",
    "updatedAt": "2026-11-04T18:00:01.000Z"
  }
}
```

A successfully created order returns `201 Created`, even if its payment result is `PAYMENT_FAILED`. The response status represents resource creation, while the order status represents the business result.

If payment processing is temporarily unavailable or times out, the order may remain `PENDING`.

### 3.3 Get Order

**Endpoint:** `GET /api/orders/:id`

**Purpose:** Retrieve an order by its ID.

**Path Parameters:**

| Parameter | Description |
|---|---|
| `id` | Order UUID |

**Success Response:** `200 OK`

```json
{
  "data": {
    "id": "order-uuid",
    "customerId": "customer-123",
    "amount": 1500,
    "currency": "EGP",
    "status": "PAID",
    "paymentId": "payment-uuid",
    "createdAt": "2026-11-04T18:00:00.000Z",
    "updatedAt": "2026-11-04T18:00:01.000Z"
  }
}
```

## 4. Order Service

The Order Service owns order operations and the `order_db` database.

These endpoints are internal and must not be directly exposed to external clients.

### 4.1 Health Check

**Endpoint:** `GET /health`

**Success Response:** `200 OK`

```json
{
  "status": "ok",
  "service": "order-service"
}
```

### 4.2 Create Order

**Endpoint:** `POST /orders`

**Purpose:** Validate and create an order, initiate payment, and update its status.

**Request Body:**

```json
{
  "customerId": "customer-123",
  "amount": 1500,
  "currency": "EGP",
  "simulateFailure": false
}
```

`simulateFailure` is an internal testing control passed to the Payment Service. It must only be enabled in development and test environments.

**Success Response:** `201 Created`

The response contains the created order using the same data structure defined in the Gateway Create Order response.

### 4.3 Get Order

**Endpoint:** `GET /orders/:id`

**Purpose:** Retrieve an order from `order_db`.

**Success Response:** `200 OK`

```json
{
  "data": {
    "id": "order-uuid",
    "customerId": "customer-123",
    "amount": 1500,
    "currency": "EGP",
    "status": "PENDING",
    "paymentId": null,
    "createdAt": "2026-11-04T18:00:00.000Z",
    "updatedAt": "2026-11-04T18:00:00.000Z"
  }
}
```

## 5. Payment Service

The Payment Service owns payment operations and the `payment_db` database.

Its endpoints are internal and must not be directly exposed to external clients.

### 5.1 Health Check

**Endpoint:** `GET /health`

**Success Response:** `200 OK`

```json
{
  "status": "ok",
  "service": "payment-service"
}
```

### 5.2 Create Payment

**Endpoint:** `POST /payments`

**Purpose:** Process a simulated payment and save its result.

**Request Body:**

```json
{
  "orderId": "order-uuid",
  "amount": 1500,
  "currency": "EGP",
  "simulateFailure": false
}
```

**Validation Rules:**

| Field | Required | Validation |
|---|---|---|
| `orderId` | Yes | Valid UUID |
| `amount` | Yes | Positive number |
| `currency` | Yes | Three uppercase letters |
| `simulateFailure` | No | Boolean; development/test only |

**Success Response:** `201 Created`

```json
{
  "data": {
    "id": "payment-uuid",
    "orderId": "order-uuid",
    "amount": 1500,
    "currency": "EGP",
    "status": "SUCCEEDED",
    "createdAt": "2026-11-04T18:00:01.000Z"
  }
}
```

A failed simulated payment is also stored as a payment record.

In that case, the response is `201 Created` with:

```json
{
  "data": {
    "id": "payment-uuid",
    "orderId": "order-uuid",
    "amount": 1500,
    "currency": "EGP",
    "status": "FAILED",
    "createdAt": "2026-11-04T18:00:01.000Z"
  }
}
```

A payment business failure is represented by the payment status, not by an HTTP API error.

### 5.3 Get Payment

**Endpoint:** `GET /payments/:id`

**Purpose:** Retrieve a payment record from `payment_db`.

**Success Response:** `200 OK`

```json
{
  "data": {
    "id": "payment-uuid",
    "orderId": "order-uuid",
    "amount": 1500,
    "currency": "EGP",
    "status": "SUCCEEDED",
    "createdAt": "2026-11-04T18:00:01.000Z"
  }
}
```

## 6. HTTP Status Codes

| Status Code | Meaning | Usage |
|---|---|---|
| `200` | OK | Successful retrieval |
| `201` | Created | Successful resource creation |
| `400` | Bad Request | Invalid request data |
| `404` | Not Found | Requested resource does not exist |
| `500` | Internal Server Error | Unexpected internal error |
| `502` | Bad Gateway | Invalid response from an upstream service |
| `503` | Service Unavailable | Required service or dependency unavailable |
| `504` | Gateway Timeout | Upstream request timeout |

## 7. Service Communication Rules

- Clients communicate only with the API Gateway.
- The Gateway forwards order requests to the Order Service.
- The Order Service communicates with the Payment Service.
- The Order Service owns and updates order records.
- The Payment Service owns and updates payment records.
- No service directly accesses another service's database.
- Internal service endpoints are not publicly exposed.

## 8. Scope Limitations

The initial implementation uses synchronous REST communication.

The application does not initially implement:

- Real payment provider integration.
- Distributed transactions.
- Automatic payment retries.
- Message brokers.
- Authentication or authorization.

These capabilities are outside the initial application scope.
