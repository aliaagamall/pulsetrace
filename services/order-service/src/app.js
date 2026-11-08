const express = require("express");
const pinoHttp = require("pino-http");
const InMemoryOrderRepository = require("./repositories/in-memory-order.repository");
const OrderService = require("./services/order.service");
const createOrderRouter = require("./routes/order.routes");
const errorHandler = require("./middleware/error-handler");
const PaymentClient = require("./clients/payment.client");
const { createLogger } = require("./config/logger");
const { resolveRequestId } = require("./middleware/request-id");

function createApp({
  orderRepository = new InMemoryOrderRepository(),
  paymentClient = new PaymentClient(),
  logger = createLogger("order-service")
} = {}) {
  const app = express();
  const orderService = new OrderService(orderRepository, paymentClient);

  // Log one structured line per request and reuse the incoming request ID.
  app.use(
    pinoHttp({
      logger,
      genReqId: resolveRequestId,
      // Health checks run every few seconds, so they are not logged.
      autoLogging: {
        ignore: (req) => req.url === "/health"
      },
      customLogLevel: (req, res, error) => {
        if (error || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      customSuccessMessage: () => "request completed",
      customErrorMessage: () => "request failed",
      // Log only safe fields: no headers, no body, no query string.
      serializers: {
        req: (req) => {
          const raw = req.raw || req;

          return {
            id: raw.id,
            method: raw.method,
            path: raw.url.split("?")[0]
          };
        },
        res: (res) => ({
          statusCode: (res.raw || res).statusCode
        })
      }
    })
  );

  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      service: "order-service"
    });
  });

  app.use("/orders", createOrderRouter(orderService));

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "The requested route does not exist."
      }
    });
  });

  app.use(errorHandler);

  return app;
}

module.exports = createApp;