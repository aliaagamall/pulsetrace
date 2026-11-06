function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || error.status || 500;

  let code = error.code || "INTERNAL_SERVER_ERROR";

  if (statusCode === 400 && !error.code) {
    code = "INVALID_REQUEST_BODY";
  }

  const message =
    statusCode >= 500
      ? "An unexpected error occurred."
      : error.message;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    error: {
      code,
      message: message || "Invalid request."
    }
  });
}

module.exports = errorHandler;