const { prisma } = require('../server');
const logger = require('./logger');
const { EventHelper } = require('./eventEmitter');
const queueManager = require('./queueManager');
const cache = require('./cache');

/**
 * Sync Manager Utility
 */
class SyncManager {
    constructor() {
        this.syncQueue = queueManager.getQueue('sync');
        this.retryAttempts = 3;
        this.retryDelay = 5000; // 5 seconds

        this._setupQueue();
    }

    /**
     * Setup sync queue
     * @private
     */
    _setupQueue() {
        this.syncQueue.process(async (job) => {
            try {
                await this._processSyncJob(job.data);
            } catch (error) {
                logger.error('Error processing sync job:', error);
                throw error;
            }
        });
    }

    /**
     * Sync inventory levels
     * @param {Object} options - Sync options
     * @returns {Promise<void>}
     */
    async syncInventoryLevels(options = {}) {
        try {
            logger.info('Starting inventory sync');

            // Get all products with their stock movements
            const products = await prisma.product.findMany({
                include: {
                    stockMovements: true
                }
            });

            for (const product of products) {
                // Calculate actual quantity based on stock movements
                const calculatedQuantity = product.stockMovements.reduce(
                    (total, movement) => {
                        switch (movement.type) {
                            case 'PURCHASE':
                            case 'RETURN':
                                return total + movement.quantity;
                            case 'SALE':
                            case 'DAMAGE':
                            case 'LOSS':
                                return total - movement.quantity;
                            default:
                                return total;
                        }
                    },
                    0
                );

                // Update if there's a discrepancy
                if (calculatedQuantity !== product.quantity) {
                    await this.syncQueue.add({
                        type: 'inventory_adjustment',
                        productId: product.id,
                        currentQuantity: product.quantity,
                        calculatedQuantity,
                        reason: 'Inventory sync adjustment'
                    });
                }
            }

            logger.info('Inventory sync completed');
        } catch (error) {
            logger.error('Error syncing inventory levels:', error);
            throw error;
        }
    }

