const express = require("express");
const OrderClient = require("./clients/order.client");

function createApp({
  orderClient = new OrderClient()
} = {}) {
  const app = express();

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
          "Content-Type": "application/json"
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
        `/orders/${encodeURIComponent(req.params.id)}`
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

    res.status(error.statusCode || 502).json({
      error: {
        code: error.code || "UPSTREAM_SERVICE_ERROR",
        message: error.message || "Order Service request failed."
      }
    });
  });

  return app;
}

module.exports = createApp;