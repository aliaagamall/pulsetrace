const express = require("express");
const pinoHttp = require("pino-http");
const InMemoryPaymentRepository = require("./repositories/in-memory-payment.repository");
const PaymentService = require("./services/payment.service");
const createPaymentRouter = require("./routes/payment.routes");
const errorHandler = require("./middleware/error-handler");
const { createLogger } = require("./config/logger");
const { createMetrics } = require("./config/metrics");
const { resolveRequestId } = require("./middleware/request-id");
const metricsMiddleware = require("./middleware/metrics");

function createApp({
  paymentRepository = new InMemoryPaymentRepository(),
  logger = createLogger("payment-service"),
  metrics = createMetrics("payment-service")
} = {}) {
  const app = express();

  const paymentService = new PaymentService(paymentRepository);

  // Log one structured line per request and reuse the incoming request ID.
  app.use(
    pinoHttp({
      logger,
      genReqId: resolveRequestId,
      // Health checks and metric scrapes run every few seconds, so they are not logged.
      autoLogging: {
        ignore: (req) => req.url === "/health" || req.url === "/metrics"
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

  app.use(metricsMiddleware(metrics));

  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      service: "payment-service"
    });
  });

  // Prometheus scrapes this endpoint.
  app.get("/metrics", async (req, res, next) => {
    try {
      res.set("Content-Type", metrics.registry.contentType);
      res.send(await metrics.registry.metrics());
    } catch (error) {
      next(error);
    }
  });

  app.use("/payments", createPaymentRouter(paymentService, metrics));

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