const { prisma } = require('../server');
const bcrypt = require('bcryptjs');
const logger = require('./logger');
const config = require('./config');
const StringHelper = require('./stringHelper');
const Security = require('./security');

/**
 * Migration Helper Utility
 */
class MigrationHelper {
    /**
     * Run all migrations
     * @returns {Promise<void>}
     */
    async runMigrations() {
        if (config.isProduction()) {
            logger.info('Running migrations in production mode');
        }

        try {
            logger.info('Starting database migrations');

            // Run migrations in sequence
            await this.createInitialCategories();
            await this.createInitialRoles();
            await this.createAdminUser();
            await this.createDefaultWarehouse();
            await this.createDefaultSuppliers();

            logger.info('Database migrations completed successfully');
        } catch (error) {
            logger.error('Error running migrations:', error);
            throw error;
        }
    }

    /**
     * Seed development data
     * @returns {Promise<void>}
     */
    async seedDevelopmentData() {
        if (config.isProduction()) {
            throw new Error('Cannot seed development data in production');
        }

        try {
            logger.info('Starting development data seeding');

            await this.seedTestUsers();
            await this.seedSampleProducts();
            await this.seedSampleOrders();

            logger.info('Development data seeding completed successfully');
        } catch (error) {
            logger.error('Error seeding development data:', error);
            throw error;
        }
    }

    /**
     * Create initial categories
     * @returns {Promise<void>}
     */
    async createInitialCategories() {
        const categories = [
            { name: 'Electronics', slug: 'electronics' },
            { name: 'Office Supplies', slug: 'office-supplies' },
            { name: 'Furniture', slug: 'furniture' },
            { name: 'Tools', slug: 'tools' },
            { name: 'Raw Materials', slug: 'raw-materials' }
        ];

        for (const category of categories) {
            await prisma.category.upsert({
                where: { slug: category.slug },
                update: {},
                create: category
            });
        }

        logger.info(`Created ${categories.length} initial categories`);
    }

    /**
     * Create initial roles
     * @returns {Promise<void>}
     */
    async createInitialRoles() {
        // Roles are handled by enum in Prisma schema
        logger.info('Roles are managed by Prisma enum');
    }

    /**
     * Create admin user
     * @returns {Promise<void>}
     */
    async createAdminUser() {
        const adminEmail = config.get('admin.email') || 'admin@example.com';
        const adminPassword = config.get('admin.password') || 'Admin123!';

        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        await prisma.user.upsert({
            where: { email: adminEmail },
            update: {},
            create: {
                email: adminEmail,
                password: hashedPassword,
                firstName: 'Admin',
                lastName: 'User',
                role: 'ADMIN'
            }
        });

        logger.info('Created admin user');
    }

    /**
     * Create default warehouse
     * @returns {Promise<void>}
     */
    async createDefaultWarehouse() {
        await prisma.warehouse.upsert({
            where: { code: 'MAIN-01' },
            update: {},
            create: {
                name: 'Main Warehouse',
                code: 'MAIN-01',
                type: 'MAIN',
                address: {
                    create: {
                        street: '123 Main St',
                        city: 'Example City',
                        state: 'Example State',
                        country: 'Example Country',
                        postalCode: '12345'
                    }
                }
            }
        });

        logger.info('Created default warehouse');
    }

    /**
     * Create default suppliers
     * @returns {Promise<void>}
     */
    async createDefaultSuppliers() {
        const suppliers = [
            {
                name: 'General Supplies Co',
                code: 'SUP-001',
                type: 'WHOLESALER',
                email: 'contact@generalsupplies.example.com',
                phone: '1234567890'
            },
            {
                name: 'Tech Components Ltd',
                code: 'SUP-002',
                type: 'MANUFACTURER',
                email: 'contact@techcomponents.example.com',
                phone: '0987654321'
            }
        ];

        for (const supplier of suppliers) {
            await prisma.supplier.upsert({
                where: { code: supplier.code },
                update: {},
                create: supplier
            });
        }

        logger.info(`Created ${suppliers.length} default suppliers`);
    }

