const { randomUUID } = require("node:crypto");

// Accept only short, simple IDs so odd text cannot end up in the logs.
const VALID_REQUEST_ID = /^[A-Za-z0-9-]{1,64}$/;

// Reuse the incoming x-request-id or generate a new one.
function resolveRequestId(req, res) {
  const incoming = req.headers["x-request-id"];

  const requestId =
    typeof incoming === "string" && VALID_REQUEST_ID.test(incoming)
      ? incoming
      : randomUUID();

  res.setHeader("x-request-id", requestId);

  return requestId;
}

module.exports = { resolveRequestId };