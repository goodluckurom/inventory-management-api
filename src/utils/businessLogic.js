const { prisma } = require('../server');
const logger = require('./logger');

/**
 * Inventory Management Calculations
 */
const inventoryCalculations = {
    /**
     * Calculate reorder point based on lead time and safety stock
     * @param {number} averageDailyDemand - Average daily demand
     * @param {number} leadTimeDays - Lead time in days
     * @param {number} safetyStockDays - Safety stock days
     * @returns {number} Reorder point
     */
    calculateReorderPoint: (averageDailyDemand, leadTimeDays, safetyStockDays) => {
        const leadTimeDemand = averageDailyDemand * leadTimeDays;
        const safetyStock = averageDailyDemand * safetyStockDays;
        return Math.ceil(leadTimeDemand + safetyStock);
    },

    /**
     * Calculate Economic Order Quantity (EOQ)
     * @param {number} annualDemand - Annual demand
     * @param {number} orderCost - Cost per order
     * @param {number} holdingCost - Annual holding cost per unit
     * @returns {number} Economic Order Quantity
     */
    calculateEOQ: (annualDemand, orderCost, holdingCost) => {
        return Math.ceil(Math.sqrt((2 * annualDemand * orderCost) / holdingCost));
    },

    /**
     * Calculate safety stock level
     * @param {number} maxDailyDemand - Maximum daily demand
     * @param {number} averageDailyDemand - Average daily demand
     * @param {number} leadTimeDays - Lead time in days
     * @returns {number} Safety stock level
     */
    calculateSafetyStock: (maxDailyDemand, averageDailyDemand, leadTimeDays) => {
        return Math.ceil((maxDailyDemand - averageDailyDemand) * leadTimeDays);
    },

    /**
     * Calculate inventory turnover ratio
     * @param {number} costOfGoodsSold - Cost of goods sold
     * @param {number} averageInventory - Average inventory value
     * @returns {number} Inventory turnover ratio
     */
    calculateInventoryTurnover: (costOfGoodsSold, averageInventory) => {
        return averageInventory === 0 ? 0 : costOfGoodsSold / averageInventory;
    }
};

/**
 * Price Calculations
 */
const priceCalculations = {
    /**
     * Calculate total price with tax and discounts
     * @param {number} basePrice - Base price
     * @param {number} taxRate - Tax rate (percentage)
     * @param {number} discount - Discount (percentage)
     * @returns {Object} Calculated prices
     */
    calculateTotalPrice: (basePrice, taxRate = 0, discount = 0) => {
        const discountAmount = (basePrice * discount) / 100;
        const priceAfterDiscount = basePrice - discountAmount;
        const taxAmount = (priceAfterDiscount * taxRate) / 100;
        const totalPrice = priceAfterDiscount + taxAmount;

        return {
            basePrice,
            discountAmount,
            priceAfterDiscount,
            taxAmount,
            totalPrice
        };
    },

    /**
     * Calculate bulk pricing
     * @param {number} basePrice - Base price
     * @param {number} quantity - Quantity
     * @param {Array} bulkPricingTiers - Bulk pricing tiers
     * @returns {number} Calculated price per unit
     */
    calculateBulkPrice: (basePrice, quantity, bulkPricingTiers) => {
        const sortedTiers = [...bulkPricingTiers].sort((a, b) => b.quantity - a.quantity);
        const tier = sortedTiers.find(tier => quantity >= tier.quantity);
        return tier ? basePrice * (1 - tier.discount / 100) : basePrice;
    }
};

/**
 * Order Management Calculations
 */
