const rateLimit = require('express-rate-limit');
const logger = require('./logger');
const { ResponseHandler } = require('./responseHandler');

/**
 * Rate Limiter Configuration Factory
 */
class RateLimiter {
    /**
     * Create a general API rate limiter
     * @returns {Function} Rate limiter middleware
     */
    static createApiLimiter() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                logger.warn({
                    type: 'rate_limit_exceeded',
                    ip: req.ip,
                    path: req.path
                });
                
                ResponseHandler.tooManyRequests(res, {
                    message: 'Too many requests from this IP, please try again later'
                });
            }
        });
    }

    /**
     * Create an authentication rate limiter
     * @returns {Function} Rate limiter middleware
     */
    static createAuthLimiter() {
        return rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 5, // Limit each IP to 5 failed requests per windowMs
            message: 'Too many failed login attempts, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
            skipSuccessfulRequests: true,
            handler: (req, res) => {
                logger.warn({
                    type: 'auth_rate_limit_exceeded',
                    ip: req.ip,
                    path: req.path
                });
                
                ResponseHandler.tooManyRequests(res, {
                    message: 'Too many failed login attempts, please try again later'
                });
            }
        });
    }

    /**
     * Create a file upload rate limiter
     * @returns {Function} Rate limiter middleware
     */
    static createUploadLimiter() {
        return rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 10, // Limit each IP to 10 uploads per windowMs
            message: 'Too many file uploads, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                logger.warn({
                    type: 'upload_rate_limit_exceeded',
                    ip: req.ip,
                    path: req.path
                });
                
                ResponseHandler.tooManyRequests(res, {
                    message: 'Too many file uploads, please try again later'
                });
            }
        });
    }

    /**
     * Create a custom rate limiter
     * @param {Object} options - Rate limiter options
     * @returns {Function} Rate limiter middleware
     */
    static createCustomLimiter(options) {
        const config = {
            windowMs: options.windowMs || 60 * 1000, // Default 1 minute
            max: options.max || 30, // Default 30 requests per windowMs
            message: options.message || 'Too many requests, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                logger.warn({
                    type: 'custom_rate_limit_exceeded',
                    ip: req.ip,
                    path: req.path,
                    limiter: options.name
                });
                
                ResponseHandler.tooManyRequests(res, {
                    message: options.message || 'Too many requests, please try again later'
                });
            },
            ...options
        };

        return rateLimit(config);
    }
}

/**
 * Route-specific rate limiters
 */
const routeLimiters = {
    // Product routes
    products: RateLimiter.createCustomLimiter({
        name: 'products',
        windowMs: 60 * 1000, // 1 minute
        max: 50
    }),

    // Supplier routes
    suppliers: RateLimiter.createCustomLimiter({
        name: 'suppliers',
        windowMs: 60 * 1000, // 1 minute
        max: 30
    }),

    // Order routes
    orders: RateLimiter.createCustomLimiter({
        name: 'orders',
        windowMs: 60 * 1000, // 1 minute
        max: 20
    }),

    // Report generation
    reports: RateLimiter.createCustomLimiter({
        name: 'reports',
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 5
    }),

    // Search operations
    search: RateLimiter.createCustomLimiter({
        name: 'search',
        windowMs: 60 * 1000, // 1 minute
        max: 30
    })
};

/**
 * Middleware to skip rate limiting for trusted IPs
 * @param {string[]} trustedIps - Array of trusted IP addresses
 * @returns {Function} Middleware function
 */
const skipTrustedIps = (trustedIps = []) => {
    return (req, res, next) => {
        if (trustedIps.includes(req.ip)) {
            next();
        } else {
            RateLimiter.createApiLimiter()(req, res, next);
        }
    };
};

/**
 * Middleware to apply different rate limits based on user role
 * @param {Object} limits - Rate limits for different roles
 * @returns {Function} Middleware function
 */
const roleBasedLimiter = (limits = {}) => {
    return (req, res, next) => {
        const userRole = req.user?.role || 'anonymous';
        const limit = limits[userRole] || limits.default || 30;

        RateLimiter.createCustomLimiter({
            name: `role_${userRole}`,
            max: limit
        })(req, res, next);
    };
};

module.exports = {
    RateLimiter,
    routeLimiters,
    skipTrustedIps,
    roleBasedLimiter
};
