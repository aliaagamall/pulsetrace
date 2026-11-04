# Order Creation Request Flow

## Overview

The order creation workflow uses synchronous REST communication between the API Gateway, Order Service, and Payment Service.

## Successful Payment Flow

1. The client sends a `POST /api/orders` request to the API Gateway.
2. The API Gateway forwards the request to the Order Service.
3. The Order Service validates the request.
4. The Order Service creates an order with `PENDING` status in `order_db`.
5. The Order Service sends a payment request to the Payment Service.
6. The Payment Service processes the simulated payment.
7. The Payment Service stores the payment result in `payment_db`.
8. The Payment Service returns the result to the Order Service.
9. The Order Service updates the order status to `PAID`.
10. The API Gateway returns the final response to the client.

## Failed Payment Flow

When payment processing fails:

1. The Order Service creates the order with `PENDING` status.
2. The Payment Service simulates a payment failure.
3. The Payment Service stores the failed payment result.
4. The Payment Service returns a failure response.
5. The Order Service updates the order status to `PAYMENT_FAILED`.
6. The API Gateway returns the final order result to the client.

## Payment Simulation

The application supports an optional `simulateFailure` field for development and testing.

Example successful request:

```json
{
  "customerId": "customer-123",
  "amount": 1500,
  "currency": "EGP"
}
```

Example simulated failure request:

```json
{
  "customerId": "customer-123",
  "amount": 1500,
  "currency": "EGP",
  "simulateFailure": true
}
```

The simulation control is intended for development and testing environments only. It must not be exposed as a client-controlled payment option in production.

## Failure Considerations

The initial implementation uses synchronous communication.

Potential failure scenarios include:

- Payment Service unavailable.
- Payment request timeout.
- Payment processing failure.
- Database connection failure.
- Order status update failure.

The initial design does not implement distributed transactions or automatic compensation.

These limitations will be documented and tested as the project evolves.
