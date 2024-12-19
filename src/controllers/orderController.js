const { prisma } = require('../prisma/client'); // Adjust the path as necessary

// Create a new order
exports.createOrder = async (req, res) => {
    try {
        const { supplierId, items, totalAmount, tax, shippingCost, discount, expectedDate } = req.body;

        const order = await prisma.purchaseOrder.create({
            data: {
                supplierId,
                items: {
                    create: items.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice
                    }))
                },
                totalAmount,
                tax,
                shippingCost,
                discount,
                expectedDate,
                createdById: req.user.id // Assuming user ID is available in req.user
            }
        });

        res.status(201).json({
            success: true,
            data: order
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error creating order'
        });
    }
};

// Update an existing order
exports.updateOrder = async (req, res) => {
    const { id } = req.params;
    try {
        const order = await prisma.purchaseOrder.update({
            where: { id },
            data: req.body
        });

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error updating order'
        });
    }
};

// Get all orders
exports.getOrders = async (req, res) => {
    try {
        const orders = await prisma.purchaseOrder.findMany({
            include: {
                items: true, // Include order items
                supplier: true // Include supplier details
            }
        });

        res.status(200).json({
            success: true,
            data: orders
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving orders'
        });
    }
};
