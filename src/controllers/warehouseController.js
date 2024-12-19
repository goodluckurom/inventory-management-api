const { prisma } = require('../server');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Get all warehouses with filtering, sorting, and pagination
 * @route   GET /api/v1/warehouses
 * @access  Private
 */
exports.getWarehouses = asyncHandler(async (req, res) => {
    const {
        search,
        type,
        sortBy = 'createdAt',
        order = 'desc',
        page = 1,
        limit = 10
    } = req.query;

    // Build filter conditions
    const where = {
        AND: [
            // Search in name or code
            search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } }
                ]
            } : {},
            // Type filter
            type ? { type } : {},
            // Active status
            { isActive: true }
        ].filter(condition => Object.keys(condition).length > 0)
    };

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination
    const total = await prisma.warehouse.count({ where });

    // Get warehouses with relations
    const warehouses = await prisma.warehouse.findMany({
        where,
        include: {
            address: true,
            zones: {
                where: { isActive: true }
            },
            staff: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true,
                    department: true
                }
            },
            products: {
                select: {
                    id: true,
                    name: true,
                    sku: true,
                    quantity: true
                }
            }
        },
        orderBy: {
            [sortBy]: order.toLowerCase()
        },
        skip,
        take: parseInt(limit)
    });

    // Calculate additional metrics for each warehouse
    const warehousesWithMetrics = await Promise.all(warehouses.map(async (warehouse) => {
        // Calculate total inventory value
        const inventoryValue = warehouse.products.reduce(
            (sum, product) => sum + (Number(product.quantity) || 0),
            0
        );

        // Calculate space utilization if capacity is set
        const spaceUtilization = warehouse.capacity
            ? (warehouse.products.length / warehouse.capacity) * 100
            : null;

        return {
            ...warehouse,
            metrics: {
                totalProducts: warehouse.products.length,
                inventoryValue,
                spaceUtilization,
                zoneCount: warehouse.zones.length
            }
        };
    }));

    // Calculate pagination details
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasMore = page < totalPages;

    res.status(200).json({
        success: true,
        count: warehouses.length,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages,
            hasMore
        },
        data: warehousesWithMetrics
    });
});

/**
 * @desc    Get single warehouse
 * @route   GET /api/v1/warehouses/:id
 * @access  Private
 */
exports.getWarehouse = asyncHandler(async (req, res) => {
    const warehouse = await prisma.warehouse.findUnique({
        where: { id: req.params.id },
        include: {
            address: true,
            zones: {
                where: { isActive: true }
            },
            staff: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true,
                    department: true
                }
            },
            products: {
                select: {
                    id: true,
                    name: true,
                    sku: true,
                    quantity: true,
                    location: true,
                    category: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            }
        }
    });

    if (!warehouse) {
        throw new ErrorResponse('Warehouse not found', 404);
    }

    // Calculate warehouse metrics
    const metrics = {
        totalProducts: warehouse.products.length,
        totalInventoryValue: warehouse.products.reduce(
            (sum, product) => sum + (Number(product.quantity) || 0),
            0
        ),
        spaceUtilization: warehouse.capacity
            ? (warehouse.products.length / warehouse.capacity) * 100
            : null,
        zoneCount: warehouse.zones.length,
        staffCount: warehouse.staff.length,
        productsByCategory: warehouse.products.reduce((acc, product) => {
            const categoryName = product.category.name;
            if (!acc[categoryName]) {
                acc[categoryName] = 0;
            }
            acc[categoryName]++;
            return acc;
        }, {})
    };

    res.status(200).json({
        success: true,
        data: {
            ...warehouse,
            metrics
        }
    });
});

/**
 * @desc    Create new warehouse
 * @route   POST /api/v1/warehouses
 * @access  Private
 */
