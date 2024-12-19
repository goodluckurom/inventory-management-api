const { prisma } = require('../server');
const logger = require('./logger');
const { EventHelper } = require('./eventEmitter');
const config = require('./config');

/**
 * Audit Logger Utility
 */
class AuditLogger {
    constructor() {
        this.enabled = config.get('logging.auditEnabled') !== false;
        this.retentionDays = config.get('logging.auditRetentionDays') || 90;
    }

    /**
     * Log audit event
     * @param {Object} options - Audit options
     * @returns {Promise<Object>} Created audit log
     */
    async log({
        action,
        entityType,
        entityId,
        userId,
        changes,
        metadata = {},
        ipAddress,
        userAgent
    }) {
        if (!this.enabled) return null;

        try {
            const auditLog = await prisma.auditLog.create({
                data: {
                    action,
                    entityType,
                    entityId,
                    userId,
                    changes: changes ? JSON.stringify(changes) : null,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                    ipAddress,
                    userAgent
                }
            });

            // Log to application logger
            logger.info({
                type: 'audit',
                ...auditLog
            });

            // Emit audit event
            EventHelper.emitSystemEvent('system:audit_log', auditLog);

            return auditLog;
        } catch (error) {
            logger.error('Error creating audit log:', error);
            // Don't throw error to prevent disrupting main operation
            return null;
        }
    }

    /**
     * Create audit middleware
     * @param {Object} options - Middleware options
     * @returns {Function} Express middleware
     */
    createMiddleware(options = {}) {
        return async (req, res, next) => {
            const originalJson = res.json;
            const startTime = Date.now();

            // Override res.json to capture response
            res.json = function(data) {
                res.locals.responseData = data;
                return originalJson.apply(this, arguments);
            };

            // Continue with request
            next();

            // Log after response
            res.on('finish', async () => {
                if (!this.enabled) return;

                try {
                    const duration = Date.now() - startTime;
                    const userId = req.user?.id;
                    const action = `${req.method} ${req.path}`;
                    const statusCode = res.statusCode;

                    await this.log({
                        action,
                        entityType: options.entityType || 'api_request',
                        entityId: req.params.id,
                        userId,
                        changes: {
                            request: {
                                method: req.method,
                                path: req.path,
                                query: req.query,
                                body: this._sanitizeBody(req.body)
                            },
                            response: {
                                statusCode,
                                data: res.locals.responseData
                            }
                        },
                        metadata: {
                            duration,
                            statusCode
                        },
                        ipAddress: req.ip,
                        userAgent: req.get('user-agent')
                    });
                } catch (error) {
                    logger.error('Error in audit middleware:', error);
                }
            });
        };
    }

    /**
     * Log data changes
     * @param {Object} options - Change options
     * @returns {Promise<Object>} Created audit log
     */
    async logChanges({
        action,
        entityType,
        entityId,
        userId,
        oldData,
        newData,
        metadata = {}
    }) {
        if (!this.enabled) return null;

        const changes = this._generateChanges(oldData, newData);

        return await this.log({
            action,
            entityType,
            entityId,
            userId,
            changes,
            metadata
        });
    }

    /**
     * Generate changes between old and new data
     * @param {Object} oldData - Old data
     * @param {Object} newData - New data
     * @returns {Object} Changes object
     * @private
     */
    _generateChanges(oldData, newData) {
        const changes = {
            added: {},
            modified: {},
            removed: {}
        };

        // Find added and modified fields
        Object.keys(newData || {}).forEach(key => {
            if (!oldData || !(key in oldData)) {
                changes.added[key] = newData[key];
            } else if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
                changes.modified[key] = {
                    from: oldData[key],
                    to: newData[key]
                };
            }
        });

        // Find removed fields
        Object.keys(oldData || {}).forEach(key => {
            if (!newData || !(key in newData)) {
                changes.removed[key] = oldData[key];
            }
        });

        return changes;
    }

    /**
     * Sanitize request body for logging
     * @param {Object} body - Request body
     * @returns {Object} Sanitized body
     * @private
     */
    _sanitizeBody(body) {
        const sensitiveFields = ['password', 'token', 'secret', 'credit_card'];
        const sanitized = { ...body };

        const sanitizeObject = (obj) => {
            Object.keys(obj).forEach(key => {
                if (sensitiveFields.includes(key.toLowerCase())) {
                    obj[key] = '***REDACTED***';
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    sanitizeObject(obj[key]);
                }
            });
        };

        sanitizeObject(sanitized);
        return sanitized;
    }

    /**
     * Clean up old audit logs
     * @returns {Promise<number>} Number of deleted logs
     */
    async cleanup() {
        if (!this.enabled) return 0;

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

            const { count } = await prisma.auditLog.deleteMany({
                where: {
                    createdAt: {
                        lt: cutoffDate
                    }
                }
            });

            logger.info(`Cleaned up ${count} audit logs older than ${this.retentionDays} days`);
            return count;
        } catch (error) {
            logger.error('Error cleaning up audit logs:', error);
            throw error;
        }
    }

    /**
     * Get audit logs
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Audit logs with pagination
     */
    async getLogs(options = {}) {
        if (!this.enabled) return { logs: [], total: 0 };

        try {
            const {
                page = 1,
                limit = 10,
                userId,
                entityType,
                entityId,
                action,
                startDate,
                endDate,
                sortBy = 'createdAt',
                order = 'desc'
            } = options;

            const where = {
                ...(userId && { userId }),
                ...(entityType && { entityType }),
                ...(entityId && { entityId }),
                ...(action && { action: { contains: action } }),
                ...(startDate && endDate && {
                    createdAt: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                })
            };

            const [total, logs] = await Promise.all([
                prisma.auditLog.count({ where }),
                prisma.auditLog.findMany({
                    where,
                    orderBy: { [sortBy]: order },
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        user: {
                            select: {
                                email: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                })
            ]);

            return {
                logs,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('Error getting audit logs:', error);
            throw error;
        }
    }
}

module.exports = new AuditLogger();
