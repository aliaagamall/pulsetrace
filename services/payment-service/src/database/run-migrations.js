const fs = require("node:fs/promises");
const path = require("node:path");

async function runMigrations(pool, migrationDirectory, logger) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await fs.readdir(migrationDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const filename of files) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [filename]
      );

      if (result.rowCount === 0) {
        const migrationPath = path.join(migrationDirectory, filename);
        const sql = await fs.readFile(migrationPath, "utf8");

        await client.query(sql);

        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [filename]
        );

        logger?.info({ migration: filename }, "Applied migration");
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = runMigrations;