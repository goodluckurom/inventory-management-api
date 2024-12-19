const logger = require('./logger');
const config = require('./config');
const { EventHelper } = require('./eventEmitter');
const { prisma } = require('../server');

/**
 * Error Tracker Utility
 */
class ErrorTracker {
    constructor() {
        this.errors = new Map();
        this.errorThresholds = {
            severity: {
                critical: 1,    // Immediate notification
                high: 5,       // Notify after 5 occurrences
                medium: 10,    // Notify after 10 occurrences
                low: 20        // Notify after 20 occurrences
            },
            timeWindow: 3600000 // 1 hour in milliseconds
        };
        this.retentionPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    }

    /**
     * Track error
     * @param {Error} error - Error object
     * @param {Object} context - Error context
     * @returns {Promise<void>}
     */
    async trackError(error, context = {}) {
        try {
            const errorData = this._processError(error, context);
            
            // Store error
            await this._storeError(errorData);

            // Check thresholds
            await this._checkThresholds(errorData);

            // Emit event
            EventHelper.emitSystemEvent('error:tracked', errorData);

            // Log error
            this._logError(errorData);
        } catch (err) {
            logger.error('Error tracking error:', err);
        }
    }

    /**
     * Get error statistics
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Error statistics
     */
    async getStatistics(options = {}) {
        try {
            const {
                startDate = new Date(Date.now() - this.retentionPeriod),
                endDate = new Date(),
                groupBy = 'type'
            } = options;

            const errors = await prisma.error.findMany({
                where: {
                    timestamp: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            });

            return this._calculateStatistics(errors, groupBy);
        } catch (error) {
            logger.error('Error getting statistics:', error);
            throw error;
        }
    }

    /**
     * Get error trends
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Error trends
     */
    async getTrends(options = {}) {
        try {
            const {
                period = '24h',
                groupBy = 'hour'
            } = options;

            const startDate = this._getStartDate(period);
            const errors = await prisma.error.findMany({
                where: {
                    timestamp: {
                        gte: startDate
                    }
                }
            });

            return this._calculateTrends(errors, groupBy);
        } catch (error) {
            logger.error('Error getting trends:', error);
            throw error;
        }
    }

    /**
     * Process error
     * @param {Error} error - Error object
     * @param {Object} context - Error context
     * @returns {Object} Processed error data
     * @private
     */
    _processError(error, context) {
        return {
            type: error.name || 'Error',
            message: error.message,
            stack: error.stack,
            severity: this._determineSeverity(error),
            timestamp: new Date(),
            context: {
                ...context,
                environment: process.env.NODE_ENV,
                nodeVersion: process.version,
                platform: process.platform
            },
            metadata: {
                code: error.code,
                status: error.status,
                ...error.metadata
            }
        };
    }

    /**
     * Store error
     * @param {Object} errorData - Error data
     * @returns {Promise<void>}
     * @private
     */
    async _storeError(errorData) {
        try {
            await prisma.error.create({
                data: {
                    type: errorData.type,
                    message: errorData.message,
                    stack: errorData.stack,
                    severity: errorData.severity,
                    context: errorData.context,
                    metadata: errorData.metadata,
                    timestamp: errorData.timestamp
                }
            });

            // Update error count in memory
            const key = this._getErrorKey(errorData);
            const existing = this.errors.get(key) || {
                count: 0,
                firstSeen: errorData.timestamp,
                lastSeen: errorData.timestamp
            };

            this.errors.set(key, {
                ...existing,
                count: existing.count + 1,
                lastSeen: errorData.timestamp
            });
        } catch (error) {
            logger.error('Error storing error:', error);
        }
    }

    /**
     * Check error thresholds
     * @param {Object} errorData - Error data
     * @returns {Promise<void>}
     * @private
     */
    async _checkThresholds(errorData) {
        const key = this._getErrorKey(errorData);
        const errorInfo = this.errors.get(key);

        if (!errorInfo) return;

        const threshold = this.errorThresholds.severity[errorData.severity];
        const timeWindow = Date.now() - this.errorThresholds.timeWindow;

        if (errorInfo.count >= threshold && 
            errorInfo.lastSeen.getTime() >= timeWindow) {
            await this._notifyThresholdExceeded(errorData, errorInfo);
        }
    }

    /**
     * Notify threshold exceeded
     * @param {Object} errorData - Error data
     * @param {Object} errorInfo - Error info
     * @returns {Promise<void>}
     * @private
     */
    async _notifyThresholdExceeded(errorData, errorInfo) {
        EventHelper.emitSystemEvent('error:threshold_exceeded', {
            error: errorData,
            occurrences: errorInfo.count,
            period: {
                start: errorInfo.firstSeen,
                end: errorInfo.lastSeen
            }
        });
    }

    /**
     * Determine error severity
     * @param {Error} error - Error object
     * @returns {string} Error severity
     * @private
     */
    _determineSeverity(error) {
        if (error.fatal || error.critical) {
            return 'critical';
        }

        if (error.status >= 500) {
            return 'high';
        }

        if (error.status >= 400) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * Get error key
     * @param {Object} errorData - Error data
     * @returns {string} Error key
     * @private
     */
    _getErrorKey(errorData) {
        return `${errorData.type}:${errorData.message}`;
    }

    /**
     * Calculate error statistics
     * @param {Array} errors - Error array
     * @param {string} groupBy - Grouping field
     * @returns {Object} Error statistics
     * @private
     */
    _calculateStatistics(errors, groupBy) {
        const stats = {
            total: errors.length,
            bySeverity: {},
            byType: {},
            [groupBy]: {}
        };

        errors.forEach(error => {
            // Count by severity
            stats.bySeverity[error.severity] = 
                (stats.bySeverity[error.severity] || 0) + 1;

            // Count by type
            stats.byType[error.type] = 
                (stats.byType[error.type] || 0) + 1;

            // Count by specified group
            const groupValue = error[groupBy];
            if (groupValue) {
                stats[groupBy][groupValue] = 
                    (stats[groupBy][groupValue] || 0) + 1;
            }
        });

        return stats;
    }

    /**
     * Calculate error trends
     * @param {Array} errors - Error array
     * @param {string} groupBy - Time grouping
     * @returns {Object} Error trends
     * @private
     */
    _calculateTrends(errors, groupBy) {
        const trends = {};

        errors.forEach(error => {
            const timeKey = this._getTimeKey(error.timestamp, groupBy);
            trends[timeKey] = (trends[timeKey] || 0) + 1;
        });

        return trends;
    }

    /**
     * Get time key for trending
     * @param {Date} date - Date object
     * @param {string} groupBy - Time grouping
     * @returns {string} Time key
     * @private
     */
    _getTimeKey(date, groupBy) {
        const d = new Date(date);
        switch (groupBy) {
            case 'hour':
                return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:00`;
            case 'day':
                return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
            case 'week':
                const week = Math.ceil((d.getDate() + 1) / 7);
                return `${d.getFullYear()}-${d.getMonth() + 1}-W${week}`;
            case 'month':
                return `${d.getFullYear()}-${d.getMonth() + 1}`;
            default:
                return d.toISOString();
        }
    }

    /**
     * Get start date based on period
     * @param {string} period - Time period
     * @returns {Date} Start date
     * @private
     */
    _getStartDate(period) {
        const now = new Date();
        switch (period) {
            case '24h':
                return new Date(now - 24 * 60 * 60 * 1000);
            case '7d':
                return new Date(now - 7 * 24 * 60 * 60 * 1000);
            case '30d':
                return new Date(now - 30 * 24 * 60 * 60 * 1000);
            default:
                return new Date(now - 24 * 60 * 60 * 1000);
        }
    }

    /**
     * Log error
     * @param {Object} errorData - Error data
     * @private
     */
    _logError(errorData) {
        const logData = {
            type: errorData.type,
            message: errorData.message,
            severity: errorData.severity,
            context: errorData.context,
            timestamp: errorData.timestamp
        };

        switch (errorData.severity) {
            case 'critical':
                logger.error('Critical error:', logData);
                break;
            case 'high':
                logger.error('High severity error:', logData);
                break;
            case 'medium':
                logger.warn('Medium severity error:', logData);
                break;
            default:
                logger.info('Low severity error:', logData);
        }
    }

    /**
     * Clean up old errors
     * @returns {Promise<number>} Number of errors cleaned up
     */
    async cleanup() {
        try {
            const cutoff = new Date(Date.now() - this.retentionPeriod);
            const result = await prisma.error.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoff
                    }
                }
            });

            // Clear memory cache
            for (const [key, error] of this.errors.entries()) {
                if (error.lastSeen < cutoff) {
                    this.errors.delete(key);
                }
            }

            return result.count;
        } catch (error) {
            logger.error('Error cleaning up errors:', error);
            throw error;
        }
    }
}

module.exports = new ErrorTracker();
