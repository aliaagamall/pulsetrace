function createPaymentController(paymentService) {
  async function createPayment(req, res) {
    const payment = await paymentService.createPayment(req.body);

    res.status(201).json({
      data: payment
    });
  }

  async function getPayment(req, res) {
    const payment = await paymentService.getPaymentById(
      req.params.id
    );

    res.status(200).json({
      data: payment
    });
  }

  return {
    createPayment,
    getPayment
  };
}

module.exports = createPaymentController;