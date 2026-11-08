const pino = require("pino");

// Create a JSON logger that tags every line with the service name.
function createLogger(service) {
  return pino({
    level: process.env.LOG_LEVEL || "info",
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      // Print the level as text ("info") instead of a number (30)
      level: (label) => ({ level: label })
    }
  });
}

module.exports = { createLogger };