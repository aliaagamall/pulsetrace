const { test } = require("node:test");
const assert = require("node:assert/strict");

const OrderClient = require("../src/clients/order.client");

test("maps fetch connection failures to upstream unavailable errors", async () => {
  const client = new OrderClient({
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    }
  });

  await assert.rejects(
    client.request("/orders"),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "ORDER_SERVICE_UNAVAILABLE");
      assert.equal(error.isUpstreamError, true);
      return true;
    }
  );
});

test("maps malformed upstream JSON to an invalid response error", async () => {
  const client = new OrderClient({
    fetchImpl: async () => ({
      status: 200,
      async json() {
        throw new SyntaxError("Unexpected token");
      }
    })
  });

  await assert.rejects(
    client.request("/orders"),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.code, "ORDER_SERVICE_INVALID_RESPONSE");
      assert.equal(error.isUpstreamError, true);
      return true;
    }
  );
});

test("does not classify a valid upstream 4xx response as a technical failure", async () => {
  const client = new OrderClient({
    fetchImpl: async () => ({
      status: 404,
      async json() {
        return { error: { code: "ORDER_NOT_FOUND" } };
      }
    })
  });

  const result = await client.request("/orders/missing");

  assert.equal(result.status, 404);
  assert.equal(result.data.error.code, "ORDER_NOT_FOUND");
});

test("maps an aborted request to an upstream timeout error", async () => {
  const client = new OrderClient({
    timeout: 5,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        reject(error);
      });
    })
  });

  await assert.rejects(
    client.request("/orders"),
    (error) => {
      assert.equal(error.statusCode, 504);
      assert.equal(error.code, "ORDER_SERVICE_TIMEOUT");
      assert.equal(error.isUpstreamError, true);
      return true;
    }
  );
});