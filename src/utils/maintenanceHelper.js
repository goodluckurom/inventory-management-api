const { prisma } = require('../server');
const logger = require('./logger');
const cache = require('./cache');
const { EventHelper } = require('./eventEmitter');
const CompressionHelper = require('./compressionHelper');
const DateHelper = require('./dateHelper');

/**
 * Maintenance Helper Utility
 */
class MaintenanceHelper {
    constructor() {
        this.defaultRetentionPeriods = {
            auditLogs: 90,      // 90 days
            notifications: 30,   // 30 days
            tempFiles: 1,       // 1 day
            archivedData: 365,  // 1 year
            backups: 30         // 30 days
        };
    }

    /**
     * Run maintenance tasks
     * @param {Object} options - Maintenance options
     * @returns {Promise<Object>} Maintenance results
     */
    async runMaintenance(options = {}) {
        try {
            logger.info('Starting maintenance tasks');
            const results = {};

            // Run tasks in parallel
            const tasks = await Promise.allSettled([
                this.cleanupOldData(options),
                this.optimizeDatabase(options),
                this.cleanupFiles(options),
                this.cleanupCache(options),
                this.archiveOldRecords(options)
            ]);

            // Process results
            tasks.forEach((task, index) => {
                const taskName = [
                    'dataCleanup',
                    'databaseOptimization',
                    'fileCleanup',
                    'cacheCleanup',
                    'recordArchival'
                ][index];

                results[taskName] = task.status === 'fulfilled' ? 
                    task.value : 
                    { error: task.reason.message };
            });

            logger.info('Maintenance tasks completed', { results });
            return results;
        } catch (error) {
            logger.error('Error running maintenance tasks:', error);
            throw error;
        }
    }

    /**
     * Clean up old data
     * @param {Object} options - Cleanup options
     * @returns {Promise<Object>} Cleanup results
     */
    async cleanupOldData(options = {}) {
        try {
            const results = {
                auditLogs: 0,
                notifications: 0,
                stockMovements: 0,
                deletedRecords: 0
            };

            // Clean up audit logs
            const auditLogCutoff = DateHelper.subtractDays(
                new Date(),
                options.auditLogRetention || this.defaultRetentionPeriods.auditLogs
            );

            results.auditLogs = await prisma.auditLog.deleteMany({
                where: {
                    createdAt: { lt: auditLogCutoff }
                }
            });

            // Clean up notifications
            const notificationCutoff = DateHelper.subtractDays(
                new Date(),
                options.notificationRetention || this.defaultRetentionPeriods.notifications
            );

            results.notifications = await prisma.notification.deleteMany({
                where: {
                    createdAt: { lt: notificationCutoff },
                    isRead: true
                }
            });

            // Archive old stock movements
            const stockMovementCutoff = DateHelper.subtractDays(
                new Date(),
                options.stockMovementRetention || 180
            );

            results.stockMovements = await prisma.stockMovement.updateMany({
                where: {
                    createdAt: { lt: stockMovementCutoff }
                },
                data: {
                    archived: true
                }
            });

            // Clean up soft-deleted records
            results.deletedRecords = await this._cleanupSoftDeletedRecords();

            return results;
        } catch (error) {
            logger.error('Error cleaning up old data:', error);
            throw error;
        }
    }

    /**
     * Optimize database
     * @param {Object} options - Optimization options
     * @returns {Promise<Object>} Optimization results
     */
    async optimizeDatabase(options = {}) {
        try {
            const results = {
                tablesAnalyzed: 0,
                spaceReclaimed: 0
            };

            // Run VACUUM ANALYZE on PostgreSQL
            await prisma.$executeRaw`VACUUM ANALYZE;`;
            results.tablesAnalyzed = 1;

            // Get database size before and after
            const beforeSize = await this._getDatabaseSize();
            await prisma.$executeRaw`VACUUM FULL;`;
            const afterSize = await this._getDatabaseSize();

            results.spaceReclaimed = beforeSize - afterSize;

            return results;
        } catch (error) {
            logger.error('Error optimizing database:', error);
            throw error;
        }
    }

    /**
     * Clean up files
     * @param {Object} options - Cleanup options
     * @returns {Promise<Object>} Cleanup results
     */
    async cleanupFiles(options = {}) {
        try {
            const results = {
                tempFiles: 0,
                oldBackups: 0,
                unusedUploads: 0
            };

            // Clean up temporary files
            results.tempFiles = await this._cleanupTempFiles(
                options.tempFileRetention || this.defaultRetentionPeriods.tempFiles
            );

            // Clean up old backups
            results.oldBackups = await this._cleanupOldBackups(
                options.backupRetention || this.defaultRetentionPeriods.backups
            );

            // Clean up unused uploads
            results.unusedUploads = await this._cleanupUnusedUploads();

            return results;
        } catch (error) {
            logger.error('Error cleaning up files:', error);
            throw error;
        }
    }