    /**
     * Seed test users
     * @returns {Promise<void>}
     */
    async seedTestUsers() {
        const users = [
            {
                email: 'manager@example.com',
                password: 'Manager123!',
                firstName: 'Manager',
                lastName: 'User',
                role: 'MANAGER'
            },
            {
                email: 'staff@example.com',
                password: 'Staff123!',
                firstName: 'Staff',
                lastName: 'User',
                role: 'WAREHOUSE_STAFF'
            }
        ];

        for (const user of users) {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            await prisma.user.upsert({
                where: { email: user.email },
                update: {},
                create: {
                    ...user,
                    password: hashedPassword
                }
            });
        }

        logger.info(`Created ${users.length} test users`);
    }

    /**
     * Seed sample products
     * @returns {Promise<void>}
     */
    async seedSampleProducts() {
        const warehouse = await prisma.warehouse.findFirst({
            where: { code: 'MAIN-01' }
        });

        const categories = await prisma.category.findMany();
        const suppliers = await prisma.supplier.findMany();

        const products = [
            {
                name: 'Office Chair',
                sku: 'CHAIR-001',
                description: 'Ergonomic office chair with adjustable height',
                categoryId: categories.find(c => c.slug === 'furniture').id,
                quantity: 50,
                unit: 'PIECES',
                reorderPoint: 10,
                price: 199.99,
                costPrice: 150.00,
                warehouseId: warehouse.id,
                location: 'A1-01',
                supplierId: suppliers[0].id
            },
            {
                name: 'Laptop',
                sku: 'TECH-001',
                description: 'Business laptop with 15" display',
                categoryId: categories.find(c => c.slug === 'electronics').id,
                quantity: 20,
                unit: 'PIECES',
                reorderPoint: 5,
                price: 999.99,
                costPrice: 800.00,
                warehouseId: warehouse.id,
                location: 'B2-01',
                supplierId: suppliers[1].id
            }
        ];

        for (const product of products) {
            await prisma.product.upsert({
                where: { sku: product.sku },
                update: {},
                create: product
            });
        }

        logger.info(`Created ${products.length} sample products`);
    }

    /**
     * Seed sample orders
     * @returns {Promise<void>}
     */
    async seedSampleOrders() {
        const products = await prisma.product.findMany();
        const supplier = await prisma.supplier.findFirst();
        const user = await prisma.user.findFirst({
            where: { role: 'MANAGER' }
        });

        // Create purchase order
        await prisma.purchaseOrder.create({
            data: {
                orderNumber: 'PO-001',
                supplierId: supplier.id,
                status: 'PENDING',
                totalAmount: 1000.00,
                createdById: user.id,
                items: {
                    create: products.map(product => ({
                        productId: product.id,
                        quantity: 5,
                        unitPrice: product.costPrice,
                        totalPrice: product.costPrice * 5
                    }))
                }
            }
        });

        logger.info('Created sample orders');
    }

    /**
     * Reset database (for development only)
     * @returns {Promise<void>}
     */
    async resetDatabase() {
        if (config.isProduction()) {
            throw new Error('Cannot reset database in production');
        }

        try {
            logger.warn('Resetting database...');

            // Delete all data in reverse order of dependencies
            await prisma.$transaction([
                prisma.stockMovement.deleteMany(),
                prisma.purchaseOrderItem.deleteMany(),
                prisma.purchaseOrder.deleteMany(),
                prisma.productSupplier.deleteMany(),
                prisma.product.deleteMany(),
                prisma.supplier.deleteMany(),
                prisma.category.deleteMany(),
                prisma.warehouse.deleteMany(),
                prisma.address.deleteMany(),
                prisma.user.deleteMany()
            ]);

            logger.info('Database reset completed');
        } catch (error) {
            logger.error('Error resetting database:', error);
            throw error;
        }
    }
}

module.exports = new MigrationHelper();
