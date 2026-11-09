const express = require("express");
const createOrderController = require("../controllers/order.controller");

function createOrderRouter(orderService, metrics) {
  const router = express.Router();

  const controller = createOrderController(orderService, metrics);

  router.use((req, res, next) => {
    res.locals.routeBase = req.baseUrl;
    next();
  });

  router.post("/", controller.createOrder);
  router.get("/:id", controller.getOrder);

  return router;
}

module.exports = createOrderRouter;