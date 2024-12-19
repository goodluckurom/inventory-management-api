const request = require('supertest');
const app = require('../src/server'); // Adjusted path to the server file
const { prisma } = require('../src/server');

describe('Product Controller', () => {
    beforeAll(async () => {
        // Setup code, e.g., create test products
        await prisma.product.createMany({
            data: [
                {
                    name: 'Test Product 1',
                    quantity: 10,
                    reorderPoint: 5,
                    sku: 'TP1',
                    description: 'Description for Test Product 1',
                    price: 100,
                    categoryId: 'some-category-id', // Replace with a valid category ID
                    // other necessary fields
                },
                {
                    name: 'Test Product 2',
                    quantity: 20,
                    reorderPoint: 10,
                    sku: 'TP2',
                    description: 'Description for Test Product 2',
                    price: 200,
                    categoryId: 'some-category-id', // Replace with a valid category ID
                    // other necessary fields
                }
            ]
        });
    });

    afterAll(async () => {
        // Cleanup code, e.g., delete test products
        await prisma.product.deleteMany({});
    });

    it('should send low stock alert when stock is updated below reorder point', async () => {
        const product = await prisma.product.create({
            data: {
                name: 'Test Product',
                quantity: 10,
                reorderPoint: 5,
                // other necessary fields
            }
        });

        const response = await request(app)
            .post(`/api/v1/products/${product.id}/stock`)
            .send({
                quantity: 6,
                type: 'SALE',
                reason: 'Test sale'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    it('should search products by name', async () => {
        const response = await request(app)
            .get('/api/v1/products/search')
            .query({ search: 'Test Product 1' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0].name).toBe('Test Product 1');
    });

    it('should return no products for a non-matching search', async () => {
        const response = await request(app)
            .get('/api/v1/products/search')
            .query({ search: 'Non-existing Product' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.length).toBe(0);
    });
});