    /**
     * Sync order status
     * @param {string} orderId - Order ID
     * @returns {Promise<void>}
     */
    async syncOrderStatus(orderId) {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            });

            if (!order) {
                throw new Error('Order not found');
            }

            // Calculate expected status based on items
            const newStatus = this._calculateOrderStatus(order);

            if (newStatus !== order.status) {
                await this.syncQueue.add({
                    type: 'order_status_update',
                    orderId: order.id,
                    currentStatus: order.status,
                    newStatus,
                    reason: 'Order status sync'
                });
            }
        } catch (error) {
            logger.error('Error syncing order status:', error);
            throw error;
        }
    }

    /**
     * Sync supplier data
     * @param {string} supplierId - Supplier ID
     * @returns {Promise<void>}
     */
    async syncSupplierData(supplierId) {
        try {
            const supplier = await prisma.supplier.findUnique({
                where: { id: supplierId },
                include: {
                    products: {
                        include: {
                            product: true
                        }
                    },
                    purchaseOrders: true
                }
            });

            if (!supplier) {
                throw new Error('Supplier not found');
            }

            // Calculate supplier metrics
            const metrics = this._calculateSupplierMetrics(supplier);

            await this.syncQueue.add({
                type: 'supplier_metrics_update',
                supplierId: supplier.id,
                metrics,
                reason: 'Supplier metrics sync'
            });
        } catch (error) {
            logger.error('Error syncing supplier data:', error);
            throw error;
        }
    }

    /**
     * Sync warehouse data
     * @param {string} warehouseId - Warehouse ID
     * @returns {Promise<void>}
     */
    async syncWarehouseData(warehouseId) {
        try {
            const warehouse = await prisma.warehouse.findUnique({
                where: { id: warehouseId },
                include: {
                    products: true,
                    zones: true
                }
            });

            if (!warehouse) {
                throw new Error('Warehouse not found');
            }

            // Calculate warehouse metrics
            const metrics = this._calculateWarehouseMetrics(warehouse);

            await this.syncQueue.add({
                type: 'warehouse_metrics_update',
                warehouseId: warehouse.id,
                metrics,
                reason: 'Warehouse metrics sync'
            });
        } catch (error) {
            logger.error('Error syncing warehouse data:', error);
            throw error;
        }
    }

    /**
     * Process sync job
     * @param {Object} job - Sync job
     * @returns {Promise<void>}
     * @private
     */
    async _processSyncJob(job) {
        try {
            switch (job.type) {
                case 'inventory_adjustment':
                    await this._processInventoryAdjustment(job);
                    break;
                case 'order_status_update':
                    await this._processOrderStatusUpdate(job);
                    break;
                case 'supplier_metrics_update':
                    await this._processSupplierMetricsUpdate(job);
                    break;
                case 'warehouse_metrics_update':
                    await this._processWarehouseMetricsUpdate(job);
                    break;
                default:
                    throw new Error(`Unknown sync job type: ${job.type}`);
            }

            // Clear related cache
            await this._clearRelatedCache(job);

            // Emit sync event
            EventHelper.emitSystemEvent('sync:completed', {
                type: job.type,
                details: job
            });
        } catch (error) {
            logger.error('Error processing sync job:', error);
            throw error;
        }
    }

    /**
     * Process inventory adjustment
     * @param {Object} job - Sync job
     * @returns {Promise<void>}
     * @private
     */
    async _processInventoryAdjustment(job) {
        await prisma.$transaction(async (prisma) => {
            // Update product quantity
            await prisma.product.update({
                where: { id: job.productId },
                data: { quantity: job.calculatedQuantity }
            });

            // Create stock movement record
            await prisma.stockMovement.create({
                data: {
                    productId: job.productId,
                    type: 'ADJUSTMENT',
                    quantity: job.calculatedQuantity - job.currentQuantity,
                    reason: job.reason
                }
            });
        });
    }

    /**
     * Process order status update
     * @param {Object} job - Sync job
     * @returns {Promise<void>}
     * @private
     */
    async _processOrderStatusUpdate(job) {
        await prisma.order.update({
            where: { id: job.orderId },
            data: { status: job.newStatus }
        });
    }

    /**
     * Process supplier metrics update
     * @param {Object} job - Sync job
     * @returns {Promise<void>}
     * @private
     */
    async _processSupplierMetricsUpdate(job) {
        await prisma.supplier.update({
            where: { id: job.supplierId },
            data: {
                metrics: job.metrics
            }
        });
    }

    /**
     * Process warehouse metrics update
     * @param {Object} job - Sync job
     * @returns {Promise<void>}
     * @private
     */
    async _processWarehouseMetricsUpdate(job) {
        await prisma.warehouse.update({
            where: { id: job.warehouseId },
            data: {
                metrics: job.metrics
            }
        });
    }

    /**
     * Calculate order status
     * @param {Object} order - Order object
     * @returns {string} Calculated status
     * @private
     */
    _calculateOrderStatus(order) {
        const itemStatuses = order.items.map(item => item.status);
        
        if (itemStatuses.every(status => status === 'DELIVERED')) {
            return 'DELIVERED';
        }
        if (itemStatuses.every(status => status === 'CANCELLED')) {
            return 'CANCELLED';
        }
        if (itemStatuses.some(status => status === 'PROCESSING')) {
            return 'PROCESSING';
        }
        return order.status;
    }

    /**
     * Calculate supplier metrics
     * @param {Object} supplier - Supplier object
     * @returns {Object} Supplier metrics
     * @private
     */
    _calculateSupplierMetrics(supplier) {
        const totalOrders = supplier.purchaseOrders.length;
        const completedOrders = supplier.purchaseOrders.filter(
            order => order.status === 'DELIVERED'
        ).length;

        return {
            totalOrders,
            completedOrders,
            completionRate: totalOrders ? (completedOrders / totalOrders) * 100 : 0,
            productCount: supplier.products.length
        };
    }

    /**
     * Calculate warehouse metrics
     * @param {Object} warehouse - Warehouse object
     * @returns {Object} Warehouse metrics
     * @private
     */
    _calculateWarehouseMetrics(warehouse) {
        return {
            totalProducts: warehouse.products.length,
            totalZones: warehouse.zones.length,
            occupancyRate: warehouse.capacity ?
                (warehouse.products.length / warehouse.capacity) * 100 : 0
        };
    }

    /**
     * Clear related cache
     * @param {Object} job - Sync job
     * @returns {Promise<void>}
     * @private
     */
    async _clearRelatedCache(job) {
        const cacheKeys = [];

        switch (job.type) {
            case 'inventory_adjustment':
                cacheKeys.push(`product:${job.productId}`);
                break;
            case 'order_status_update':
                cacheKeys.push(`order:${job.orderId}`);
                break;
            case 'supplier_metrics_update':
                cacheKeys.push(`supplier:${job.supplierId}`);
                break;
            case 'warehouse_metrics_update':
                cacheKeys.push(`warehouse:${job.warehouseId}`);
                break;
        }

        await Promise.all(cacheKeys.map(key => cache.delete(key)));
    }
}

module.exports = new SyncManager();
