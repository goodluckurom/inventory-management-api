const { prisma } = require('../server');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Get all suppliers with filtering, sorting, and pagination
 * @route   GET /api/v1/suppliers
 * @access  Private
 */
exports.getSuppliers = asyncHandler(async (req, res) => {
    const {
        search,
        type,
        status,
        sortBy = 'createdAt',
        order = 'desc',
        page = 1,
        limit = 10
    } = req.query;

    // Build filter conditions
    const where = {
        AND: [
            // Search in name, email, or code
            search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } }
                ]
            } : {},
            // Type filter
            type ? { type } : {},
            // Status filter
            status ? { status } : {},
            // Active status
            { isActive: true }
        ].filter(condition => Object.keys(condition).length > 0)
    };

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination
    const total = await prisma.supplier.count({ where });

    // Get suppliers with relations
    const suppliers = await prisma.supplier.findMany({
        where,
        include: {
            address: true,
            products: {
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            sku: true,
                            price: true
                        }
                    }
                }
            },
            purchaseOrders: {
                take: 5,
                orderBy: {
                    createdAt: 'desc'
                },
                select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    totalAmount: true,
                    createdAt: true
                }
            },
            documents: true,
            notes: {
                orderBy: {
                    createdAt: 'desc'
                }
            }
        },
        orderBy: {
            [sortBy]: order.toLowerCase()
        },
        skip,
        take: parseInt(limit)
    });

    // Calculate pagination details
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasMore = page < totalPages;

    res.status(200).json({
        success: true,
        count: suppliers.length,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages,
            hasMore
        },
        data: suppliers
    });
});

/**
 * @desc    Get single supplier
 * @route   GET /api/v1/suppliers/:id
 * @access  Private
 */
exports.getSupplier = asyncHandler(async (req, res) => {
    const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.id },
        include: {
            address: true,
            products: {
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            sku: true,
                            price: true,
                            quantity: true
                        }
                    }
                }
            },
            purchaseOrders: {
                orderBy: {
                    createdAt: 'desc'
                },
                take: 10
            },
            documents: true,
            notes: {
                orderBy: {
                    createdAt: 'desc'
                }
            }
        }
    });

    if (!supplier) {
        throw new ErrorResponse('Supplier not found', 404);
    }

    res.status(200).json({
        success: true,
        data: supplier
    });
});

/**
 * @desc    Create new supplier
 * @route   POST /api/v1/suppliers
 * @access  Private
 */
exports.createSupplier = asyncHandler(async (req, res) => {
    const { address, documents, notes, ...supplierData } = req.body;

    // Create supplier with nested relations
    const supplier = await prisma.supplier.create({
        data: {
            ...supplierData,
            address: address ? {
                create: address
            } : undefined,
            documents: documents ? {
                createMany: {
                    data: documents
                }
            } : undefined,
            notes: notes ? {
                createMany: {
                    data: notes.map(note => ({
                        content: note
                    }))
                }
            } : undefined
        },
        include: {
            address: true,
            documents: true,
            notes: true
        }
    });

    res.status(201).json({
        success: true,
        data: supplier
    });
});

/**
 * @desc    Update supplier
 * @route   PUT /api/v1/suppliers/:id
 * @access  Private
 */
exports.updateSupplier = asyncHandler(async (req, res) => {
    const { address, documents, notes, ...updateData } = req.body;

    // Check if supplier exists
    let supplier = await prisma.supplier.findUnique({
        where: { id: req.params.id }
    });

    if (!supplier) {
        throw new ErrorResponse('Supplier not found', 404);
    }

    // Update supplier with nested relations
    supplier = await prisma.$transaction(async (prisma) => {
        // Update main supplier data
        const updatedSupplier = await prisma.supplier.update({
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
                documents: true,
                notes: true
            }
        });

        // Update documents if provided
        if (documents) {
            await prisma.supplierDocument.deleteMany({
                where: { supplierId: req.params.id }
            });

            await prisma.supplierDocument.createMany({
                data: documents.map(doc => ({
                    ...doc,
                    supplierId: req.params.id
                }))
            });
        }

        // Add new notes if provided
        if (notes) {
            await prisma.note.createMany({
                data: notes.map(note => ({
                    content: note,
                    supplierId: req.params.id
                }))
            });
        }

        return updatedSupplier;
    });

    res.status(200).json({
        success: true,
        data: supplier
    });
});

/**
 * @desc    Delete supplier
 * @route   DELETE /api/v1/suppliers/:id
 * @access  Private
 */
exports.deleteSupplier = asyncHandler(async (req, res) => {
    const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.id }
    });

    if (!supplier) {
        throw new ErrorResponse('Supplier not found', 404);
    }

    // Instead of deleting, mark as inactive
    await prisma.supplier.update({
        where: { id: req.params.id },
        data: {
            isActive: false,
            status: 'INACTIVE'
        }
    });

    res.status(200).json({
        success: true,
        data: {}
    });
});

/**
 * @desc    Get supplier performance metrics
 * @route   GET /api/v1/suppliers/:id/performance
 * @access  Private
 */
exports.getSupplierPerformance = asyncHandler(async (req, res) => {
    const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.id },
        include: {
            purchaseOrders: {
                where: {
                    status: {
                        in: ['DELIVERED', 'CANCELLED']
                    }
                },
                select: {
                    status: true,
                    expectedDate: true,
                    deliveryDate: true,
                    totalAmount: true
                }
            }
        }
    });

    if (!supplier) {
        throw new ErrorResponse('Supplier not found', 404);
    }

    // Calculate performance metrics
    const totalOrders = supplier.purchaseOrders.length;
    const deliveredOrders = supplier.purchaseOrders.filter(order => order.status === 'DELIVERED').length;
    const cancelledOrders = supplier.purchaseOrders.filter(order => order.status === 'CANCELLED').length;
    
    // Calculate on-time delivery rate
    const onTimeDeliveries = supplier.purchaseOrders.filter(order => 
        order.status === 'DELIVERED' && 
        order.deliveryDate && 
        order.expectedDate && 
        new Date(order.deliveryDate) <= new Date(order.expectedDate)
    ).length;

    const metrics = {
        totalOrders,
        deliveredOrders,
        cancelledOrders,
        orderFulfillmentRate: totalOrders ? (deliveredOrders / totalOrders) * 100 : 0,
        onTimeDeliveryRate: deliveredOrders ? (onTimeDeliveries / deliveredOrders) * 100 : 0,
        cancellationRate: totalOrders ? (cancelledOrders / totalOrders) * 100 : 0,
        totalSpent: supplier.purchaseOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0)
    };

    res.status(200).json({
        success: true,
        data: metrics
    });
});
