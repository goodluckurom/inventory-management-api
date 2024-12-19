const { prisma } = require('../server');
const logger = require('./logger');
const DateHelper = require('./dateHelper');
const CollectionHelper = require('./collectionHelper');

/**
 * Metrics Calculator Utility
 */
class MetricsCalculator {
    /**
     * Calculate inventory metrics
     * @param {Object} options - Calculation options
     * @returns {Promise<Object>} Inventory metrics
     */
    async calculateInventoryMetrics(options = {}) {
        try {
            const products = await prisma.product.findMany({
                where: {
                    isActive: true,
                    ...options.where
                },
                include: {
                    stockMovements: {
                        where: {
                            createdAt: {
                                gte: options.startDate,
                                lte: options.endDate
                            }
                        }
                    }
                }
            });

            const metrics = {
                totalProducts: products.length,
                totalValue: 0,
                lowStockItems: 0,
                outOfStockItems: 0,
                turnoverRate: 0,
                averageInventoryValue: 0
            };

            let totalInventoryTurnover = 0;
            let totalStockValue = 0;

            products.forEach(product => {
                const stockValue = product.quantity * product.costPrice;
                totalStockValue += stockValue;

                if (product.quantity <= 0) {
                    metrics.outOfStockItems++;
                } else if (product.quantity <= product.reorderPoint) {
                    metrics.lowStockItems++;
                }

                // Calculate inventory turnover
                const sold = product.stockMovements
                    .filter(m => m.type === 'SALE')
                    .reduce((sum, m) => sum + m.quantity, 0);
                
                const averageInventory = product.stockMovements.length > 0 ?
                    product.stockMovements.reduce((sum, m) => sum + m.quantity, 0) / product.stockMovements.length :
                    product.quantity;

                if (averageInventory > 0) {
                    totalInventoryTurnover += sold / averageInventory;
                }
            });

            metrics.totalValue = totalStockValue;
            metrics.turnoverRate = products.length > 0 ? 
                totalInventoryTurnover / products.length : 0;
            metrics.averageInventoryValue = products.length > 0 ? 
                totalStockValue / products.length : 0;

            return metrics;
        } catch (error) {
            logger.error('Error calculating inventory metrics:', error);
            throw error;
        }
    }

    /**
     * Calculate sales metrics
     * @param {Object} options - Calculation options
     * @returns {Promise<Object>} Sales metrics
     */
    async calculateSalesMetrics(options = {}) {
        try {
            const orders = await prisma.salesOrder.findMany({
                where: {
                    createdAt: {
                        gte: options.startDate,
                        lte: options.endDate
                    },
                    status: {
                        in: ['COMPLETED', 'DELIVERED']
                    }
                },
                include: {
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            });

            const metrics = {
                totalOrders: orders.length,
                totalRevenue: 0,
                totalProfit: 0,
                averageOrderValue: 0,
                topProducts: [],
                salesByDay: {}
            };

            const productSales = new Map();

            orders.forEach(order => {
                metrics.totalRevenue += order.totalAmount;

                // Calculate profit
                const orderProfit = order.items.reduce((sum, item) => {
                    const profit = (item.unitPrice - item.product.costPrice) * item.quantity;
                    return sum + profit;
                }, 0);
                metrics.totalProfit += orderProfit;

                // Track product sales
                order.items.forEach(item => {
                    const existing = productSales.get(item.productId) || {
                        productId: item.productId,
                        name: item.product.name,
                        quantity: 0,
                        revenue: 0
                    };
                    existing.quantity += item.quantity;
                    existing.revenue += item.totalPrice;
                    productSales.set(item.productId, existing);
                });

                // Track sales by day
                const day = DateHelper.formatDate(order.createdAt, 'short');
                metrics.salesByDay[day] = (metrics.salesByDay[day] || 0) + order.totalAmount;
            });

            metrics.averageOrderValue = orders.length > 0 ?
                metrics.totalRevenue / orders.length : 0;

            metrics.topProducts = Array.from(productSales.values())
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);

            return metrics;
        } catch (error) {
            logger.error('Error calculating sales metrics:', error);
            throw error;
        }
    }

