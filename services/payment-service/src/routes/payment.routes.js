const express = require("express");
const createPaymentController = require("../controllers/payment.controller");

function createPaymentRouter(paymentService, metrics) {
  const router = express.Router();

  const controller = createPaymentController(paymentService, metrics);

  // Remember the mount path now: Express resets baseUrl when an error is thrown,
  // and the metrics middleware needs it to build the route label.
  router.use((req, res, next) => {
    res.locals.routeBase = req.baseUrl;
    next();
  });

  router.post("/", controller.createPayment);
  router.get("/:id", controller.getPayment);

  return router;
}

module.exports = createPaymentRouter;