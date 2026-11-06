function createOrderController(orderService) {
  async function createOrder(req, res) {
    const order = await orderService.createOrder(req.body);

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