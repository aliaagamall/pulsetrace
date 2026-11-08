const express = require("express");
const pinoHttp = require("pino-http");
const OrderClient = require("./clients/order.client");
const { createLogger } = require("./config/logger");
const { resolveRequestId } = require("./middleware/request-id");

function createApp({
  orderClient = new OrderClient(),
  logger = createLogger("api-gateway")
} = {}) {
  const app = express();

  // Log one structured line per request and attach a request ID.
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
      service: "api-gateway"
    });
  });

  app.post("/api/orders", async (req, res, next) => {
    try {
      const result = await orderClient.request("/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": req.id
        },
        body: JSON.stringify(req.body)
      });

      res.status(result.status).json(result.data);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/orders/:id", async (req, res, next) => {
    try {
      const result = await orderClient.request(
        `/orders/${encodeURIComponent(req.params.id)}`,
        {
          headers: {
            "x-request-id": req.id
          }
        }
      );

      res.status(result.status).json(result.data);
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "The requested route does not exist."
      }
    });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const statusCode = error.statusCode || 502;

    const logError = statusCode >= 500 ? req.log.error : req.log.warn;
    logError.call(req.log, { err: error }, "gateway error");

    res.status(statusCode).json({
      error: {
        code: error.code || "UPSTREAM_SERVICE_ERROR",
        message: error.message || "Order Service request failed."
      }
    });
  });

  return app;
}

module.exports = createApp;