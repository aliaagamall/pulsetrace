// Paths that must not be counted: probes would hide real traffic.
const IGNORED_PATHS = new Set(["/health", "/metrics"]);

// Record the count and duration of every request once the response is sent.
function metricsMiddleware(metrics) {
  return (req, res, next) => {
    if (IGNORED_PATHS.has(req.path)) {
      return next();
    }

    const stopTimer = metrics.httpRequestDuration.startTimer();

    res.on("finish", () => {
      // Use the route pattern, never the real path, to keep labels few.
      const route = req.route
        ? `${req.baseUrl}${req.route.path}`
        : "unmatched";

      const labels = {
        method: req.method,
        route,
        status_code: res.statusCode
      };

      metrics.httpRequestsTotal.inc(labels);
      stopTimer(labels);
    });

    next();
  };
}

module.exports = metricsMiddleware;