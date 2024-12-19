const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Define custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Define log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: logLevels,
    format: logFormat,
    transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        })
    ]
});

// Add console transport in development environment
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ level, message, timestamp, ...metadata }) => {
                let msg = `${timestamp} [${level}] : ${message}`;
                if (Object.keys(metadata).length > 0) {
                    msg += JSON.stringify(metadata);
                }
                return msg;
            })
        )
    }));
}

// Create a stream object for Morgan HTTP logging
logger.stream = {
    write: (message) => logger.http(message.trim())
};

// Helper functions for common logging patterns
logger.logAPIRequest = (req, duration) => {
    logger.http({
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        duration: `${duration}ms`,
        userAgent: req.get('user-agent'),
        user: req.user ? req.user.id : 'anonymous'
    });
};

logger.logError = (error, req = null) => {
    const errorLog = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    };

    if (req) {
        errorLog.method = req.method;
        errorLog.url = req.originalUrl;
        errorLog.ip = req.ip;
        errorLog.user = req.user ? req.user.id : 'anonymous';
    }

    logger.error(errorLog);
};

logger.logDatabaseQuery = (query, duration) => {
    logger.debug({
        type: 'database_query',
        query: query,
        duration: `${duration}ms`
    });
};

logger.logInventoryChange = (productId, type, quantity, userId) => {
    logger.info({
        type: 'inventory_change',
        productId,
        changeType: type,
        quantity,
        userId,
        timestamp: new Date().toISOString()
    });
};

logger.logSecurityEvent = (event, userId = null, details = {}) => {
    logger.warn({
        type: 'security_event',
        event,
        userId,
        details,
        timestamp: new Date().toISOString()
    });
};

logger.logNotification = (type, recipients, message) => {
    logger.info({
        type: 'notification_sent',
        notificationType: type,
        recipients: Array.isArray(recipients) ? recipients : [recipients],
        message,
        timestamp: new Date().toISOString()
    });
};

logger.logSystemEvent = (event, details = {}) => {
    logger.info({
        type: 'system_event',
        event,
        details,
        timestamp: new Date().toISOString()
    });
};

// Performance monitoring
logger.logPerformanceMetric = (metric, value, tags = {}) => {
    logger.debug({
        type: 'performance_metric',
        metric,
        value,
        tags,
        timestamp: new Date().toISOString()
    });
};

// Audit logging
logger.logAuditEvent = (action, userId, resourceType, resourceId, changes = null) => {
    logger.info({
        type: 'audit',
        action,
        userId,
        resourceType,
        resourceId,
        changes,
        timestamp: new Date().toISOString()
    });
};

// Export logger instance
module.exports = logger;
