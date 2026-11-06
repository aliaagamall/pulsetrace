
class PaymentClient {
  constructor({
    baseUrl = process.env.PAYMENT_SERVICE_URL || "http://localhost:3002",
    timeout = 3000
  } = {}) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  async createPayment(paymentData) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.timeout
    );

    try {
      const response = await fetch(`${this.baseUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(paymentData),
        signal: controller.signal
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          `Payment Service returned status ${response.status}`
        );
      }

      return result.data;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

module.exports = PaymentClient;
