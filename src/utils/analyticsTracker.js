const { prisma } = require('../server');
const logger = require('./logger');
const cache = require('./cache');
const { EventHelper } = require('./eventEmitter');
const DateHelper = require('./dateHelper');

/**
 * Analytics Tracker Utility
 */
class AnalyticsTracker {
    constructor() {
        this.cache = cache;
        this.cacheTTL = 300; // 5 minutes
        this.cachePrefix = 'analytics:';
        this.retentionPeriod = 365; // 1 year in days

        // Event types
        this.eventTypes = {
            // User Events
            USER_LOGIN: 'user.login',
            USER_LOGOUT: 'user.logout',
            USER_REGISTER: 'user.register',
            USER_UPDATE: 'user.update',

            // Product Events
            PRODUCT_VIEW: 'product.view',
            PRODUCT_SEARCH: 'product.search',
            PRODUCT_CREATE: 'product.create',
            PRODUCT_UPDATE: 'product.update',
            PRODUCT_DELETE: 'product.delete',

            // Inventory Events
            STOCK_UPDATE: 'inventory.stock_update',
            STOCK_CHECK: 'inventory.stock_check',
            STOCK_TRANSFER: 'inventory.transfer',
            STOCK_ADJUSTMENT: 'inventory.adjustment',

            // Order Events
            ORDER_CREATE: 'order.create',
            ORDER_UPDATE: 'order.update',
            ORDER_CANCEL: 'order.cancel',
            ORDER_COMPLETE: 'order.complete',

            // System Events
            SYSTEM_ERROR: 'system.error',
            SYSTEM_WARNING: 'system.warning',
            API_REQUEST: 'api.request',
            API_ERROR: 'api.error'
        };
    }

    /**
     * Track event
     * @param {string} type - Event type
     * @param {Object} data - Event data
     * @param {Object} context - Event context
     * @returns {Promise<void>}
     */
    async trackEvent(type, data = {}, context = {}) {
        try {
            const event = this._createEvent(type, data, context);
            await this._storeEvent(event);
            await this._updateMetrics(event);
            EventHelper.emitSystemEvent('analytics:event_tracked', event);
        } catch (error) {
            logger.error('Error tracking event:', error);
        }
    }

    /**
     * Track API request
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {number} duration - Request duration in ms
     * @returns {Promise<void>}
     */
    async trackApiRequest(req, res, duration) {
        try {
            const event = {
                type: this.eventTypes.API_REQUEST,
                data: {
                    method: req.method,
                    path: req.path,
                    query: req.query,
                    statusCode: res.statusCode,
                    duration
                },
                context: {
                    userId: req.user?.id,
                    ip: req.ip,
                    userAgent: req.get('user-agent')
                }
            };

            await this.trackEvent(event.type, event.data, event.context);
        } catch (error) {
            logger.error('Error tracking API request:', error);
        }
    }

    /**
     * Get analytics data
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Analytics data
     */
    async getAnalytics(options = {}) {
        try {
            const {
                startDate = DateHelper.subtractDays(new Date(), 30),
                endDate = new Date(),
                eventTypes = [],
                groupBy = 'day'
            } = options;

            // Try cache first
            const cacheKey = this._getCacheKey('analytics', {
                startDate,
                endDate,
                eventTypes,
                groupBy
            });
            const cached = await this.cache.get(cacheKey);
            if (cached) return cached;

            // Query events
            const events = await prisma.analyticsEvent.findMany({
                where: {
                    timestamp: {
                        gte: startDate,
                        lte: endDate
                    },
                    ...(eventTypes.length > 0 && {
                        type: { in: eventTypes }
                    })
                }
            });

            // Process analytics
            const analytics = this._processAnalytics(events, groupBy);

            // Cache results
            await this.cache.set(cacheKey, analytics, this.cacheTTL);

            return analytics;
        } catch (error) {
            logger.error('Error getting analytics:', error);
            throw error;
        }
    }

