const { prisma } = require('../server');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Generate sales report
 * @route   POST /api/v1/reports/sales
 * @access  Private
 */
exports.generateSalesReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.body;

    const salesData = await prisma.order.findMany({
        where: {
            createdAt: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        }
    });

    res.status(200).json({
        success: true,
        data: salesData
    });
});

/**
 * @desc    Generate inventory report
 * @route   POST /api/v1/reports/inventory
 * @access  Private
 */
exports.generateInventoryReport = asyncHandler(async (req, res) => {
    const inventoryData = await prisma.product.findMany();

    res.status(200).json({
        success: true,
        data: inventoryData
    });
});
