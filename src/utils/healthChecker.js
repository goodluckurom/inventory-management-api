const { prisma } = require('../server');
const os = require('os');
const logger = require('./logger');
const cache = require('./cache');
const config = require('./config');
const { EventHelper } = require('./eventEmitter');
const performanceMonitor = require('./performanceMonitor');

/**
 * Health Checker Utility
 */
class HealthChecker {
    constructor() {
        this.healthChecks = new Map();
        this.thresholds = {
            memory: 90,         // 90% memory usage
            cpu: 80,           // 80% CPU usage
            disk: 90,          // 90% disk usage
            responseTime: 1000, // 1 second
            errorRate: 5       // 5% error rate
        };
        this._setupDefaultChecks();
    }

    /**
     * Setup default health checks
     * @private
     */
    _setupDefaultChecks() {
        // System checks
        this.registerCheck('system', async () => this._checkSystem());
        this.registerCheck('memory', async () => this._checkMemory());
        this.registerCheck('cpu', async () => this._checkCPU());
        this.registerCheck('disk', async () => this._checkDisk());

        // Database checks
        this.registerCheck('database', async () => this._checkDatabase());
        this.registerCheck('connections', async () => this._checkConnections());

        // Application checks
        this.registerCheck('cache', async () => this._checkCache());
        this.registerCheck('queues', async () => this._checkQueues());
        this.registerCheck('performance', async () => this._checkPerformance());
    }

    /**
     * Register health check
     * @param {string} name - Check name
     * @param {Function} check - Check function
     */
    registerCheck(name, check) {
        this.healthChecks.set(name, check);
    }

