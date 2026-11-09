const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const createApp = require("../src/app");

process.env.NODE_ENV = "test";

const ORDER_ID = "6f1c2a3e-8b4d-4e5f-9a7b-1c2d3e4f5a6b";

test("GET /metrics returns Prometheus text with default metrics", async () => {
  const app = createApp();

  const response = await request(app).get("/metrics");

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/plain/);
  assert.match(response.text, /process_cpu_user_seconds_total/);
});

test("payments are counted by result status", async () => {
  const app = createApp();

  await request(app)
    .post("/payments")
    .send({ orderId: ORDER_ID, amount: 100, currency: "EGP" });
  await request(app)
    .post("/payments")
    .send({ orderId: ORDER_ID, amount: 100, currency: "EGP", simulateFailure: true });
  await request(app)
    .post("/payments")
    .send({ orderId: ORDER_ID, amount: 100, currency: "EGP", simulateFailure: true });

  const response = await request(app).get("/metrics");

  assert.match(response.text, /payments_processed_total\{status="SUCCEEDED"[^}]*\} 1/);
  assert.match(response.text, /payments_processed_total\{status="FAILED"[^}]*\} 2/);
});

test("metrics use the route pattern, not the real path", async () => {
  const app = createApp();

  await request(app).get(`/payments/${ORDER_ID}`);

  const response = await request(app).get("/metrics");
  const lines = response.text
    .split("\n")
    .filter((line) => line.startsWith("http_requests_total"));

  assert.ok(lines.some((line) => line.includes('route="/payments/:id"')));
  assert.ok(lines.every((line) => !line.includes("6f1c2a3e")));
});

test("health and metrics requests are not counted", async () => {
  const app = createApp();

  await request(app).get("/health");
  await request(app).get("/metrics");

  const response = await request(app).get("/metrics");

  assert.ok(!response.text.includes('route="/health"'));
  assert.ok(!response.text.includes('route="/metrics"'));
});