    /**
     * Clean up cache
     * @param {Object} options - Cleanup options
     * @returns {Promise<Object>} Cleanup results
     */
    async cleanupCache(options = {}) {
        try {
            const results = {
                entriesRemoved: 0,
                memoryFreed: 0
            };

            // Get cache stats before cleanup
            const beforeStats = cache.getStats();

            // Clear expired entries
            cache.cleanup();

            // Get cache stats after cleanup
            const afterStats = cache.getStats();

            results.entriesRemoved = beforeStats.keys - afterStats.keys;
            results.memoryFreed = beforeStats.memory - afterStats.memory;

            return results;
        } catch (error) {
            logger.error('Error cleaning up cache:', error);
            throw error;
        }
    }

    /**
     * Archive old records
     * @param {Object} options - Archive options
     * @returns {Promise<Object>} Archive results
     */
    async archiveOldRecords(options = {}) {
        try {
            const results = {
                ordersArchived: 0,
                documentsArchived: 0,
                archiveSize: 0
            };

            const archiveCutoff = DateHelper.subtractDays(
                new Date(),
                options.archiveRetention || this.defaultRetentionPeriods.archivedData
            );

            // Archive old orders
            const oldOrders = await prisma.order.findMany({
                where: {
                    createdAt: { lt: archiveCutoff },
                    status: {
                        in: ['COMPLETED', 'CANCELLED']
                    }
                },
                include: {
                    items: true
                }
            });

            if (oldOrders.length > 0) {
                // Create archive
                const archivePath = await CompressionHelper.createArchive(
                    JSON.stringify(oldOrders),
                    `orders_archive_${DateHelper.getCurrentDateTime()}.tar.gz`
                );

                results.ordersArchived = oldOrders.length;
                results.archiveSize = await this._getFileSize(archivePath);

                // Delete archived orders
                await prisma.order.deleteMany({
                    where: {
                        id: {
                            in: oldOrders.map(order => order.id)
                        }
                    }
                });
            }

            return results;
        } catch (error) {
            logger.error('Error archiving old records:', error);
            throw error;
        }
    }

    /**
     * Clean up soft-deleted records
     * @returns {Promise<number>} Number of records cleaned up
     * @private
     */
    async _cleanupSoftDeletedRecords() {
        let count = 0;

        // Clean up soft-deleted products
        const productsResult = await prisma.product.deleteMany({
            where: {
                isActive: false,
                updatedAt: {
                    lt: DateHelper.subtractDays(new Date(), 30)
                }
            }
        });
        count += productsResult.count;

        // Clean up soft-deleted suppliers
        const suppliersResult = await prisma.supplier.deleteMany({
            where: {
                isActive: false,
                updatedAt: {
                    lt: DateHelper.subtractDays(new Date(), 30)
                }
            }
        });
        count += suppliersResult.count;

        return count;
    }

    /**
     * Get database size
     * @returns {Promise<number>} Database size in bytes
     * @private
     */
    async _getDatabaseSize() {
        const result = await prisma.$queryRaw`
            SELECT pg_database_size(current_database()) as size;
        `;
        return result[0].size;
    }

    /**
     * Get file size
     * @param {string} filePath - File path
     * @returns {Promise<number>} File size in bytes
     * @private
     */
    async _getFileSize(filePath) {
        const stats = await fs.stat(filePath);
        return stats.size;
    }

    /**
     * Clean up temporary files
     * @param {number} retentionDays - Retention period in days
     * @returns {Promise<number>} Number of files cleaned up
     * @private
     */
    async _cleanupTempFiles(retentionDays) {
        // Implementation depends on your file storage system
        return 0;
    }

    /**
     * Clean up old backups
     * @param {number} retentionDays - Retention period in days
     * @returns {Promise<number>} Number of backups cleaned up
     * @private
     */
    async _cleanupOldBackups(retentionDays) {
        // Implementation depends on your backup system
        return 0;
    }

    /**
     * Clean up unused uploads
     * @returns {Promise<number>} Number of files cleaned up
     * @private
     */
    async _cleanupUnusedUploads() {
        // Implementation depends on your file storage system
        return 0;
    }
}

module.exports = new MaintenanceHelper();
