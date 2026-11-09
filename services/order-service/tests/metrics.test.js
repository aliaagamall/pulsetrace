const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const createApp = require("../src/app");

process.env.NODE_ENV = "test";

function createPaymentClient(status) {
  return {
    async createPayment(paymentData) {
      return { id: "payment-1", orderId: paymentData.orderId, status };
    }
  };
}

const ORDER = { customerId: "customer-123", amount: 1500, currency: "EGP" };

test("GET /metrics returns Prometheus text with default metrics", async () => {
  const app = createApp({ paymentClient: createPaymentClient("SUCCEEDED") });

  const response = await request(app).get("/metrics");

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/plain/);
  assert.match(response.text, /process_cpu_user_seconds_total/);
});

test("orders are counted by final status", async () => {
  const paid = createApp({ paymentClient: createPaymentClient("SUCCEEDED") });
  await request(paid).post("/orders").send(ORDER);

  const failed = createApp({ paymentClient: createPaymentClient("FAILED") });
  await request(failed).post("/orders").send(ORDER);
  await request(failed).post("/orders").send(ORDER);

  const paidMetrics = await request(paid).get("/metrics");
  const failedMetrics = await request(failed).get("/metrics");

  assert.match(paidMetrics.text, /orders_created_total\{status="PAID"[^}]*\} 1/);
  assert.match(failedMetrics.text, /orders_created_total\{status="PAYMENT_FAILED"[^}]*\} 2/);
});

test("an order stays PENDING in the metrics when payment fails", async () => {
  const paymentClient = {
    async createPayment() {
      throw new Error("Payment Service is unavailable");
    }
  };

  const app = createApp({ paymentClient });
  await request(app).post("/orders").send(ORDER);

  const response = await request(app).get("/metrics");

  assert.match(response.text, /orders_created_total\{status="PENDING"[^}]*\} 1/);
});

test("metrics use the route pattern, not the real path", async () => {
  const app = createApp({ paymentClient: createPaymentClient("SUCCEEDED") });

  await request(app).get("/orders/6f1c2a3e-8b4d-4e5f-9a7b-1c2d3e4f5a6b");

  const response = await request(app).get("/metrics");

  assert.ok(response.text.includes('route="/orders/:id"'));
  assert.ok(!response.text.includes("6f1c2a3e"));
});

test("health and metrics requests are not counted", async () => {
  const app = createApp({ paymentClient: createPaymentClient("SUCCEEDED") });

  await request(app).get("/health");
  await request(app).get("/metrics");

  const response = await request(app).get("/metrics");

  assert.ok(!response.text.includes('route="/health"'));
  assert.ok(!response.text.includes('route="/metrics"'));
});