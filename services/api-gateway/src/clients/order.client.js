class OrderClient {
  constructor({
    baseUrl = process.env.ORDER_SERVICE_URL || "http://localhost:3001",
    timeout = 3000
  } = {}) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  async request(path, options = {}) {
    const controller = new AbortController();

    const timeoutId = setTimeout(
      () => controller.abort(),
      this.timeout
    );

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal
      });

      const data = await response.json();

      return {
        status: response.status,
        data
      };
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("Order Service request timed out.");
        timeoutError.statusCode = 504;
        timeoutError.code = "ORDER_SERVICE_TIMEOUT";
        throw timeoutError;
      }

      if (error instanceof TypeError) {
        const unavailableError = new Error("Order Service is unavailable.");
        unavailableError.statusCode = 503;
        unavailableError.code = "ORDER_SERVICE_UNAVAILABLE";
        throw unavailableError;
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

module.exports = OrderClient;
