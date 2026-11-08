const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const createApp = require("../src/app");

process.env.NODE_ENV = "test";

const ORDER_ID = "6f1c2a3e-8b4d-4e5f-9a7b-1c2d3e4f5a6b";
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

test("POST /payments creates a successful payment", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/payments")
    .send({
      orderId: ORDER_ID,
      amount: 1500,
      currency: "EGP"
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.orderId, ORDER_ID);
  assert.equal(response.body.data.amount, 1500);
  assert.equal(response.body.data.currency, "EGP");
  assert.equal(response.body.data.status, "SUCCEEDED");
  assert.ok(response.body.data.id);
});

test("POST /payments supports simulated payment failure", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/payments")
    .send({
      orderId: ORDER_ID,
      amount: 750,
      currency: "EGP",
      simulateFailure: true
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, "FAILED");
});

test("POST /payments rejects an invalid amount", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/payments")
    .send({
      orderId: ORDER_ID,
      amount: -100,
      currency: "EGP"
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "INVALID_AMOUNT");
});

test("POST /payments rejects an orderId that is not a UUID", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/payments")
    .send({
      orderId: "order-123",
      amount: 1500,
      currency: "EGP"
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "INVALID_ORDER_ID");
});

test("GET /payments/:id returns an existing payment", async () => {
  const app = createApp();

  const createResponse = await request(app)
    .post("/payments")
    .send({
      orderId: ORDER_ID,
      amount: 1500,
      currency: "EGP"
    });

  const paymentId = createResponse.body.data.id;

  const response = await request(app)
    .get(`/payments/${paymentId}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.id, paymentId);
});

test("GET /payments/:id returns 404 for an unknown payment", async () => {
  const app = createApp();

  const response = await request(app)
    .get(`/payments/${UNKNOWN_ID}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "PAYMENT_NOT_FOUND");
});

test("GET /payments/:id returns 404 for a malformed payment ID", async () => {
  const app = createApp();

  const response = await request(app)
    .get("/payments/not-a-uuid");

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "PAYMENT_NOT_FOUND");
});

test("POST /payments rejects payment simulation in production", async () => {
  const previousEnvironment = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "production";

    const app = createApp();

    const response = await request(app)
      .post("/payments")
      .send({
        orderId: ORDER_ID,
        amount: 1500,
        currency: "EGP",
        simulateFailure: true
      });

    assert.equal(response.status, 400);
    assert.equal(
      response.body.error.code,
      "SIMULATION_NOT_ALLOWED"
    );
  } finally {
    process.env.NODE_ENV = previousEnvironment;
  }
});