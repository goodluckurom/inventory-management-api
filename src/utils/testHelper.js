const { prisma } = require('../server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');
const logger = require('./logger');
const StringHelper = require('./stringHelper');
const Security = require('./security');

/**
 * Test Helper Utility
 */
class TestHelper {
    /**
     * Clear all data from the test database
     * @returns {Promise<void>}
     */
    static async clearDatabase() {
        if (config.isProduction()) {
            throw new Error('Cannot clear database in production');
        }

        const tables = [
            'StockMovement',
            'ProductSupplier',
            'ProductImage',
            'ProductDocument',
            'QualityCheck',
            'PurchaseOrderItem',
            'PurchaseOrder',
            'SalesOrderItem',
            'SalesOrder',
            'UserNotification',
            'Notification',
            'Product',
            'Supplier',
            'Customer',
            'User',
            'Category',
            'Brand',
            'Warehouse',
            'Zone',
            'Address'
        ];

        for (const table of tables) {
            await prisma[table].deleteMany();
        }
    }

    /**
     * Generate test data
     * @returns {Promise<Object>} Generated test data
     */
    static async generateTestData() {
        try {
            // Create test users
            const users = await this.createTestUsers();

            // Create test categories
            const categories = await this.createTestCategories();

            // Create test suppliers
            const suppliers = await this.createTestSuppliers();

            // Create test warehouses
            const warehouses = await this.createTestWarehouses();

            // Create test products
            const products = await this.createTestProducts({
                categories,
                suppliers,
                warehouses
            });

            return {
                users,
                categories,
                suppliers,
                warehouses,
                products
            };
        } catch (error) {
            logger.error('Error generating test data:', error);
            throw error;
        }
    }

    /**
     * Create test users
     * @returns {Promise<Array>} Created users
     */
    static async createTestUsers() {
        const password = await bcrypt.hash('Password123!', 10);

        const users = [
            {
                email: 'admin@test.com',
                password,
                firstName: 'Admin',
                lastName: 'User',
                role: 'ADMIN'
            },
            {
                email: 'manager@test.com',
                password,
                firstName: 'Manager',
                lastName: 'User',
                role: 'MANAGER'
            },
            {
                email: 'staff@test.com',
                password,
                firstName: 'Staff',
                lastName: 'User',
                role: 'WAREHOUSE_STAFF'
            }
        ];

        return await prisma.user.createMany({
            data: users
        });
    }

    /**
     * Create test categories
     * @returns {Promise<Array>} Created categories
     */
    static async createTestCategories() {
        const categories = [
            { name: 'Electronics', slug: 'electronics' },
            { name: 'Furniture', slug: 'furniture' },
            { name: 'Clothing', slug: 'clothing' }
        ];

        return await prisma.category.createMany({
            data: categories
        });
    }

    /**
     * Create test suppliers
     * @returns {Promise<Array>} Created suppliers
     */
    static async createTestSuppliers() {
        const suppliers = [
            {
                name: 'Test Supplier 1',
                code: 'SUP001',
                email: 'supplier1@test.com',
                phone: '1234567890',
                type: 'MANUFACTURER'
            },
            {
                name: 'Test Supplier 2',
                code: 'SUP002',
                email: 'supplier2@test.com',
                phone: '0987654321',
                type: 'WHOLESALER'
            }
        ];

        return await prisma.supplier.createMany({
            data: suppliers
        });
    }

    /**
     * Create test warehouses
     * @returns {Promise<Array>} Created warehouses
     */
    static async createTestWarehouses() {
        const warehouses = [
            {
                name: 'Main Warehouse',
                code: 'WH001',
                type: 'MAIN'
            },
            {
                name: 'Secondary Warehouse',
                code: 'WH002',
                type: 'SATELLITE'
            }
        ];

        return await prisma.warehouse.createMany({
            data: warehouses
        });
    }

    /**
     * Create test products
     * @param {Object} options - Creation options
     * @returns {Promise<Array>} Created products
     */
    static async createTestProducts({ categories, suppliers, warehouses }) {
        const products = [
            {
                name: 'Test Product 1',
                sku: 'PRD001',
                description: 'Test product description 1',
                categoryId: categories[0].id,
                quantity: 100,
                unit: 'PIECES',
                price: 99.99,
                supplierId: suppliers[0].id,
                warehouseId: warehouses[0].id
            },
            {
                name: 'Test Product 2',
                sku: 'PRD002',
                description: 'Test product description 2',
                categoryId: categories[1].id,
                quantity: 50,
                unit: 'PIECES',
                price: 149.99,
                supplierId: suppliers[1].id,
                warehouseId: warehouses[0].id
            }
        ];

        return await prisma.product.createMany({
            data: products
        });
    }

    /**
     * Generate test JWT token
     * @param {Object} user - User object
     * @returns {string} JWT token
     */
    static generateTestToken(user) {
        return jwt.sign(
            { id: user.id },
            config.get('auth.jwtSecret'),
            { expiresIn: config.get('auth.jwtExpire') }
        );
    }

    /**
     * Create test order
     * @param {Object} options - Order options
     * @returns {Promise<Object>} Created order
     */
    static async createTestOrder({ type = 'PURCHASE', userId, supplierId, products }) {
        const orderNumber = `${type === 'PURCHASE' ? 'PO' : 'SO'}-${Date.now()}`;
        const items = products.map(product => ({
            productId: product.id,
            quantity: product.quantity,
            unitPrice: product.price,
            totalPrice: product.quantity * product.price
        }));

        const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

        if (type === 'PURCHASE') {
            return await prisma.purchaseOrder.create({
                data: {
                    orderNumber,
                    supplierId,
                    status: 'PENDING',
                    totalAmount,
                    items: {
                        create: items
                    },
                    createdById: userId
                }
            });
        } else {
            return await prisma.salesOrder.create({
                data: {
                    orderNumber,
                    customerId: userId,
                    status: 'PENDING',
                    totalAmount,
                    items: {
                        create: items
                    },
                    createdById: userId
                }
            });
        }
    }

    /**
     * Generate mock request object
     * @param {Object} options - Request options
     * @returns {Object} Mock request object
     */
    static mockRequest(options = {}) {
        return {
            body: {},
            query: {},
            params: {},
            headers: {},
            ...options,
            get: (key) => options.headers?.[key]
        };
    }

    /**
     * Generate mock response object
     * @returns {Object} Mock response object
     */
    static mockResponse() {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        res.send = jest.fn().mockReturnValue(res);
        return res;
    }

    /**
     * Generate mock next function
     * @returns {Function} Mock next function
     */
    static mockNext() {
        return jest.fn();
    }
}

module.exports = TestHelper;
