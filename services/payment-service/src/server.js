const app = require("./app");

const PORT = Number(process.env.PORT) || 3002;

const server = app.listen(PORT, () => {
  console.log(`Payment Service listening on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Shutting down Payment Service.`);

  server.close((error) => {
    if (error) {
      console.error("Failed to close Payment Service:", error);
      process.exitCode = 1;
    }

    process.exit();
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));