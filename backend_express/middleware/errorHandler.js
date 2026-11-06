import logger from "../utils/logger.js";

/**
 * Centralized production error handler (Req #10, #56).
 * Formats errors consistently, strips stack traces in production, and logs with correlation ID.
 */
export const errorHandler = (err, req, res, next) => {
    const correlationId = req.headers["x-request-id"] || req.id || null;
    const statusCode = err.status || err.statusCode || 500;
    const isProd = process.env.NODE_ENV === "production";

    logger.error("Request Error", err, {
        correlationId,
        url: req.originalUrl,
        method: req.method,
        statusCode
    });

    const response = {
        success: false,
        error: {
            code: err.code || "INTERNAL_ERROR",
            message: isProd && statusCode === 500 ? "An unexpected error occurred" : err.message,
            correlationId
        }
    };

    if (!isProd && err.stack) {
        response.error.stack = err.stack;
    }

    res.status(statusCode).json(response);
};

export default errorHandler;

