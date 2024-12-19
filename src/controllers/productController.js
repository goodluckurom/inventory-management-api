const { prisma } = require('../server');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Get all products with filtering, sorting, and pagination
 * @route   GET /api/v1/products
 * @access  Private
 */
exports.getProducts = asyncHandler(async (req, res) => {
    const {
        search,
        category,
        supplier,
        minPrice,
        maxPrice,
        inStock,
        isActive,
        sortBy = 'createdAt',
        order = 'desc',
        page = 1,
        limit = 10
    } = req.query;

    // Build filter conditions
    const where = {
        AND: [
            // Search in name, description, or SKU
            search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { sku: { contains: search, mode: 'insensitive' } }
                ]
            } : {},
            // Category filter
            category ? { categoryId: category } : {},
            // Supplier filter
            supplier ? { 
                suppliers: {
                    some: { supplierId: supplier }
                }
            } : {},
            // Price range filter
            minPrice || maxPrice ? {
                price: {
                    gte: minPrice ? parseFloat(minPrice) : undefined,
                    lte: maxPrice ? parseFloat(maxPrice) : undefined
                }
            } : {},
            // Stock status filter
            inStock === 'true' ? { quantity: { gt: 0 } } : 
            inStock === 'false' ? { quantity: 0 } : {},
            // Active status filter
            isActive !== undefined ? { isActive: isActive === 'true' } : {}
        ].filter(condition => Object.keys(condition).length > 0)
    };

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination
    const total = await prisma.product.count({ where });

    // Get products with relations
    const products = await prisma.product.findMany({
        where,
        include: {
            category: true,
            brand: true,
            suppliers: {
                include: {
                    supplier: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            },
            warehouse: {
                select: {
                    id: true,
                    name: true,
                    code: true
                }
            },
            images: true,
            stockMovements: {
                take: 5,
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
        count: products.length,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages,
            hasMore
        },
        data: products
    });
});

/**
 * @desc    Get single product
 * @route   GET /api/v1/products/:id
 * @access  Private
 */
exports.getProduct = asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
        where: { id: req.params.id },
        include: {
            category: true,
            brand: true,
            suppliers: {
                include: {
                    supplier: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            },
            warehouse: {
                select: {
                    id: true,
                    name: true,
                    code: true
                }
            },
            images: true,
            stockMovements: {
                take: 10,
                orderBy: {
                    createdAt: 'desc'
                }
            },
            qualityChecks: {
                take: 5,
                orderBy: {
                    checkDate: 'desc'
                }
            }
        }
    });

    if (!product) {
        throw new ErrorResponse('Product not found', 404);
    }

    res.status(200).json({
        success: true,
        data: product
    });
});

/**
 * @desc    Create new product
 * @route   POST /api/v1/products
 * @access  Private
 */
exports.createProduct = asyncHandler(async (req, res) => {
    // Extract supplier IDs and prices from request
    const { suppliers, ...productData } = req.body;

    // Create product with nested relations
    const product = await prisma.product.create({
        data: {
            ...productData,
            suppliers: {
                create: suppliers.map(supplier => ({
                    supplier: {
                        connect: { id: supplier.id }
                    },
                    price: supplier.price,
                    leadTime: supplier.leadTime,
                    minimumOrder: supplier.minimumOrder,
                    isPreferred: supplier.isPreferred || false
                }))
            },
            createdById: req.user.id
        },
        include: {
            category: true,
            brand: true,
            suppliers: {
                include: {
                    supplier: true
                }
            },
            warehouse: true
        }
    });

    // Create initial stock movement record
    if (product.quantity > 0) {
        await prisma.stockMovement.create({
            data: {
                productId: product.id,
                type: 'ADJUSTMENT',
                quantity: product.quantity,
                reason: 'Initial stock',
                createdById: req.user.id
            }
        });
    }

    res.status(201).json({
        success: true,
        data: product
    });
});

/**
 * @desc    Update product
 * @route   PUT /api/v1/products/:id
 * @access  Private
 */
