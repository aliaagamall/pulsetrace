const pino = require("pino");

// Keep error logs short. The default serializer copies every property of
// errors such as AbortError, which adds dozens of useless fields.
function serializeError(error) {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    type: error.name,
    message: error.message,
    code: error.code,
    cause: error.cause ? error.cause.code || error.cause.message : undefined,
    stack: error.stack
  };
}

// Create a JSON logger that tags every line with the service name.
function createLogger(service) {
  return pino({
    level: process.env.LOG_LEVEL || "info",
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      // Print the level as text ("info") instead of a number (30)
      level: (label) => ({ level: label })
    },
    // The key is "error", not "err": pino-http replaces the "err" serializer
    // on request loggers, so a custom one would be ignored.
    serializers: {
      error: serializeError
    }
  });
}

module.exports = { createLogger };