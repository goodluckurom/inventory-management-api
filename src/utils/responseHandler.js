const logger = require('./logger');

/**
 * Standard API Response Handler
 */
class ResponseHandler {
    /**
     * Send success response
     * @param {Object} res - Express response object
     * @param {number} statusCode - HTTP status code
     * @param {string} message - Success message
     * @param {any} data - Response data
     * @param {Object} meta - Additional metadata
     */
    static success(res, { statusCode = 200, message = 'Success', data = null, meta = null }) {
        const response = {
            success: true,
            message,
            timestamp: new Date().toISOString()
        };

        if (data !== null) {
            response.data = data;
        }

        if (meta !== null) {
            response.meta = meta;
        }

        res.status(statusCode).json(response);
    }

    /**
     * Send error response
     * @param {Object} res - Express response object
     * @param {number} statusCode - HTTP status code
     * @param {string} message - Error message
     * @param {string} code - Error code
     * @param {Object} errors - Detailed errors
     */
    static error(res, { statusCode = 500, message = 'Internal Server Error', code = null, errors = null }) {
        const response = {
            success: false,
            message,
            timestamp: new Date().toISOString()
        };

        if (code) {
            response.code = code;
        }

        if (errors) {
            response.errors = errors;
        }

        if (process.env.NODE_ENV === 'development') {
            response.stack = new Error().stack;
        }

        res.status(statusCode).json(response);
    }

    /**
     * Send paginated response
     * @param {Object} res - Express response object
     * @param {Array} data - Data array
     * @param {number} page - Current page
     * @param {number} limit - Items per page
     * @param {number} total - Total items
     * @param {string} message - Success message
     */
    static paginated(res, { data, page, limit, total, message = 'Success' }) {
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        const response = {
            success: true,
            message,
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNextPage,
                hasPrevPage
            },
            timestamp: new Date().toISOString()
        };

        res.status(200).json(response);
    }

    /**
     * Send created response
     * @param {Object} res - Express response object
     * @param {any} data - Created resource data
     * @param {string} message - Success message
     */
    static created(res, { data, message = 'Resource created successfully' }) {
        this.success(res, {
            statusCode: 201,
            message,
            data
        });
    }

    /**
     * Send updated response
     * @param {Object} res - Express response object
     * @param {any} data - Updated resource data
     * @param {string} message - Success message
     */
    static updated(res, { data, message = 'Resource updated successfully' }) {
        this.success(res, {
            statusCode: 200,
            message,
            data
        });
    }

    /**
     * Send deleted response
     * @param {Object} res - Express response object
     * @param {string} message - Success message
     */
    static deleted(res, { message = 'Resource deleted successfully' }) {
        this.success(res, {
            statusCode: 200,
            message
        });
    }

    /**
     * Send no content response
     * @param {Object} res - Express response object
     */
    static noContent(res) {
        res.status(204).send();
    }

    /**
     * Send unauthorized response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static unauthorized(res, { message = 'Unauthorized access' }) {
        this.error(res, {
            statusCode: 401,
            message,
            code: 'UNAUTHORIZED'
        });
    }

    /**
     * Send forbidden response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static forbidden(res, { message = 'Access forbidden' }) {
        this.error(res, {
            statusCode: 403,
            message,
            code: 'FORBIDDEN'
        });
    }

    /**
     * Send not found response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static notFound(res, { message = 'Resource not found' }) {
        this.error(res, {
            statusCode: 404,
            message,
            code: 'NOT_FOUND'
        });
    }

    /**
     * Send validation error response
     * @param {Object} res - Express response object
     * @param {Object} errors - Validation errors
     * @param {string} message - Error message
     */
    static validationError(res, { errors, message = 'Validation failed' }) {
        this.error(res, {
            statusCode: 422,
            message,
            code: 'VALIDATION_ERROR',
            errors
        });
    }

    /**
     * Send conflict response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static conflict(res, { message = 'Resource conflict' }) {
        this.error(res, {
            statusCode: 409,
            message,
            code: 'CONFLICT'
        });
    }

    /**
     * Send too many requests response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static tooManyRequests(res, { message = 'Too many requests' }) {
        this.error(res, {
            statusCode: 429,
            message,
            code: 'TOO_MANY_REQUESTS'
        });
    }

    /**
     * Send service unavailable response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static serviceUnavailable(res, { message = 'Service temporarily unavailable' }) {
        this.error(res, {
            statusCode: 503,
            message,
            code: 'SERVICE_UNAVAILABLE'
        });
    }
}

// Response Interceptor Middleware
const responseInterceptor = (req, res, next) => {
    // Store the original res.json function
    const originalJson = res.json;

    // Override res.json
    res.json = function(data) {
        // Log the response
        logger.debug({
            type: 'response',
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTime: Date.now() - req.startTime,
            response: process.env.NODE_ENV === 'development' ? data : undefined
        });

        // Call the original json function
        return originalJson.call(this, data);
    };

    next();
};

module.exports = {
    ResponseHandler,
    responseInterceptor
};
