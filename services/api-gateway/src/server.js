const createApp = require("./app");
const { createLogger } = require("./config/logger");

const logger = createLogger("api-gateway");
const app = createApp({ logger });

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "API Gateway listening");
});

function shutdown(signal) {
  logger.info({ signal }, "Shutting down API Gateway");

  server.close((error) => {
    if (error) {
      logger.error({ error }, "Failed to close API Gateway");
      process.exitCode = 1;
    }

    process.exit();
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));