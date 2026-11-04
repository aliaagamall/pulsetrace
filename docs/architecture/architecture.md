# Application Architecture

## High-Level Architecture

The following diagram illustrates the main application components and their communication paths.

```mermaid
flowchart TB
    Client["Client"]
    Gateway["API Gateway<br/>Node.js / Express"]
    Order["Order Service<br/>Node.js / Express"]
    Payment["Payment Service<br/>Node.js / Express"]

    subgraph Database["PostgreSQL Instance"]
        OrderDB[("order_db")]
        PaymentDB[("payment_db")]
    end

    Client -->|"HTTP Request"| Gateway
    Gateway -->|"Internal REST"| Order
    Order -->|"Internal REST"| Payment

    Order <-->|"Read / Write"| OrderDB
    Payment <-->|"Read / Write"| PaymentDB

    classDef gateway fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
    classDef service fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef database fill:#f3e8ff,stroke:#9333ea,color:#581c87

    class Gateway gateway
    class Order,Payment service
    class OrderDB,PaymentDB database
```

## Architecture Decisions

| Decision | Choice |
|---|---|
| Backend runtime | Node.js |
| Web framework | Express |
| Application language | JavaScript |
| Database | PostgreSQL |
| Database deployment | One PostgreSQL instance |
| Data ownership | Separate database per service |
| Communication | Synchronous REST |
| Payment processing | Simulated |
| Initial environment | Ubuntu WSL and Docker Desktop |

## Service Boundaries

- The API Gateway handles incoming client requests.
- The Order Service owns order operations and `order_db`.
- The Payment Service owns payment operations and `payment_db`.
- Services access their own databases rather than directly accessing another service's database.

## Future Extensions

The application will progressively be extended with:

- Containerization using Docker.
- Application metrics and visualization.
- Centralized logging.
- Distributed tracing.
- Alerting and incident simulation.
- Kubernetes deployment.
