
const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const createApp = require("../src/app");

test("GET /health should return gateway health status", async () => {
  const app = createApp();

  const response = await request(app)
    .get("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: "ok",
    service: "api-gateway"
  });
});

test("POST /api/orders should forward the request to Order Service", async () => {
  let receivedPath;
  let receivedOptions;

  const orderClient = {
    async request(path, options) {
      receivedPath = path;
      receivedOptions = options;

      return {
        status: 201,
        data: {
          data: {
            id: "order-123",
            customerId: "customer-123",
            amount: 1500,
            currency: "EGP",
            status: "PAID",
            paymentId: "payment-123"
          }
        }
      };
    }
  };

  const app = createApp({ orderClient });

  const response = await request(app)
    .post("/api/orders")
    .send({
      customerId: "customer-123",
      amount: 1500,
      currency: "EGP"
    });

  assert.equal(response.status, 201);
  assert.equal(receivedPath, "/orders");
  assert.equal(receivedOptions.method, "POST");
  assert.equal(receivedOptions.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(receivedOptions.body), {
    customerId: "customer-123",
    amount: 1500,
    currency: "EGP"
  });
  assert.equal(response.body.data.status, "PAID");
});

test("GET /api/orders/:id should forward the request to Order Service", async () => {
  let receivedPath;

  const orderClient = {
    async request(path) {
      receivedPath = path;

      return {
        status: 200,
        data: {
          data: {
            id: "order-123",
            status: "PAID"
          }
        }
      };
    }
  };

  const app = createApp({ orderClient });

  const response = await request(app)
    .get("/api/orders/order-123");

  assert.equal(response.status, 200);
  assert.equal(receivedPath, "/orders/order-123");
  assert.equal(response.body.data.id, "order-123");
});

test("GET /api/orders/:id should forward Order Service 404 responses", async () => {
  const orderClient = {
    async request() {
      return {
        status: 404,
        data: {
          error: {
            code: "ORDER_NOT_FOUND",
            message: "Order not found."
          }
        }
      };
    }
  };

  const app = createApp({ orderClient });

  const response = await request(app)
    .get("/api/orders/unknown-order");

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "ORDER_NOT_FOUND");
});

test("should return 503 when Order Service is unavailable", async () => {
  const orderClient = {
    async request() {
      const error = new Error("Order Service is unavailable.");
      error.statusCode = 503;
      error.code = "ORDER_SERVICE_UNAVAILABLE";
      throw error;
    }
  };

  const app = createApp({ orderClient });

  const response = await request(app)
    .get("/api/orders/order-123");

  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, "ORDER_SERVICE_UNAVAILABLE");
});

test("should return 504 when Order Service request times out", async () => {
  const orderClient = {
    async request() {
      const error = new Error("Order Service request timed out.");
      error.statusCode = 504;
      error.code = "ORDER_SERVICE_TIMEOUT";
      throw error;
    }
  };

  const app = createApp({ orderClient });

  const response = await request(app)
    .get("/api/orders/order-123");

  assert.equal(response.status, 504);
  assert.equal(response.body.error.code, "ORDER_SERVICE_TIMEOUT");
});

test("should return 404 for unknown gateway routes", async () => {
  const app = createApp();

  const response = await request(app)
    .get("/unknown-route");

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "ROUTE_NOT_FOUND");
});
