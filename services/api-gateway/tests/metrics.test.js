const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const createApp = require("../src/app");

function createOkClient() {
  return {
    async request() {
      return { status: 200, data: { data: { id: "order" } } };
    }
  };
}

test("GET /metrics returns Prometheus text with default metrics", async () => {
  const app = createApp({ orderClient: createOkClient() });

  const response = await request(app).get("/metrics");

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/plain/);
  assert.match(response.text, /process_cpu_user_seconds_total/);
});

test("metrics use the route pattern, not the real path", async () => {
  const app = createApp({ orderClient: createOkClient() });

  await request(app).get("/api/orders/abc-123");
  await request(app).get("/api/orders/def-456");

  const response = await request(app).get("/metrics");

  assert.ok(response.text.includes('route="/api/orders/:id"'));
  assert.ok(!response.text.includes("abc-123"));
  assert.ok(!response.text.includes("def-456"));
});

test("unknown routes are grouped under one label", async () => {
  const app = createApp();

  await request(app).get("/some/random/path");

  const response = await request(app).get("/metrics");

  assert.ok(response.text.includes('route="unmatched"'));
  assert.ok(!response.text.includes("/some/random/path"));
});

test("health and metrics requests are not counted", async () => {
  const app = createApp();

  await request(app).get("/health");
  await request(app).get("/metrics");

  const response = await request(app).get("/metrics");

  assert.ok(!response.text.includes('route="/health"'));
  assert.ok(!response.text.includes('route="/metrics"'));
});

test("upstream failures are counted by error code", async () => {
  const orderClient = {
    async request() {
      const error = new Error("Order Service request timed out.");
      error.statusCode = 504;
      error.code = "ORDER_SERVICE_TIMEOUT";
      throw error;
    }
  };

  const app = createApp({ orderClient });

  await request(app).get("/api/orders/abc-123");

  const response = await request(app).get("/metrics");

  assert.ok(response.text.includes("gateway_upstream_errors_total"));
  assert.ok(response.text.includes('code="ORDER_SERVICE_TIMEOUT"'));
});