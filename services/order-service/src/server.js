const app = require("./app");

const PORT = Number(process.env.PORT) || 3001;

const server = app.listen(PORT, () => {
  console.log(`Order Service listening on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Shutting down Order Service.`);

  server.close((error) => {
    if (error) {
      console.error("Failed to close Order Service:", error);
      process.exitCode = 1;
    }

    process.exit();
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));