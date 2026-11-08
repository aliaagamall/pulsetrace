const { Pool } = require("pg");
const path = require("node:path");

const createApp = require("./app");
const PostgresOrderRepository = require("./repositories/postgres-order.repository");
const runMigrations = require("./database/run-migrations");

const PORT = Number(process.env.PORT) || 3001;

const pool = new Pool({
  connectionTimeoutMillis: 5000
});

let server;
let isShuttingDown = false;

pool.on("error", (error) => {
  console.error("Unexpected Order Service database error:", error);
});

async function start() {
  await pool.query("SELECT 1");

  await runMigrations(
    pool,
    path.resolve(__dirname, "../../../database/migrations/order")
  );

  const app = createApp({
    orderRepository: new PostgresOrderRepository(pool)
  });

  server = app.listen(PORT, () => {
    console.log(`Order Service listening on port ${PORT}`);
  });
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`${signal} received. Shutting down Order Service.`);

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
    console.error("Failed to close Order Service:", error);
    process.exitCode = 1;
  }

  try {
    await pool.end();
  } catch (error) {
    console.error("Failed to close Order Service database pool:", error);
    process.exitCode = 1;
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch(async (error) => {
  console.error("Failed to start Order Service:", error);

  try {
    await pool.end();
  } catch (poolError) {
    console.error("Failed to close database pool:", poolError);
  }

  process.exitCode = 1;
});
