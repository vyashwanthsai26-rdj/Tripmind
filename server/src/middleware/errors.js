export class AppError extends Error {
  constructor(statusCode, publicMessage) {
    super(publicMessage);
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
  }
}

export function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: { message: "We couldn't find that TripMind resource." },
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  console.error("Request failed:", error);
  const statusCode = error.statusCode ?? error.status ?? 500;
  const message = error.publicMessage
    || (statusCode >= 400 && statusCode < 500
      ? "That request couldn't be read. Please check the information and try again."
      : "TripMind couldn't complete that request. Please try again.");
  res.status(statusCode).json({
    success: false,
    error: { message },
  });
}
