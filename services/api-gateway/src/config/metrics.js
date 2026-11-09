const client = require("prom-client");

// Create one registry per app so tests never register the same metric twice.
function createMetrics(service) {
  const registry = new client.Registry();
  registry.setDefaultLabels({ service });

  // Memory, CPU, event loop, and garbage collection metrics.
  client.collectDefaultMetrics({ register: registry });

  const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
    registers: [registry]
  });

  const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry]
  });

  const gatewayUpstreamErrorsTotal = new client.Counter({
    name: "gateway_upstream_errors_total",
    help: "Errors returned by the gateway when the Order Service fails",
    labelNames: ["code"],
    registers: [registry]
  });

  return {
    registry,
    httpRequestsTotal,
    httpRequestDuration,
    gatewayUpstreamErrorsTotal
  };
}

module.exports = { createMetrics };