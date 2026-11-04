# Error Handling Strategy

## 1. Overview

This document defines the error handling conventions used across PulseTrace services.

The objectives are to:

- Return consistent error responses.
- Use appropriate HTTP status codes.
- Avoid exposing internal implementation details.
- Handle failures between dependent services.
- Distinguish business failures from technical failures.

## 2. Standard Error Response

All API errors use the following JSON structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "details": [
      {
        "field": "amount",
        "message": "Amount must be greater than zero."
      }
    ]
  }
}
```

### Error Fields

| Field | Description |
|---|---|
| `error.code` | Machine-readable error identifier |
| `error.message` | Human-readable error description |
| `error.details` | Optional list of field-level validation errors |

The `details` field is omitted when additional details are not applicable.

Internal stack traces, database credentials, SQL statements, and sensitive implementation details must never be returned to clients.

## 3. Client Errors

### 3.1 Validation Error

**HTTP Status:** `400 Bad Request`

Returned when request data is missing, invalid, or does not meet the API contract.

Examples:

- Missing `customerId`.
- Empty `customerId`.
- Negative or zero `amount`.
- Invalid currency format.
- Invalid field types.
- Invalid UUID path parameter.
- Invalid `simulateFailure` value.

Example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "details": [
      {
        "field": "currency",
        "message": "Currency must contain three uppercase letters."
      }
    ]
  }
}
```

### 3.2 Resource Not Found

**HTTP Status:** `404 Not Found`

Returned when the requested order or payment does not exist.

Example:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested order was not found."
  }
}
```

## 4. Business Failures

A business failure represents a valid request that could not complete successfully according to the application's business rules.

### Payment Failure

A simulated payment failure is not an HTTP API error.

The Payment Service:

1. Processes the simulated payment.
2. Stores a payment record with `FAILED` status.
3. Returns `201 Created` with the payment result.

The Order Service updates the order status to `PAYMENT_FAILED`.

The Gateway returns the created order with `201 Created`.

This distinction separates payment outcomes from technical API failures.

## 5. Service Communication Errors

The Order Service depends on the Payment Service through synchronous REST communication.

The following scenarios must be handled:

### 5.1 Payment Service Unavailable

**HTTP Status:** `503 Service Unavailable`

Occurs when the Order Service cannot establish a connection to the Payment Service.

Expected behavior:

- Do not mark the payment as failed.
- Keep the order in `PENDING` status.
- Return a standardized service-unavailable error.
- Do not expose internal service connection details.

Example:

```json
{
  "error": {
    "code": "PAYMENT_SERVICE_UNAVAILABLE",
    "message": "Payment processing is temporarily unavailable."
  }
}
```

### 5.2 Payment Service Timeout

**HTTP Status:** `504 Gateway Timeout`

Occurs when the Payment Service does not respond within the configured request timeout.

Expected behavior:

- Do not assume that the payment failed.
- Keep the order in `PENDING` status.
- Return a timeout error.
- Avoid automatically submitting another payment request in the initial implementation.

A timeout does not guarantee that the Payment Service did not process the request. The payment outcome may be unknown.

Example:

```json
{
  "error": {
    "code": "PAYMENT_SERVICE_TIMEOUT",
    "message": "Payment processing did not respond in time."
  }
}
```

### 5.3 Invalid Upstream Response

**HTTP Status:** `502 Bad Gateway`

Occurs when a dependent service returns an invalid or unexpected response.

Expected behavior:

- Do not treat the response as a successful payment.
- Keep the order in `PENDING` status unless a valid payment result has been confirmed.
- Return a standardized upstream error.

Example:

```json
{
  "error": {
    "code": "INVALID_UPSTREAM_RESPONSE",
    "message": "A dependent service returned an unexpected response."
  }
}
```

## 6. Database Errors

Database errors are handled internally by the service that owns the database.

### 6.1 Database Unavailable

**HTTP Status:** `503 Service Unavailable`

Occurs when the service cannot connect to its database.

Expected behavior:

- Do not continue database-dependent operations.
- Return a standardized error.
- Do not expose database connection details.

### 6.2 Database Operation Failure

**HTTP Status:** `500 Internal Server Error`

Occurs when an unexpected database operation fails.

Expected behavior:

- Handle the error without exposing SQL statements or stack traces.
- Preserve data consistency where possible.
- Return a generic internal error.

## 7. Internal Server Errors

**HTTP Status:** `500 Internal Server Error`

Used for unexpected application errors that do not match a more specific error category.

Example:

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred."
  }
}
```

The application should log technical details internally for troubleshooting. Detailed logging and centralized log collection will be implemented in a later observability phase.

## 8. Error Handling Responsibilities

| Component | Responsibility |
|---|---|
| API Gateway | Return standardized responses to clients and handle upstream communication errors |
| Order Service | Validate orders, handle Payment Service errors, and protect order state |
| Payment Service | Validate payment requests and handle payment persistence errors |
| PostgreSQL | Return database operation results and errors to the owning service |

Each service must handle its own errors and avoid exposing internal implementation details to other services or clients.

## 9. Order State Consistency

The initial application uses synchronous REST communication without distributed transactions.

The following rules apply:

- A newly created order starts as `PENDING`.
- A confirmed successful payment changes the order to `PAID`.
- A confirmed unsuccessful payment changes the order to `PAYMENT_FAILED`.
- A communication timeout or unavailable Payment Service must not be interpreted as payment failure.
- If the payment result is unknown, the order remains `PENDING`.

A database failure while updating the order after payment processing may leave the payment and order states temporarily inconsistent.

The initial implementation does not provide automatic reconciliation or distributed transaction recovery. This limitation will be documented and tested.

## 10. Error Handling Principles

- Use consistent error response structures.
- Return appropriate HTTP status codes.
- Separate business failures from technical failures.
- Never expose sensitive internal details.
- Avoid assuming that a timeout means an operation failed.
- Keep service-specific database errors inside their owning services.
- Do not implement automatic retries in the initial version.
- Test expected failure scenarios as part of integration testing.
