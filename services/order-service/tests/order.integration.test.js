
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const createApp = require("../src/app");

process.env.NODE_ENV = "test";

function createMockPaymentClient(paymentBehavior) {
  return {
    async createPayment(paymentData) {
      return paymentBehavior(paymentData);
    }
  };
}

test("POST /orders marks an order as PAID after successful payment", async () => {
  const paymentClient = createMockPaymentClient(async (paymentData) => ({
    id: "payment-123",
    orderId: paymentData.orderId,
    status: "SUCCEEDED"
  }));

  const app = createApp({ paymentClient });

  const response = await request(app)
    .post("/orders")
    .send({
      customerId: "customer-123",
      amount: 1500,
      currency: "EGP"
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, "PAID");
  assert.equal(response.body.data.paymentId, "payment-123");
});

test("POST /orders marks an order as PAYMENT_FAILED after failed payment", async () => {
  const paymentClient = createMockPaymentClient(async (paymentData) => ({
    id: "payment-456",
    orderId: paymentData.orderId,
    status: "FAILED"
  }));

  const app = createApp({ paymentClient });

  const response = await request(app)
    .post("/orders")
    .send({
      customerId: "customer-456",
      amount: 750,
      currency: "EGP"
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, "PAYMENT_FAILED");
  assert.equal(response.body.data.paymentId, "payment-456");
});

test("POST /orders keeps an order PENDING when payment service is unavailable", async () => {
  const paymentClient = createMockPaymentClient(async () => {
    throw new Error("Payment Service is unavailable");
  });

  const app = createApp({ paymentClient });

  const response = await request(app)
    .post("/orders")
    .send({
      customerId: "customer-789",
      amount: 2000,
      currency: "EGP"
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, "PENDING");
  assert.equal(response.body.data.paymentId, null);
});
