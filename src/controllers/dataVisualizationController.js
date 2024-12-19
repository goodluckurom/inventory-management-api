const { prisma } = require('../server');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Get inventory data for visualization
 * @route   GET /api/v1/data/inventory
 * @access  Public
 */
exports.getInventoryData = asyncHandler(async (req, res) => {
    const inventoryData = await prisma.product.findMany({
        select: {
            name: true,
            quantity: true,
            price: true
        }
    });

    res.status(200).json({
        success: true,
        data: inventoryData
    });
});

/**
 * @desc    Get sales data for visualization
 * @route   GET /api/v1/data/sales
 * @access  Public
 */
exports.getSalesData = asyncHandler(async (req, res) => {
    const salesData = await prisma.order.findMany({
        select: {
            id: true,
            totalAmount: true,
            createdAt: true
        }
    });

    res.status(200).json({
        success: true,
        data: salesData
    });
});
