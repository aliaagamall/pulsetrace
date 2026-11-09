function createOrderController(orderService, metrics) {
  async function createOrder(req, res) {
    // Pass the request ID and request logger down to the service layer.
    const order = await orderService.createOrder(req.body, {
      requestId: req.id,
      logger: req.log
    });

    // Count the order by the status it has when the request ends.
    metrics?.ordersCreatedTotal.inc({ status: order.status });

    res.status(201).json({
      data: order
    });
  }

  async function getOrder(req, res) {
    const order = await orderService.getOrderById(
      req.params.id
    );

    res.status(200).json({
      data: order
    });
  }

  return {
    createOrder,
    getOrder
  };
}

module.exports = createOrderController;