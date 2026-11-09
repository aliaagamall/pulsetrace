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
      // routeBase is saved by the router because baseUrl is reset after an error.
      const base = res.locals.routeBase ?? req.baseUrl ?? "";
      const pattern = `${base}${req.route?.path ?? ""}`;
      const route = req.route
        ? pattern.replace(/(.)\/$/, "$1")
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