    /**
     * Run health checks
     * @param {Array} checks - Specific checks to run (optional)
     * @returns {Promise<Object>} Health check results
     */
    async runHealthChecks(checks = null) {
        try {
            const results = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                checks: {}
            };

            const checksToRun = checks ? 
                new Map([...this.healthChecks].filter(([name]) => checks.includes(name))) :
                this.healthChecks;

            // Run all checks in parallel
            const checkResults = await Promise.allSettled(
                Array.from(checksToRun).map(async ([name, check]) => {
                    const startTime = Date.now();
                    try {
                        const result = await check();
                        const duration = Date.now() - startTime;
                        return { name, result, duration };
                    } catch (error) {
                        logger.error(`Health check '${name}' failed:`, error);
                        throw error;
                    }
                })
            );

            // Process results
            checkResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    const { name, result: checkResult, duration } = result.value;
                    results.checks[name] = {
                        status: checkResult.status,
                        details: checkResult.details,
                        duration
                    };

                    if (checkResult.status === 'unhealthy') {
                        results.status = 'unhealthy';
                    }
                } else {
                    results.checks[result.reason.name] = {
                        status: 'error',
                        error: result.reason.message
                    };
                    results.status = 'unhealthy';
                }
            });

            // Log results
            logger.info('Health check completed', results);

            // Emit event if system is unhealthy
            if (results.status === 'unhealthy') {
                EventHelper.emitSystemEvent('system:unhealthy', results);
            }

            return results;
        } catch (error) {
            logger.error('Error running health checks:', error);
            throw error;
        }
    }

    /**
     * Check system health
     * @returns {Promise<Object>} Check result
     * @private
     */
    async _checkSystem() {
        const uptime = process.uptime();
        const nodeVersion = process.version;
        const platform = process.platform;
        const arch = process.arch;

        return {
            status: 'healthy',
            details: {
                uptime,
                nodeVersion,
                platform,
                arch,
                env: process.env.NODE_ENV
            }
        };
    }

    /**
     * Check memory usage
     * @returns {Promise<Object>} Check result
     * @private
     */
    async _checkMemory() {
        const used = process.memoryUsage();
        const total = os.totalmem();
        const free = os.freemem();
        const usagePercent = ((total - free) / total) * 100;

        return {
            status: usagePercent < this.thresholds.memory ? 'healthy' : 'unhealthy',
            details: {
                total: this._formatBytes(total),
                free: this._formatBytes(free),
                used: {
                    heap: this._formatBytes(used.heapUsed),
                    heapTotal: this._formatBytes(used.heapTotal),
                    rss: this._formatBytes(used.rss),
                    external: this._formatBytes(used.external)
                },
                usagePercent: Math.round(usagePercent * 100) / 100
            }
        };
    }

    /**
     * Check CPU usage
     * @returns {Promise<Object>} Check result
     * @private
     */
    async _checkCPU() {
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        const usage = process.cpuUsage();
        const totalUsage = (usage.user + usage.system) / 1000000; // Convert to seconds

        return {
            status: totalUsage < this.thresholds.cpu ? 'healthy' : 'unhealthy',
            details: {
                cores: cpus.length,
                model: cpus[0].model,
                speed: cpus[0].speed,
                loadAverage: {
                    '1m': loadAvg[0],
                    '5m': loadAvg[1],
                    '15m': loadAvg[2]
                },
                usage: {
                    user: usage.user,
                    system: usage.system,
                    total: totalUsage
                }
            }
        };
    }

    /**
     * Check disk usage
     * @returns {Promise<Object>} Check result
     * @private
     */
    async _checkDisk() {
        // Note: This is a simplified check. In production, you might want to use a package
        // like 'disk-space' to get actual disk usage statistics
        return {
            status: 'healthy',
            details: {
                message: 'Disk space check not implemented'
            }
        };
    }

    /**
     * Check database health
     * @returns {Promise<Object>} Check result
     * @private
     */
    async _checkDatabase() {
        try {
            const startTime = Date.now();
            await prisma.$queryRaw`SELECT 1`;
            const responseTime = Date.now() - startTime;

            return {
                status: responseTime < this.thresholds.responseTime ? 'healthy' : 'unhealthy',
                details: {
                    connected: true,
                    responseTime
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    connected: false,
                    error: error.message
                }
            };
        }
    }

    /**
     * Check database connections
     * @returns {Promise<Object>} Check result
     * @private
     */
    async _checkConnections() {
        try {
            const result = await prisma.$queryRaw`
                SELECT count(*) as connections 
                FROM pg_stat_activity 
                WHERE datname = current_database()
            `;

            const connections = parseInt(result[0].connections);
            const maxConnections = 100; // This should come from your database configuration

            return {
                status: connections < maxConnections * 0.9 ? 'healthy' : 'unhealthy',
                details: {
                    current: connections,
                    max: maxConnections,
                    usagePercent: (connections / maxConnections) * 100
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error.message
                }
            };
        }
    }

    /**
     * Check cache health
     * @returns {Promise<Object>} Check result
     * @private
     */
    async _checkCache() {
        const stats = cache.getStats();
        const hitRate = stats.hits / (stats.hits + stats.misses) * 100;

        return {
            status: hitRate > 50 ? 'healthy' : 'warning',
            details: {
                hits: stats.hits,
                misses: stats.misses,
                hitRate: Math.round(hitRate * 100) / 100,
                keys: stats.keys,
                memory: this._formatBytes(stats.memory)
            }
        };
    }

    /**
     * Check queue health
     * @returns {Promise<Object>} Check result
     * @private
     */
    async _checkQueues() {
        // This should be implemented based on your queue system
        return {
            status: 'healthy',
            details: {
                message: 'Queue health check not implemented'
            }
        };
    }

    /**
     * Check performance metrics
     * @returns {Promise<Object>} Check result
     * @private
     */
    async _checkPerformance() {
        const metrics = performanceMonitor.getMetrics();
        const errorRate = metrics.errors / metrics.requests * 100;

        return {
            status: errorRate < this.thresholds.errorRate ? 'healthy' : 'unhealthy',
            details: {
                requests: metrics.requests,
                errors: metrics.errors,
                errorRate: Math.round(errorRate * 100) / 100,
                averageResponseTime: metrics.averageResponseTime,
                p95ResponseTime: metrics.p95ResponseTime
            }
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
        if (bytes === 0) return '0 Bytes';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = new HealthChecker();
