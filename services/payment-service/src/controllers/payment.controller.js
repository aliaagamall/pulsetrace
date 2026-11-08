function createPaymentController(paymentService) {
  async function createPayment(req, res) {
    // Pass the request logger down so the service can log the payment result.
    const payment = await paymentService.createPayment(req.body, {
      logger: req.log
    });

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