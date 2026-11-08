const { Pool } = require("pg");

const pool = new Pool({
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on("error", (error) => {
  console.error("Unexpected Order Service database error:", error);
});

module.exports = pool;
