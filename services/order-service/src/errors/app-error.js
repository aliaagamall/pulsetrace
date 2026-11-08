function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || error.status || 500;
  const isServerError = statusCode >= 500;

  let code;

  if (isServerError) {
    code = "INTERNAL_SERVER_ERROR";
  } else if (error.isOperational) {
    code = error.code;
  } else {
    code = "INVALID_REQUEST_BODY";
  }

  if (isServerError) {
    // The request logger already carries the request ID.
    req.log.error({ err: error }, "Unhandled error");
  }

  res.status(statusCode).json({
    error: {
      code,
      message: isServerError
        ? "An unexpected error occurred."
        : error.message || "Invalid request."
    }
  });
}

module.exports = errorHandler;