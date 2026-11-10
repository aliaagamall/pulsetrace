const DEFAULT_TIMEOUT_MS = 5000;

function createUpstreamError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.isUpstreamError = true;
  return error;
}

class OrderClient {
  constructor({
    baseUrl = process.env.ORDER_SERVICE_URL || "http://localhost:3001",
    timeout = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch
  } = {}) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.fetchImpl = fetchImpl;
  }

  async request(path, options = {}) {
    const controller = new AbortController();

    const timeoutId = setTimeout(
      () => controller.abort(),
      this.timeout
    );

    try {
      let response;

      try {
        response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          ...options,
          signal: controller.signal
        });
      } catch (error) {
        if (error.name === "AbortError") {
          throw createUpstreamError(
            "Order Service request timed out.",
            504,
            "ORDER_SERVICE_TIMEOUT"
          );
        }

        if (error instanceof TypeError) {
          throw createUpstreamError(
            "Order Service is unavailable.",
            503,
            "ORDER_SERVICE_UNAVAILABLE"
          );
        }

        throw error;
      }

      let data;

      try {
        data = await response.json();
      } catch {
        throw createUpstreamError(
          "Order Service returned an invalid response.",
          502,
          "ORDER_SERVICE_INVALID_RESPONSE"
        );
      }

      return {
        status: response.status,
        data
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

module.exports = OrderClient;