    /**
     * Calculate supplier metrics
     * @param {Object} options - Calculation options
     * @returns {Promise<Object>} Supplier metrics
     */
    async calculateSupplierMetrics(options = {}) {
        try {
            const orders = await prisma.purchaseOrder.findMany({
                where: {
                    createdAt: {
                        gte: options.startDate,
                        lte: options.endDate
                    }
                },
                include: {
                    supplier: true,
                    items: true
                }
            });

            const metrics = {
                totalOrders: orders.length,
                totalSpent: 0,
                supplierPerformance: [],
                averageLeadTime: 0
            };

            const supplierStats = new Map();

            orders.forEach(order => {
                metrics.totalSpent += order.totalAmount;

                // Track supplier performance
                const stats = supplierStats.get(order.supplierId) || {
                    supplierId: order.supplierId,
                    name: order.supplier.name,
                    orders: 0,
                    totalSpent: 0,
                    onTimeDeliveries: 0,
                    averageLeadTime: 0,
                    totalLeadTime: 0
                };

                stats.orders++;
                stats.totalSpent += order.totalAmount;

                if (order.deliveryDate && order.expectedDate) {
                    const leadTime = DateHelper.getDifference(
                        order.createdAt,
                        order.deliveryDate,
                        'days'
                    );
                    stats.totalLeadTime += leadTime;

                    if (new Date(order.deliveryDate) <= new Date(order.expectedDate)) {
                        stats.onTimeDeliveries++;
                    }
                }

                supplierStats.set(order.supplierId, stats);
            });

            // Calculate final supplier metrics
            metrics.supplierPerformance = Array.from(supplierStats.values())
                .map(stats => ({
                    ...stats,
                    onTimeDeliveryRate: stats.orders > 0 ?
                        (stats.onTimeDeliveries / stats.orders) * 100 : 0,
                    averageLeadTime: stats.orders > 0 ?
                        stats.totalLeadTime / stats.orders : 0
                }))
                .sort((a, b) => b.onTimeDeliveryRate - a.onTimeDeliveryRate);

            // Calculate overall average lead time
            const totalLeadTime = metrics.supplierPerformance
                .reduce((sum, supplier) => sum + supplier.totalLeadTime, 0);
            const totalOrders = metrics.supplierPerformance
                .reduce((sum, supplier) => sum + supplier.orders, 0);

            metrics.averageLeadTime = totalOrders > 0 ?
                totalLeadTime / totalOrders : 0;

            return metrics;
        } catch (error) {
            logger.error('Error calculating supplier metrics:', error);
            throw error;
        }
    }

    /**
     * Calculate warehouse metrics
     * @param {Object} options - Calculation options
     * @returns {Promise<Object>} Warehouse metrics
     */
    async calculateWarehouseMetrics(options = {}) {
        try {
            const warehouses = await prisma.warehouse.findMany({
                where: options.where,
                include: {
                    products: true,
                    zones: true
                }
            });

            const metrics = {
                totalWarehouses: warehouses.length,
                warehouseUtilization: [],
                totalCapacity: 0,
                usedCapacity: 0
            };

            warehouses.forEach(warehouse => {
                const capacity = warehouse.capacity || 0;
                metrics.totalCapacity += capacity;

                // Calculate used capacity (simplified)
                const usedCapacity = warehouse.products.length;
                metrics.usedCapacity += usedCapacity;

                metrics.warehouseUtilization.push({
                    warehouseId: warehouse.id,
                    name: warehouse.name,
                    capacity,
                    usedCapacity,
                    utilizationRate: capacity > 0 ?
                        (usedCapacity / capacity) * 100 : 0,
                    productCount: warehouse.products.length,
                    zoneCount: warehouse.zones.length
                });
            });

            return metrics;
        } catch (error) {
            logger.error('Error calculating warehouse metrics:', error);
            throw error;
        }
    }

    /**
     * Calculate financial metrics
     * @param {Object} options - Calculation options
     * @returns {Promise<Object>} Financial metrics
     */
    async calculateFinancialMetrics(options = {}) {
        try {
            const [sales, purchases] = await Promise.all([
                prisma.salesOrder.findMany({
                    where: {
                        createdAt: {
                            gte: options.startDate,
                            lte: options.endDate
                        },
                        status: 'COMPLETED'
                    }
                }),
                prisma.purchaseOrder.findMany({
                    where: {
                        createdAt: {
                            gte: options.startDate,
                            lte: options.endDate
                        },
                        status: 'COMPLETED'
                    }
                })
            ]);

            const metrics = {
                revenue: sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0),
                expenses: purchases.reduce((sum, purchase) => sum + Number(purchase.totalAmount), 0),
                profit: 0,
                profitMargin: 0,
                revenueByPeriod: {},
                expensesByPeriod: {}
            };

            metrics.profit = metrics.revenue - metrics.expenses;
            metrics.profitMargin = metrics.revenue > 0 ?
                (metrics.profit / metrics.revenue) * 100 : 0;

            // Group by period
            const groupByPeriod = (items, type) => {
                return items.reduce((acc, item) => {
                    const period = DateHelper.formatDate(item.createdAt, 'short');
                    acc[period] = (acc[period] || 0) + Number(item.totalAmount);
                    return acc;
                }, {});
            };

            metrics.revenueByPeriod = groupByPeriod(sales);
            metrics.expensesByPeriod = groupByPeriod(purchases);

            return metrics;
        } catch (error) {
            logger.error('Error calculating financial metrics:', error);
            throw error;
        }
    }
}

module.exports = new MetricsCalculator();
