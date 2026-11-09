function createPaymentController(paymentService, metrics) {
  async function createPayment(req, res) {
    // Pass the request logger down so the service can log the payment result.
    const payment = await paymentService.createPayment(req.body, {
      logger: req.log
    });

    // Count the payment by its result status.
    metrics?.paymentsProcessedTotal.inc({ status: payment.status });

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