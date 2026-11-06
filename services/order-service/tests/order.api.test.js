
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const createApp = require("../src/app");

process.env.NODE_ENV = "test";

test("POST /orders creates a new order", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/orders")
    .send({
      customerId: "customer-123",
      amount: 1500,
      currency: "EGP"
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.customerId, "customer-123");
  assert.equal(response.body.data.amount, 1500);
  assert.equal(response.body.data.currency, "EGP");
  assert.equal(response.body.data.status, "PENDING");
  assert.equal(response.body.data.paymentId, null);
  assert.ok(response.body.data.id);
});

test("POST /orders rejects an invalid amount", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/orders")
    .send({
      customerId: "customer-123",
      amount: -100,
      currency: "EGP"
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "INVALID_AMOUNT");
});

test("POST /orders rejects an invalid customer ID", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/orders")
    .send({
      customerId: "",
      amount: 1500,
      currency: "EGP"
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "INVALID_CUSTOMER_ID");
});

test("POST /orders rejects an invalid currency", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/orders")
    .send({
      customerId: "customer-123",
      amount: 1500,
      currency: "egp"
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "INVALID_CURRENCY");
});

test("GET /orders/:id returns an existing order", async () => {
  const app = createApp();

  const createResponse = await request(app)
    .post("/orders")
    .send({
      customerId: "customer-123",
      amount: 1500,
      currency: "EGP"
    });

  const orderId = createResponse.body.data.id;

  const response = await request(app)
    .get(`/orders/${orderId}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.id, orderId);
  assert.equal(response.body.data.status, "PENDING");
});

test("GET /orders/:id returns 404 for an unknown order", async () => {
  const app = createApp();

  const response = await request(app)
    .get("/orders/non-existing-id");

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "ORDER_NOT_FOUND");
});
