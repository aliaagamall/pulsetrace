const app = require("./app");

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Shutting down API Gateway.`);

  server.close((error) => {
    if (error) {
      console.error("Failed to close API Gateway:", error);
      process.exitCode = 1;
    }

    process.exit();
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));