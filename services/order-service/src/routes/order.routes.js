const express = require("express");
const createOrderController = require("../controllers/order.controller");

function createOrderRouter(orderService) {
  const router = express.Router();

  const controller = createOrderController(orderService);

  router.post("/", controller.createOrder);
  router.get("/:id", controller.getOrder);

  return router;
}

module.exports = createOrderRouter;