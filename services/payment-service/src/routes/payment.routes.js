const express = require("express");
const createPaymentController = require("../controllers/payment.controller");

function createPaymentRouter(paymentService) {
  const router = express.Router();

  const controller = createPaymentController(paymentService);

  router.post("/", controller.createPayment);
  router.get("/:id", controller.getPayment);

  return router;
}

module.exports = createPaymentRouter;