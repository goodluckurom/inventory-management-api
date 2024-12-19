const logger = require('./logger');
const { EventHelper } = require('./eventEmitter');

/**
 * Performance Monitor Utility
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.thresholds = new Map();
        this._setupDefaultThresholds();
    }

    /**
     * Setup default performance thresholds
     * @private
     */
    _setupDefaultThresholds() {
        this.thresholds.set('db_query', 1000); // 1 second
        this.thresholds.set('api_request', 2000); // 2 seconds
        this.thresholds.set('file_operation', 500); // 500ms
        this.thresholds.set('cache_operation', 100); // 100ms
    }

    /**
     * Start measuring performance
     * @param {string} label - Measurement label
     * @returns {Function} Stop measuring function
     */
    startMeasure(label) {
        const start = process.hrtime();

        return () => {
            const [seconds, nanoseconds] = process.hrtime(start);
            const duration = seconds * 1000 + nanoseconds / 1e6; // Convert to milliseconds
            this._recordMetric(label, duration);
            return duration;
        };
    }

    /**
     * Measure async function execution time
     * @param {string} label - Measurement label
     * @param {Function} fn - Function to measure
     * @returns {Promise<*>} Function result
     */
    async measureAsync(label, fn) {
        const stop = this.startMeasure(label);
        try {
            const result = await fn();
            stop();
            return result;
        } catch (error) {
            stop();
            throw error;
        }
    }

    /**
     * Record performance metric
     * @param {string} label - Metric label
     * @param {number} duration - Duration in milliseconds
     * @private
     */
    _recordMetric(label, duration) {
        if (!this.metrics.has(label)) {
            this.metrics.set(label, {
                count: 0,
                total: 0,
                min: Infinity,
                max: -Infinity,
                average: 0
            });
        }

        const metric = this.metrics.get(label);
        metric.count++;
        metric.total += duration;
        metric.min = Math.min(metric.min, duration);
        metric.max = Math.max(metric.max, duration);
        metric.average = metric.total / metric.count;

        // Check threshold
        const threshold = this.thresholds.get(label);
        if (threshold && duration > threshold) {
            this._handleThresholdExceeded(label, duration, threshold);
        }

        // Log metric
        logger.debug({
            type: 'performance_metric',
            label,
            duration,
            metric
        });
    }

    /**
     * Handle threshold exceeded
     * @param {string} label - Metric label
     * @param {number} duration - Duration in milliseconds
     * @param {number} threshold - Threshold in milliseconds
     * @private
     */
    _handleThresholdExceeded(label, duration, threshold) {
        logger.warn({
            type: 'performance_threshold_exceeded',
            label,
            duration,
            threshold
        });

        EventHelper.emitSystemEvent('system:performance_warning', {
            label,
            duration,
            threshold
        });
    }

    /**
     * Get performance metrics
     * @param {string} label - Metric label (optional)
     * @returns {Object} Performance metrics
     */
    getMetrics(label) {
        if (label) {
            return this.metrics.get(label);
        }
        return Object.fromEntries(this.metrics);
    }

    /**
     * Set performance threshold
     * @param {string} label - Metric label
     * @param {number} threshold - Threshold in milliseconds
     */
    setThreshold(label, threshold) {
        this.thresholds.set(label, threshold);
    }

    /**
     * Reset metrics
     * @param {string} label - Metric label (optional)
     */
    resetMetrics(label) {
        if (label) {
            this.metrics.delete(label);
        } else {
            this.metrics.clear();
        }
    }

    /**
     * Create performance middleware
     * @returns {Function} Express middleware
     */
    createMiddleware() {
        return (req, res, next) => {
            const stop = this.startMeasure('http_request');
            
            // Record response time
            res.on('finish', () => {
                const duration = stop();
                const route = req.route?.path || 'unknown_route';
                
                this._recordMetric(`route:${route}`, duration);
                
                // Add response time header
                res.set('X-Response-Time', `${duration}ms`);
            });

            next();
        };
    }

    /**
     * Create database query performance wrapper
     * @returns {Function} Query wrapper
     */
    createQueryWrapper() {
        return async (label, queryFn) => {
            return await this.measureAsync(`db_query:${label}`, queryFn);
        };
    }

    /**
     * Monitor memory usage
     * @returns {Object} Memory usage statistics
     */
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            heapTotal: this._formatBytes(usage.heapTotal),
            heapUsed: this._formatBytes(usage.heapUsed),
            external: this._formatBytes(usage.external),
            rss: this._formatBytes(usage.rss)
        };
    }

    /**
     * Format bytes to human readable format
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted string
     * @private
     */
    _formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }

    /**
     * Generate performance report
     * @returns {Object} Performance report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            metrics: this.getMetrics(),
            memory: this.getMemoryUsage(),
            uptime: process.uptime()
        };

        logger.info({
            type: 'performance_report',
            report
        });

        return report;
    }
}

// Export singleton instance
module.exports = new PerformanceMonitor();
