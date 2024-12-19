const cron = require('node-cron');
const logger = require('./logger');
const { EventHelper } = require('./eventEmitter');
const performanceMonitor = require('./performanceMonitor');
const config = require('./config');

/**
 * Task Scheduler Utility
 */
class Scheduler {
    constructor() {
        this.tasks = new Map();
        this.isEnabled = config.get('server.env') !== 'test';
        this._setupDefaultTasks();
    }

    /**
     * Setup default scheduled tasks
     * @private
     */
    _setupDefaultTasks() {
        if (!this.isEnabled) return;

        // Daily tasks - Run at 00:00 every day
        this.schedule('daily-cleanup', '0 0 * * *', async () => {
            try {
                await this._cleanupOldData();
                await this._generateDailyReports();
            } catch (error) {
                logger.error('Error in daily cleanup task:', error);
            }
        });

        // Hourly tasks - Run at the start of every hour
        this.schedule('hourly-checks', '0 * * * *', async () => {
            try {
                await this._checkLowStock();
                await this._checkExpiringItems();
            } catch (error) {
                logger.error('Error in hourly checks task:', error);
            }
        });

        // System health check - Run every 5 minutes
        this.schedule('health-check', '*/5 * * * *', async () => {
            try {
                await this._checkSystemHealth();
            } catch (error) {
                logger.error('Error in health check task:', error);
            }
        });
    }

    /**
     * Schedule a task
     * @param {string} name - Task name
     * @param {string} cronExpression - Cron expression
     * @param {Function} handler - Task handler
     * @param {Object} options - Task options
     */
    schedule(name, cronExpression, handler, options = {}) {
        if (!this.isEnabled) return;

        if (!cron.validate(cronExpression)) {
            throw new Error(`Invalid cron expression: ${cronExpression}`);
        }

        const task = cron.schedule(cronExpression, async () => {
            const startTime = Date.now();
            logger.info(`Starting scheduled task: ${name}`);

            try {
                await handler();
                
                const duration = Date.now() - startTime;
                logger.info(`Completed scheduled task: ${name} (${duration}ms)`);
                
                performanceMonitor._recordMetric(`scheduled_task:${name}`, duration);
            } catch (error) {
                logger.error(`Error in scheduled task ${name}:`, error);
                EventHelper.emitSystemEvent('system:task_error', {
                    task: name,
                    error: error.message
                });
            }
        }, options);

        this.tasks.set(name, {
            expression: cronExpression,
            task,
            options
        });

        logger.info(`Scheduled task registered: ${name} (${cronExpression})`);
    }

    /**
     * Stop a scheduled task
     * @param {string} name - Task name
     */
    stop(name) {
        const taskInfo = this.tasks.get(name);
        if (taskInfo) {
            taskInfo.task.stop();
            logger.info(`Stopped scheduled task: ${name}`);
        }
    }

    /**
     * Start a stopped task
     * @param {string} name - Task name
     */
    start(name) {
        const taskInfo = this.tasks.get(name);
        if (taskInfo) {
            taskInfo.task.start();
            logger.info(`Started scheduled task: ${name}`);
        }
    }

    /**
     * Get all scheduled tasks
     * @returns {Object} Scheduled tasks
     */
    getTasks() {
        const tasks = {};
        this.tasks.forEach((value, key) => {
            tasks[key] = {
                expression: value.expression,
                options: value.options,
                running: value.task.running
            };
        });
        return tasks;
    }

    /**
     * Clean up old data
     * @private
     */
    async _cleanupOldData() {
        const { prisma } = require('../server');
        const retentionDays = config.get('business.dataRetentionDays') || 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        try {
            // Clean up old notifications
            await prisma.notification.deleteMany({
                where: {
                    createdAt: {
                        lt: cutoffDate
                    },
                    isRead: true
                }
            });

            // Archive old stock movements
            await prisma.stockMovement.updateMany({
                where: {
                    createdAt: {
                        lt: cutoffDate
                    }
                },
                data: {
                    archived: true
                }
            });

            logger.info(`Cleaned up data older than ${retentionDays} days`);
        } catch (error) {
            logger.error('Error cleaning up old data:', error);
            throw error;
        }
    }

    /**
     * Generate daily reports
     * @private
     */
    async _generateDailyReports() {
        const ReportGenerator = require('./reportGenerator');
        
        try {
            // Generate inventory report
            await ReportGenerator.generateInventoryReport({
                format: 'pdf',
                filename: `inventory-report-${new Date().toISOString().split('T')[0]}.pdf`
            });

            logger.info('Generated daily reports');
        } catch (error) {
            logger.error('Error generating daily reports:', error);
            throw error;
        }
    }

    /**
     * Check for low stock items
     * @private
     */
    async _checkLowStock() {
        const { prisma } = require('../server');
        
        try {
            const lowStockItems = await prisma.product.findMany({
                where: {
                    quantity: {
                        lte: prisma.raw('reorderPoint')
                    },
                    isActive: true
                }
            });

            for (const item of lowStockItems) {
                EventHelper.emitInventoryEvent('inventory:low', {
                    productId: item.id,
                    quantity: item.quantity,
                    reorderPoint: item.reorderPoint
                });
            }

            logger.info(`Checked ${lowStockItems.length} low stock items`);
        } catch (error) {
            logger.error('Error checking low stock:', error);
            throw error;
        }
    }

    /**
     * Check for expiring items
     * @private
     */
    async _checkExpiringItems() {
        const { prisma } = require('../server');
        const warningDays = config.get('business.expiryWarningDays') || 30;
        const warningDate = new Date();
        warningDate.setDate(warningDate.getDate() + warningDays);

        try {
            const expiringItems = await prisma.product.findMany({
                where: {
                    expiryDate: {
                        lte: warningDate,
                        gt: new Date()
                    },
                    isActive: true
                }
            });

            for (const item of expiringItems) {
                EventHelper.emitInventoryEvent('inventory:expiring', {
                    productId: item.id,
                    expiryDate: item.expiryDate
                });
            }

            logger.info(`Checked ${expiringItems.length} expiring items`);
        } catch (error) {
            logger.error('Error checking expiring items:', error);
            throw error;
        }
    }

    /**
     * Check system health
     * @private
     */
    async _checkSystemHealth() {
        try {
            const metrics = performanceMonitor.generateReport();
            const memoryUsage = process.memoryUsage();

            // Check memory usage
            if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9) {
                EventHelper.emitSystemEvent('system:high_memory_usage', {
                    usage: memoryUsage
                });
            }

            // Check database connection
            const { prisma } = require('../server');
            await prisma.$queryRaw`SELECT 1`;

            logger.debug('System health check completed', { metrics });
        } catch (error) {
            logger.error('Error in system health check:', error);
            EventHelper.emitSystemEvent('system:health_check_failed', {
                error: error.message
            });
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new Scheduler();