exports.updateProduct = asyncHandler(async (req, res) => {
    const { suppliers, ...updateData } = req.body;

    // Check if product exists
    let product = await prisma.product.findUnique({
        where: { id: req.params.id },
        include: {
            suppliers: true
        }
    });

    if (!product) {
        throw new ErrorResponse('Product not found', 404);
    }

    // Begin transaction to update product and related data
    product = await prisma.$transaction(async (prisma) => {
        // Update product
        const updatedProduct = await prisma.product.update({
            where: { id: req.params.id },
            data: {
                ...updateData,
                lastModifiedById: req.user.id
            },
            include: {
                category: true,
                brand: true,
                suppliers: {
                    include: {
                        supplier: true
                    }
                },
                warehouse: true
            }
        });

        // Update suppliers if provided
        if (suppliers && suppliers.length > 0) {
            // Delete existing supplier relationships
            await prisma.productSupplier.deleteMany({
                where: { productId: req.params.id }
            });

            // Create new supplier relationships
            await prisma.productSupplier.createMany({
                data: suppliers.map(supplier => ({
                    productId: req.params.id,
                    supplierId: supplier.id,
                    price: supplier.price,
                    leadTime: supplier.leadTime,
                    minimumOrder: supplier.minimumOrder,
                    isPreferred: supplier.isPreferred || false
                }))
            });
        }

        return updatedProduct;
    });

    res.status(200).json({
        success: true,
        data: product
    });
});

/**
 * @desc    Delete product
 * @route   DELETE /api/v1/products/:id
 * @access  Private
 */
exports.deleteProduct = asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
        where: { id: req.params.id }
    });

    if (!product) {
        throw new ErrorResponse('Product not found', 404);
    }

    // Instead of deleting, mark as inactive
    await prisma.product.update({
        where: { id: req.params.id },
        data: {
            isActive: false,
            lastModifiedById: req.user.id
        }
    });

    res.status(200).json({
        success: true,
        data: {}
    });
});

/**
 * @desc    Get low stock products
 * @route   GET /api/v1/products/low-stock
 * @access  Private
 */
exports.getLowStockProducts = asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
        where: {
            AND: [
                { isActive: true },
                {
                    quantity: {
                        lte: prisma.raw('reorderPoint')
                    }
                }
            ]
        },
        include: {
            category: true,
            suppliers: {
                include: {
                    supplier: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            },
            warehouse: {
                select: {
                    id: true,
                    name: true,
                    code: true
                }
            }
        }
    });

    res.status(200).json({
        success: true,
        count: products.length,
        data: products
    });
});

/**
 * @desc    Update product stock
 * @route   POST /api/v1/products/:id/stock
 * @access  Private
 */
exports.updateStock = asyncHandler(async (req, res) => {
    const { quantity, type, reason } = req.body;

    const product = await prisma.product.findUnique({
        where: { id: req.params.id }
    });

    if (!product) {
        throw new ErrorResponse('Product not found', 404);
    }

    // Calculate new quantity based on movement type
    let newQuantity = product.quantity;
    switch (type) {
        case 'PURCHASE':
        case 'RETURN':
            newQuantity += quantity;
            break;
        case 'SALE':
        case 'DAMAGE':
        case 'LOSS':
            if (product.quantity < quantity) {
                throw new ErrorResponse('Insufficient stock', 400);
            }
            newQuantity -= quantity;
            break;
        case 'ADJUSTMENT':
            newQuantity = quantity;
            break;
        default:
            throw new ErrorResponse('Invalid movement type', 400);
    }

    // Update product stock and create movement record
    const updatedProduct = await prisma.$transaction(async (prisma) => {
        // Update product quantity
        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: {
                quantity: newQuantity,
                lastModifiedById: req.user.id
            }
        });

        // Create stock movement record
        await prisma.stockMovement.create({
            data: {
                productId: req.params.id,
                type,
                quantity,
                reason,
                createdById: req.user.id
            }
        });

        return product;
    });

    res.status(200).json({
        success: true,
        data: updatedProduct
    });
});