    /**
     * Get user activity
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} User activity data
     */
    async getUserActivity(userId, options = {}) {
        try {
            const {
                startDate = DateHelper.subtractDays(new Date(), 30),
                endDate = new Date()
            } = options;

            const events = await prisma.analyticsEvent.findMany({
                where: {
                    'context.userId': userId,
                    timestamp: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                orderBy: {
                    timestamp: 'desc'
                }
            });

            return this._processUserActivity(events);
        } catch (error) {
            logger.error('Error getting user activity:', error);
            throw error;
        }
    }

    /**
     * Get popular items
     * @param {string} type - Item type (e.g., 'product', 'category')
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Popular items
     */
    async getPopularItems(type, options = {}) {
        try {
            const {
                startDate = DateHelper.subtractDays(new Date(), 30),
                endDate = new Date(),
                limit = 10
            } = options;

            const events = await prisma.analyticsEvent.findMany({
                where: {
                    type: `${type}.view`,
                    timestamp: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            });

            return this._processPopularItems(events, limit);
        } catch (error) {
            logger.error('Error getting popular items:', error);
            throw error;
        }
    }

    /**
     * Create event object
     * @param {string} type - Event type
     * @param {Object} data - Event data
     * @param {Object} context - Event context
     * @returns {Object} Event object
     * @private
     */
    _createEvent(type, data, context) {
        return {
            type,
            data,
            context: {
                ...context,
                timestamp: new Date(),
                environment: process.env.NODE_ENV
            }
        };
    }

    /**
     * Store event
     * @param {Object} event - Event object
     * @returns {Promise<void>}
     * @private
     */
    async _storeEvent(event) {
        await prisma.analyticsEvent.create({
            data: {
                type: event.type,
                data: event.data,
                context: event.context,
                timestamp: event.context.timestamp
            }
        });
    }

    /**
     * Update metrics
     * @param {Object} event - Event object
     * @returns {Promise<void>}
     * @private
     */
    async _updateMetrics(event) {
        const metrics = await this._getMetrics(event.type);
        metrics.count = (metrics.count || 0) + 1;
        metrics.lastOccurrence = event.context.timestamp;

        if (event.data.duration) {
            metrics.totalDuration = (metrics.totalDuration || 0) + event.data.duration;
            metrics.averageDuration = metrics.totalDuration / metrics.count;
        }

        await this._setMetrics(event.type, metrics);
    }

    /**
     * Get metrics
     * @param {string} type - Event type
     * @returns {Promise<Object>} Metrics object
     * @private
     */
    async _getMetrics(type) {
        const cacheKey = this._getCacheKey('metrics', type);
        return await this.cache.get(cacheKey) || {};
    }

    /**
     * Set metrics
     * @param {string} type - Event type
     * @param {Object} metrics - Metrics object
     * @returns {Promise<void>}
     * @private
     */
    async _setMetrics(type, metrics) {
        const cacheKey = this._getCacheKey('metrics', type);
        await this.cache.set(cacheKey, metrics, this.cacheTTL);
    }

    /**
     * Process analytics data
     * @param {Array} events - Events array
     * @param {string} groupBy - Grouping type
     * @returns {Object} Processed analytics
     * @private
     */
    _processAnalytics(events, groupBy) {
        const analytics = {
            total: events.length,
            byType: {},
            byPeriod: {},
            averageDuration: 0,
            totalDuration: 0
        };

        events.forEach(event => {
            // Count by type
            analytics.byType[event.type] = 
                (analytics.byType[event.type] || 0) + 1;

            // Group by period
            const period = this._getPeriodKey(event.timestamp, groupBy);
            analytics.byPeriod[period] = 
                (analytics.byPeriod[period] || 0) + 1;

            // Calculate durations
            if (event.data.duration) {
                analytics.totalDuration += event.data.duration;
            }
        });

        analytics.averageDuration = 
            analytics.totalDuration / events.length || 0;

        return analytics;
    }

    /**
     * Process user activity
     * @param {Array} events - Events array
     * @returns {Object} Processed user activity
     * @private
     */
    _processUserActivity(events) {
        return {
            total: events.length,
            lastActive: events[0]?.timestamp,
            activities: events.map(event => ({
                type: event.type,
                timestamp: event.timestamp,
                data: event.data
            }))
        };
    }

    /**
     * Process popular items
     * @param {Array} events - Events array
     * @param {number} limit - Result limit
     * @returns {Array} Popular items
     * @private
     */
    _processPopularItems(events, limit) {
        const counts = {};
        events.forEach(event => {
            const itemId = event.data.itemId;
            counts[itemId] = (counts[itemId] || 0) + 1;
        });

        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([itemId, count]) => ({
                itemId,
                views: count
            }));
    }

    /**
     * Get period key
     * @param {Date} date - Date object
     * @param {string} groupBy - Grouping type
     * @returns {string} Period key
     * @private
     */
    _getPeriodKey(date, groupBy) {
        const d = new Date(date);
        switch (groupBy) {
            case 'hour':
                return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:00`;
            case 'day':
                return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
            case 'week':
                const week = Math.ceil((d.getDate() + 1) / 7);
                return `${d.getFullYear()}-W${week}`;
            case 'month':
                return `${d.getFullYear()}-${d.getMonth() + 1}`;
            default:
                return d.toISOString();
        }
    }

    /**
     * Get cache key
     * @param {string} type - Key type
     * @param {*} identifier - Key identifier
     * @returns {string} Cache key
     * @private
     */
    _getCacheKey(type, identifier) {
        const key = typeof identifier === 'object' ?
            JSON.stringify(identifier) :
            identifier.toString();
        return `${this.cachePrefix}${type}:${key}`;
    }

    /**
     * Clean up old events
     * @returns {Promise<number>} Number of events cleaned up
     */
    async cleanup() {
        try {
            const cutoff = DateHelper.subtractDays(
                new Date(),
                this.retentionPeriod
            );

            const result = await prisma.analyticsEvent.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoff
                    }
                }
            });

            return result.count;
        } catch (error) {
            logger.error('Error cleaning up events:', error);
            throw error;
        }
    }
}

module.exports = new AnalyticsTracker();
