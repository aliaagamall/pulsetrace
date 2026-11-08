const { Pool } = require("pg");
const path = require("node:path");

const createApp = require("./app");
const PostgresPaymentRepository = require("./repositories/postgres-payment.repository");
const runMigrations = require("./database/run-migrations");
const { createLogger } = require("./config/logger");

const logger = createLogger("payment-service");

const PORT = Number(process.env.PORT) || 3002;

const pool = new Pool({
  connectionTimeoutMillis: 5000
});

let server;
let isShuttingDown = false;

pool.on("error", (error) => {
  logger.error({ error }, "Unexpected database error");
});

async function start() {
  await pool.query("SELECT 1");

  await runMigrations(
    pool,
    path.resolve(__dirname, "../../../database/migrations/payment"),
    logger
  );

  const app = createApp({
    paymentRepository: new PostgresPaymentRepository(pool),
    logger
  });

  server = app.listen(PORT, () => {
    logger.info({ port: PORT }, "Payment Service listening");
  });
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Shutting down Payment Service");

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  } catch (error) {
    logger.error({ error }, "Failed to close Payment Service");
    process.exitCode = 1;
  }

  try {
    await pool.end();
  } catch (error) {
    logger.error({ error }, "Failed to close database pool");
    process.exitCode = 1;
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch(async (error) => {
  logger.error({ error }, "Failed to start Payment Service");

  try {
    await pool.end();
  } catch (poolError) {
    logger.error({ error: poolError }, "Failed to close database pool");
  }

  process.exitCode = 1;
});