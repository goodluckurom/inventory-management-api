/**
 * Custom error class for API error responses
 * Extends the built-in Error class to include a status code
 */
class ErrorResponse extends Error {
    constructor(message, statusCode, code = null, meta = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.meta = meta;
        this.success = false;
        this.timestamp = new Date().toISOString();

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }

        // Ensure the name of this error is the same as the class name
        this.name = this.constructor.name;
    }

    /**
     * Creates a 400 Bad Request error
     * @param {string} message - Error message
     * @returns {ErrorResponse}
     */
    static badRequest(message) {
        return new ErrorResponse(message || 'Bad Request', 400);
    }

    /**
     * Creates a 401 Unauthorized error
     * @param {string} message - Error message
     * @returns {ErrorResponse}
     */
    static unauthorized(message) {
        return new ErrorResponse(message || 'Unauthorized', 401);
    }

    /**
     * Creates a 403 Forbidden error
     * @param {string} message - Error message
     * @returns {ErrorResponse}
     */
    static forbidden(message) {
        return new ErrorResponse(message || 'Forbidden', 403);
    }

    /**
     * Creates a 404 Not Found error
     * @param {string} message - Error message
     * @returns {ErrorResponse}
     */
    static notFound(message) {
        return new ErrorResponse(message || 'Resource not found', 404);
    }

    /**
     * Creates a 409 Conflict error
     * @param {string} message - Error message
     * @returns {ErrorResponse}
     */
    static conflict(message) {
        return new ErrorResponse(message || 'Resource conflict', 409);
    }

    /**
     * Creates a 422 Unprocessable Entity error
     * @param {string} message - Error message
     * @returns {ErrorResponse}
     */
    static validationError(message) {
        return new ErrorResponse(message || 'Validation failed', 422);
    }

    /**
     * Creates a 429 Too Many Requests error
     * @param {string} message - Error message
     * @returns {ErrorResponse}
     */
    static tooManyRequests(message) {
        return new ErrorResponse(message || 'Too many requests', 429);
    }

    /**
     * Creates a 500 Internal Server Error
     * @param {string} message - Error message
     * @returns {ErrorResponse}
     */
    static internal(message) {
        return new ErrorResponse(message || 'Internal server error', 500);
    }

    /**
     * Converts the error to a plain object for response
     * @returns {Object}
     */
    toJSON() {
        return {
            success: this.success,
            error: {
                message: this.message,
                code: this.code,
                statusCode: this.statusCode,
                ...(process.env.NODE_ENV === 'development' && {
                    stack: this.stack,
                    meta: this.meta
                })
            },
            timestamp: this.timestamp
        };
    }
}

module.exports = ErrorResponse;
