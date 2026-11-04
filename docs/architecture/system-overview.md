# System Overview

## Project Purpose

PulseTrace is a local-first microservices platform built to demonstrate how distributed applications can be developed, deployed, monitored, and troubleshot.

The application starts with three independent services and a PostgreSQL database instance. Observability capabilities will be introduced in later development phases.

## Application Components

### 1. API Gateway

The API Gateway is the public entry point of the application.

Responsibilities:
- Receive client HTTP requests.
- Route requests to the appropriate internal service.
- Return service responses to clients.
- Keep internal service endpoints private.

### 2. Order Service

The Order Service manages customer orders.

Responsibilities:
- Validate incoming order data.
- Create and retrieve orders.
- Communicate with the Payment Service.
- Update order status based on payment results.
- Own and manage the order database.

### 3. Payment Service

The Payment Service handles simulated payment processing.

Responsibilities:
- Receive payment requests from the Order Service.
- Simulate successful and failed payments.
- Store payment records.
- Return payment results to the Order Service.
- Own and manage the payment database.

No real payment provider is integrated.

### 4. PostgreSQL

The application uses one PostgreSQL instance with two separate databases:

| Database | Owner | Purpose |
|---|---|---|
| `order_db` | Order Service | Store order records |
| `payment_db` | Payment Service | Store payment records |

Each service is responsible for accessing and managing its own database.

## Service Communication

Services communicate through synchronous REST APIs.

The main request path is:

Client → API Gateway → Order Service → Payment Service

The Payment Service returns its result to the Order Service, which updates the order status.

## Order Lifecycle

An order follows one of these states:

- `PENDING`: The order has been created and payment is being processed.
- `PAID`: Payment was successful.
- `PAYMENT_FAILED`: Payment processing failed.

## Development Principles

- Each service has a clearly defined responsibility.
- Each service owns its data.
- Internal services are not directly exposed to clients.
- Payment processing is simulated.
- The application is developed and tested locally.
- Observability is added progressively in dedicated phases.

## Current Scope

The initial application focuses on service communication, data ownership, REST APIs, database persistence, and failure handling.

Monitoring, centralized logging, distributed tracing, alerting, and Kubernetes are planned for later phases.
