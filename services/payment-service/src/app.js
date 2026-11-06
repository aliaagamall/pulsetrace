const express = require("express");
const InMemoryPaymentRepository = require("./repositories/in-memory-payment.repository");
const PaymentService = require("./services/payment.service");
const createPaymentRouter = require("./routes/payment.routes");
const errorHandler = require("./middleware/error-handler");

function createApp({
  paymentRepository = new InMemoryPaymentRepository()
} = {}) {
  const app = express();

  const paymentService = new PaymentService(paymentRepository);

  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      service: "payment-service"
    });
  });

  app.use("/payments", createPaymentRouter(paymentService));

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