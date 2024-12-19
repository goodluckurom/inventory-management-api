const { prisma } = require('../server');
const logger = require('./logger');
const ErrorResponse = require('./errorResponse');

/**
 * Database Operations Utility
 */
class DbOperations {
    /**
     * Execute operation within a transaction
     * @param {Function} operation - Operation to execute
     * @returns {Promise<any>} Operation result
     */
    static async withTransaction(operation) {
        const startTime = Date.now();
        try {
            const result = await prisma.$transaction(async (prisma) => {
                return await operation(prisma);
            });

            logger.debug({
                type: 'transaction',
                duration: Date.now() - startTime,
                success: true
            });

            return result;
        } catch (error) {
            logger.error({
                type: 'transaction',
                duration: Date.now() - startTime,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Safely execute database operation with error handling
     * @param {Function} operation - Database operation to execute
     * @param {string} errorMessage - Custom error message
     * @returns {Promise<any>} Operation result
     */
    static async executeOperation(operation, errorMessage = 'Database operation failed') {
        const startTime = Date.now();
        try {
            const result = await operation();
            
            logger.debug({
                type: 'db_operation',
                duration: Date.now() - startTime,
                success: true
            });

            return result;
        } catch (error) {
            logger.error({
                type: 'db_operation',
                duration: Date.now() - startTime,
                error: error.message,
                stack: error.stack
            });

            throw new ErrorResponse(errorMessage, 500);
        }
    }

    /**
     * Create resource with validation
     * @param {string} model - Prisma model name
     * @param {Object} data - Resource data
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Created resource
     */
    static async create(model, data, options = {}) {
        return await this.executeOperation(async () => {
            return await prisma[model].create({
                data,
                ...options
            });
        }, `Failed to create ${model}`);
    }

    /**
     * Update resource with validation
     * @param {string} model - Prisma model name
     * @param {string} id - Resource ID
     * @param {Object} data - Update data
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Updated resource
     */
    static async update(model, id, data, options = {}) {
        return await this.executeOperation(async () => {
            const resource = await prisma[model].findUnique({ where: { id } });
            
            if (!resource) {
                throw new ErrorResponse(`${model} not found`, 404);
            }

            return await prisma[model].update({
                where: { id },
                data,
                ...options
            });
        }, `Failed to update ${model}`);
    }

    /**
     * Delete resource with validation
     * @param {string} model - Prisma model name
     * @param {string} id - Resource ID
     * @returns {Promise<Object>} Deleted resource
     */
    static async delete(model, id) {
        return await this.executeOperation(async () => {
            const resource = await prisma[model].findUnique({ where: { id } });
            
            if (!resource) {
                throw new ErrorResponse(`${model} not found`, 404);
            }

            return await prisma[model].delete({ where: { id } });
        }, `Failed to delete ${model}`);
    }

    /**
     * Find resource by ID with validation
     * @param {string} model - Prisma model name
     * @param {string} id - Resource ID
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Found resource
     */
    static async findById(model, id, options = {}) {
        return await this.executeOperation(async () => {
            const resource = await prisma[model].findUnique({
                where: { id },
                ...options
            });

            if (!resource) {
                throw new ErrorResponse(`${model} not found`, 404);
            }

            return resource;
        }, `Failed to find ${model}`);
    }

    /**
     * Find resources with pagination
     * @param {string} model - Prisma model name
     * @param {Object} query - Query parameters
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Paginated results
     */
    static async findWithPagination(model, query, options = {}) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const skip = (page - 1) * limit;

        return await this.executeOperation(async () => {
            const [total, items] = await prisma.$transaction([
                prisma[model].count({ where: options.where }),
                prisma[model].findMany({
                    ...options,
                    skip,
                    take: limit
                })
            ]);

            return {
                items,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        }, `Failed to fetch ${model} list`);
    }

    /**
     * Bulk create resources
     * @param {string} model - Prisma model name
     * @param {Array} data - Array of resources to create
     * @returns {Promise<Array>} Created resources
     */
    static async bulkCreate(model, data) {
        return await this.withTransaction(async (prisma) => {
            return await prisma[model].createMany({
                data,
                skipDuplicates: true
            });
        });
    }

    /**
     * Bulk update resources
     * @param {string} model - Prisma model name
     * @param {Array} updates - Array of updates
     * @returns {Promise<Array>} Updated resources
     */
    static async bulkUpdate(model, updates) {
        return await this.withTransaction(async (prisma) => {
            const operations = updates.map(({ id, data }) =>
                prisma[model].update({
                    where: { id },
                    data
                })
            );

            return await Promise.all(operations);
        });
    }

    /**
     * Bulk delete resources
     * @param {string} model - Prisma model name
     * @param {Array} ids - Array of resource IDs
     * @returns {Promise<Object>} Delete result
     */
    static async bulkDelete(model, ids) {
        return await this.withTransaction(async (prisma) => {
            return await prisma[model].deleteMany({
                where: {
                    id: {
                        in: ids
                    }
                }
            });
        });
    }

    /**
     * Upsert resource
     * @param {string} model - Prisma model name
     * @param {Object} where - Where condition
     * @param {Object} create - Create data
     * @param {Object} update - Update data
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Upserted resource
     */
    static async upsert(model, where, create, update, options = {}) {
        return await this.executeOperation(async () => {
            return await prisma[model].upsert({
                where,
                create,
                update,
                ...options
            });
        }, `Failed to upsert ${model}`);
    }

    /**
     * Check if resource exists
     * @param {string} model - Prisma model name
     * @param {Object} where - Where condition
     * @returns {Promise<boolean>} Whether resource exists
     */
    static async exists(model, where) {
        return await this.executeOperation(async () => {
            const count = await prisma[model].count({ where });
            return count > 0;
        }, `Failed to check ${model} existence`);
    }
}

module.exports = DbOperations;