const orderCalculations = {
    /**
     * Calculate order totals
     * @param {Array} items - Order items
     * @param {number} taxRate - Tax rate
     * @param {number} shippingCost - Shipping cost
     * @returns {Object} Order totals
     */
    calculateOrderTotals: (items, taxRate = 0, shippingCost = 0) => {
        const subtotal = items.reduce((sum, item) => 
            sum + (item.quantity * item.unitPrice), 0);
        const taxAmount = (subtotal * taxRate) / 100;
        const total = subtotal + taxAmount + shippingCost;

        return {
            subtotal,
            taxAmount,
            shippingCost,
            total
        };
    },

    /**
     * Calculate shipping cost
     * @param {number} weight - Total weight
     * @param {string} destination - Destination zone
     * @param {string} method - Shipping method
     * @returns {number} Shipping cost
     */
    calculateShippingCost: (weight, destination, method) => {
        // Implementation would depend on shipping rate tables and rules
        // This is a placeholder for demonstration
        const baseRate = 10;
        const weightRate = weight * 0.5;
        const methodMultiplier = method === 'express' ? 1.5 : 1;
        return (baseRate + weightRate) * methodMultiplier;
    }
};

/**
 * Analytics and Metrics
 */
const analyticsCalculations = {
    /**
     * Calculate supplier performance metrics
     * @param {string} supplierId - Supplier ID
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object>} Performance metrics
     */
    calculateSupplierPerformance: async (supplierId, startDate, endDate) => {
        try {
            const orders = await prisma.purchaseOrder.findMany({
                where: {
                    supplierId,
                    createdAt: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            });

            const totalOrders = orders.length;
            const onTimeDeliveries = orders.filter(order => 
                order.deliveryDate && order.expectedDate && 
                new Date(order.deliveryDate) <= new Date(order.expectedDate)
            ).length;

            const deliveryPerformance = totalOrders === 0 ? 0 : 
                (onTimeDeliveries / totalOrders) * 100;

            return {
                totalOrders,
                onTimeDeliveries,
                deliveryPerformance,
                averageLeadTime: calculateAverageLeadTime(orders)
            };
        } catch (error) {
            logger.error('Error calculating supplier performance:', error);
            throw error;
        }
    },

    /**
     * Calculate product performance metrics
     * @param {string} productId - Product ID
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object>} Performance metrics
     */
    calculateProductPerformance: async (productId, startDate, endDate) => {
        try {
            const movements = await prisma.stockMovement.findMany({
                where: {
                    productId,
                    createdAt: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            });

            const sales = movements.filter(m => m.type === 'SALE');
            const totalSold = sales.reduce((sum, m) => sum + m.quantity, 0);
            const revenue = sales.reduce((sum, m) => sum + (m.quantity * m.price), 0);

            return {
                totalSold,
                revenue,
                averagePrice: totalSold === 0 ? 0 : revenue / totalSold,
                stockTurnover: calculateStockTurnover(movements)
            };
        } catch (error) {
            logger.error('Error calculating product performance:', error);
            throw error;
        }
    }
};

/**
 * Helper Functions
 */
const calculateAverageLeadTime = (orders) => {
    const ordersWithLeadTime = orders.filter(order => 
        order.deliveryDate && order.createdAt
    );

    if (ordersWithLeadTime.length === 0) return 0;

    const totalLeadTime = ordersWithLeadTime.reduce((sum, order) => {
        const leadTime = Math.ceil(
            (new Date(order.deliveryDate) - new Date(order.createdAt)) / 
            (1000 * 60 * 60 * 24)
        );
        return sum + leadTime;
    }, 0);

    return totalLeadTime / ordersWithLeadTime.length;
};

const calculateStockTurnover = (movements) => {
    const totalOut = movements
        .filter(m => m.type === 'SALE' || m.type === 'TRANSFER_OUT')
        .reduce((sum, m) => sum + m.quantity, 0);

    const averageInventory = movements.reduce((sum, m) => {
        if (m.type === 'PURCHASE' || m.type === 'TRANSFER_IN') {
            return sum + m.quantity;
        }
        return sum - m.quantity;
    }, 0) / 2;

    return averageInventory === 0 ? 0 : totalOut / averageInventory;
};

module.exports = {
    inventoryCalculations,
    priceCalculations,
    orderCalculations,
    analyticsCalculations
};
