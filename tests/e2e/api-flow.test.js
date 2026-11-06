const test = require("node:test");
const assert = require("node:assert/strict");

const gatewayUrl = process.env.GATEWAY_URL || "http://localhost:3000";

async function sendRequest(path, options = {}) {
  const response = await fetch(`${gatewayUrl}${path}`, options);
  const data = await response.json();

  return {
    status: response.status,
    data
  };
}

test("PulseTrace end-to-end flow", async (t) => {
  let paidOrderId;

  await t.test("all services should be healthy", async () => {
    const services = [
      ["api-gateway", "http://localhost:3000"],
      ["order-service", "http://localhost:3001"],
      ["payment-service", "http://localhost:3002"]
    ];

    for (const [serviceName, baseUrl] of services) {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();

      assert.equal(response.status, 200);
      assert.equal(data.status, "ok");
      assert.equal(data.service, serviceName);
    }
  });

  await t.test("should create an order and complete payment", async () => {
    const response = await sendRequest("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customerId: "e2e-customer-001",
        amount: 1500,
        currency: "EGP"
      })
    });

    assert.equal(response.status, 201);
    assert.ok(response.data.data.id);
    assert.ok(response.data.data.paymentId);
    assert.equal(response.data.data.status, "PAID");

    paidOrderId = response.data.data.id;
  });

  await t.test("should retrieve the created order through the gateway", async () => {
    const response = await sendRequest(`/api/orders/${paidOrderId}`);

    assert.equal(response.status, 200);
    assert.equal(response.data.data.id, paidOrderId);
    assert.equal(response.data.data.status, "PAID");
    assert.ok(response.data.data.paymentId);
  });

  await t.test("should handle a failed payment", async () => {
    const response = await sendRequest("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customerId: "e2e-customer-002",
        amount: 750,
        currency: "EGP",
        simulateFailure: true
      })
    });

    assert.equal(response.status, 201);
    assert.ok(response.data.data.id);
    assert.ok(response.data.data.paymentId);
    assert.equal(response.data.data.status, "PAYMENT_FAILED");
  });

  await t.test("should reject invalid order data", async () => {
    const response = await sendRequest("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customerId: "e2e-customer-003",
        amount: -100,
        currency: "EGP"
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.data.error.code, "INVALID_AMOUNT");
  });

  await t.test("should return 404 for an unknown order", async () => {
    const response = await sendRequest(
      "/api/orders/00000000-0000-4000-8000-000000000000"
    );

    assert.equal(response.status, 404);
    assert.equal(response.data.error.code, "ORDER_NOT_FOUND");
  });
});
