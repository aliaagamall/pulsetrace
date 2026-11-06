const express = require("express");
const InMemoryOrderRepository = require("./repositories/in-memory-order.repository");
const OrderService = require("./services/order.service");
const createOrderRouter = require("./routes/order.routes");
const errorHandler = require("./middleware/error-handler");

function createApp({
  orderRepository = new InMemoryOrderRepository()
} = {}) {
  const app = express();

  const orderService = new OrderService(orderRepository);

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