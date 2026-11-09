// An error the service raises on purpose, safe to show to the client.
class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

module.exports = AppError;