exports.createWarehouse = asyncHandler(async (req, res) => {
    const { address, zones, staff, ...warehouseData } = req.body;

    // Create warehouse with nested relations
    const warehouse = await prisma.warehouse.create({
        data: {
            ...warehouseData,
            address: {
                create: address
            },
            zones: zones ? {
                createMany: {
                    data: zones
                }
            } : undefined,
            staff: staff ? {
                connect: staff.map(userId => ({ id: userId }))
            } : undefined
        },
        include: {
            address: true,
            zones: true,
            staff: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true
                }
            }
        }
    });

    res.status(201).json({
        success: true,
        data: warehouse
    });
});

/**
 * @desc    Update warehouse
 * @route   PUT /api/v1/warehouses/:id
 * @access  Private
 */
exports.updateWarehouse = asyncHandler(async (req, res) => {
    const { address, zones, staff, ...updateData } = req.body;

    // Check if warehouse exists
    let warehouse = await prisma.warehouse.findUnique({
        where: { id: req.params.id }
    });

    if (!warehouse) {
        throw new ErrorResponse('Warehouse not found', 404);
    }

    // Update warehouse with nested relations
    warehouse = await prisma.$transaction(async (prisma) => {
        // Update main warehouse data and address
        const updatedWarehouse = await prisma.warehouse.update({
            where: { id: req.params.id },
            data: {
                ...updateData,
                address: address ? {
                    upsert: {
                        create: address,
                        update: address
                    }
                } : undefined
            },
            include: {
                address: true,
                zones: true,
                staff: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        role: true
                    }
                }
            }
        });

        // Update zones if provided
        if (zones) {
            await prisma.zone.deleteMany({
                where: { warehouseId: req.params.id }
            });

            await prisma.zone.createMany({
                data: zones.map(zone => ({
                    ...zone,
                    warehouseId: req.params.id
                }))
            });
        }

        // Update staff assignments if provided
        if (staff) {
            await prisma.warehouse.update({
                where: { id: req.params.id },
                data: {
                    staff: {
                        set: staff.map(userId => ({ id: userId }))
                    }
                }
            });
        }

        return updatedWarehouse;
    });

    res.status(200).json({
        success: true,
        data: warehouse
    });
});

/**
 * @desc    Delete warehouse
 * @route   DELETE /api/v1/warehouses/:id
 * @access  Private
 */
exports.deleteWarehouse = asyncHandler(async (req, res) => {
    const warehouse = await prisma.warehouse.findUnique({
        where: { id: req.params.id },
        include: {
            products: true
        }
    });

    if (!warehouse) {
        throw new ErrorResponse('Warehouse not found', 404);
    }

    if (warehouse.products.length > 0) {
        throw new ErrorResponse(
            'Cannot delete warehouse with existing products. Please transfer or remove all products first.',
            400
        );
    }

    // Instead of deleting, mark as inactive
    await prisma.warehouse.update({
        where: { id: req.params.id },
        data: {
            isActive: false
        }
    });

    res.status(200).json({
        success: true,
        data: {}
    });
});

/**
 * @desc    Get warehouse inventory status
 * @route   GET /api/v1/warehouses/:id/inventory
 * @access  Private
 */
exports.getWarehouseInventory = asyncHandler(async (req, res) => {
    const inventory = await prisma.product.findMany({
        where: {
            warehouseId: req.params.id,
            isActive: true
        },
        select: {
            id: true,
            name: true,
            sku: true,
            quantity: true,
            reorderPoint: true,
            location: true,
            category: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    // Calculate inventory metrics
    const metrics = {
        totalItems: inventory.length,
        lowStockItems: inventory.filter(item => item.quantity <= item.reorderPoint).length,
        outOfStockItems: inventory.filter(item => item.quantity === 0).length,
        categoryBreakdown: inventory.reduce((acc, item) => {
            const categoryName = item.category.name;
            if (!acc[categoryName]) {
                acc[categoryName] = 0;
            }
            acc[categoryName]++;
            return acc;
        }, {})
    };

    res.status(200).json({
        success: true,
        data: {
            inventory,
            metrics
        }
    });
});
