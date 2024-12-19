const { prisma } = require('../server');
const logger = require('./logger');

/**
 * Search and Filter Helper
 */
class SearchHelper {
    /**
     * Build base search conditions for products
     * @param {Object} filters - Search filters
     * @returns {Object} Prisma where conditions
     */
    static buildProductSearch(filters) {
        const where = {
            AND: [
                // Active products by default
                { isActive: filters.includeInactive ? undefined : true },

                // Text search across multiple fields
                filters.search ? {
                    OR: [
                        { name: { contains: filters.search, mode: 'insensitive' } },
                        { description: { contains: filters.search, mode: 'insensitive' } },
                        { sku: { contains: filters.search, mode: 'insensitive' } }
                    ]
                } : {},

                // Category filter
                filters.categoryId ? { categoryId: filters.categoryId } : {},

                // Brand filter
                filters.brandId ? { brandId: filters.brandId } : {},

                // Price range
                filters.minPrice || filters.maxPrice ? {
                    price: {
                        gte: filters.minPrice ? parseFloat(filters.minPrice) : undefined,
                        lte: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined
                    }
                } : {},

                // Stock status
                filters.inStock === true ? { quantity: { gt: 0 } } :
                filters.inStock === false ? { quantity: 0 } : {},

                // Low stock
                filters.lowStock ? {
                    quantity: {
                        lte: prisma.raw('reorderPoint')
                    }
                } : {},

                // Warehouse filter
                filters.warehouseId ? { warehouseId: filters.warehouseId } : {},

                // Supplier filter
                filters.supplierId ? {
                    suppliers: {
                        some: { supplierId: filters.supplierId }
                    }
                } : {}
            ].filter(condition => Object.keys(condition).length > 0)
        };

        return where;
    }

    /**
     * Build base search conditions for suppliers
     * @param {Object} filters - Search filters
     * @returns {Object} Prisma where conditions
     */
    static buildSupplierSearch(filters) {
        const where = {
            AND: [
                // Active suppliers by default
                { isActive: filters.includeInactive ? undefined : true },

                // Text search across multiple fields
                filters.search ? {
                    OR: [
                        { name: { contains: filters.search, mode: 'insensitive' } },
                        { email: { contains: filters.search, mode: 'insensitive' } },
                        { code: { contains: filters.search, mode: 'insensitive' } }
                    ]
                } : {},

                // Type filter
                filters.type ? { type: filters.type } : {},

                // Status filter
                filters.status ? { status: filters.status } : {},

                // Rating filter
                filters.minRating ? { rating: { gte: parseInt(filters.minRating) } } : {}
            ].filter(condition => Object.keys(condition).length > 0)
        };

        return where;
    }

    /**
     * Build base search conditions for orders
     * @param {Object} filters - Search filters
     * @returns {Object} Prisma where conditions
     */
    static buildOrderSearch(filters) {
        const where = {
            AND: [
                // Text search
                filters.search ? {
                    OR: [
                        { orderNumber: { contains: filters.search, mode: 'insensitive' } }
                    ]
                } : {},

                // Status filter
                filters.status ? { status: filters.status } : {},

                // Date range
                filters.startDate || filters.endDate ? {
                    createdAt: {
                        gte: filters.startDate ? new Date(filters.startDate) : undefined,
                        lte: filters.endDate ? new Date(filters.endDate) : undefined
                    }
                } : {},

                // Customer/Supplier filter
                filters.customerId ? { customerId: filters.customerId } : {},
                filters.supplierId ? { supplierId: filters.supplierId } : {},

                // Amount range
                filters.minAmount || filters.maxAmount ? {
                    totalAmount: {
                        gte: filters.minAmount ? parseFloat(filters.minAmount) : undefined,
                        lte: filters.maxAmount ? parseFloat(filters.maxAmount) : undefined
                    }
                } : {}
            ].filter(condition => Object.keys(condition).length > 0)
        };

        return where;
    }

    /**
     * Build sort options
     * @param {string} sortBy - Field to sort by
     * @param {string} order - Sort order (asc/desc)
     * @returns {Object} Prisma orderBy condition
     */
    static buildSortOptions(sortBy = 'createdAt', order = 'desc') {
        return {
            [sortBy]: order.toLowerCase()
        };
    }

    /**
     * Build pagination options
     * @param {number} page - Page number
     * @param {number} limit - Items per page
     * @returns {Object} Prisma pagination options
     */
    static buildPaginationOptions(page = 1, limit = 10) {
        const skip = (parseInt(page) - 1) * parseInt(limit);
        return {
            skip,
            take: parseInt(limit)
        };
    }

    /**
     * Execute search query with pagination
     * @param {string} model - Prisma model name
     * @param {Object} where - Where conditions
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Search results with pagination
     */
    static async executeSearch(model, where, options = {}) {
        try {
            const [total, items] = await prisma.$transaction([
                prisma[model].count({ where }),
                prisma[model].findMany({
                    where,
                    ...options
                })
            ]);

            const limit = options.take || 10;
            const page = Math.floor(options.skip / limit) + 1;

            return {
                items,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('Search execution error:', error);
            throw error;
        }
    }

    /**
     * Parse and validate search parameters
     * @param {Object} query - Query parameters
     * @returns {Object} Validated and parsed parameters
     */
    static parseSearchParams(query) {
        return {
            search: query.search?.trim(),
            page: Math.max(1, parseInt(query.page) || 1),
            limit: Math.min(100, Math.max(1, parseInt(query.limit) || 10)),
            sortBy: query.sortBy,
            order: ['asc', 'desc'].includes(query.order?.toLowerCase()) 
                ? query.order.toLowerCase() 
                : 'desc',
            includeInactive: query.includeInactive === 'true',
            // Add other common parameters as needed
            ...query
        };
    }
}

module.exports = SearchHelper;
