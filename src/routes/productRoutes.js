const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getLowStockProducts,
    updateStock,
    searchProducts // Importing the searchProducts function
} = require('../controllers/productController');
const { protect, authorize, checkDepartmentAccess } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const userActivityTracker = require('../middleware/userActivityTracker');

// Validation rules
const productValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Product name is required')
        .isLength({ max: 100 })
        .withMessage('Name cannot exceed 100 characters'),
    body('sku')
        .trim()
        .notEmpty()
        .withMessage('SKU is required')
        .matches(/^[A-Za-z0-9-_]+$/)
        .withMessage('SKU can only contain letters, numbers, hyphens, and underscores'),
    body('description')
        .trim()
        .notEmpty()
        .withMessage('Description is required'),
    body('categoryId')
        .notEmpty()
        .withMessage('Category is required')
        .isUUID()
        .withMessage('Invalid category ID'),
    body('brandId')
        .notEmpty()
        .withMessage('Brand is required')
        .isUUID()
        .withMessage('Invalid brand ID'),
    body('quantity')
        .isInt({ min: 0 })
        .withMessage('Quantity must be a non-negative integer'),
    body('unit')
        .isIn(['PIECES', 'KG', 'GRAMS', 'LITERS', 'METERS', 'BOXES', 'PALLETS'])
        .withMessage('Invalid unit'),
    body('reorderPoint')
        .isInt({ min: 0 })
        .withMessage('Reorder point must be a non-negative integer'),
    body('price')
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    body('costPrice')
        .isFloat({ min: 0 })
        .withMessage('Cost price must be a positive number'),
    body('warehouseId')
        .notEmpty()
        .withMessage('Warehouse is required')
        .isUUID()
        .withMessage('Invalid warehouse ID'),
    body('location')
        .trim()
        .notEmpty()
        .withMessage('Storage location is required'),
    body('suppliers')
        .isArray()
        .withMessage('Suppliers must be an array')
        .notEmpty()
        .withMessage('At least one supplier is required'),
    body('suppliers.*.id')
        .isUUID()
        .withMessage('Invalid supplier ID'),
    body('suppliers.*.price')
        .isFloat({ min: 0 })
        .withMessage('Supplier price must be a positive number'),
    body('suppliers.*.leadTime')
        .isInt({ min: 0 })
        .withMessage('Lead time must be a non-negative integer'),
    body('suppliers.*.minimumOrder')
        .isInt({ min: 0 })
        .withMessage('Minimum order must be a non-negative integer')
];

const stockUpdateValidation = [
    body('quantity')
        .isInt()
        .withMessage('Quantity must be an integer'),
    body('type')
        .isIn(['PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE', 'LOSS'])
        .withMessage('Invalid movement type'),
    body('reason')
        .trim()
        .notEmpty()
        .withMessage('Reason is required')
];

const productQueryValidation = [
    query('search').optional().trim(),
    query('category').optional().isUUID().withMessage('Invalid category ID'),
    query('supplier').optional().isUUID().withMessage('Invalid supplier ID'),
    query('minPrice').optional().isFloat({ min: 0 }).withMessage('Invalid minimum price'),
    query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Invalid maximum price'),
    query('inStock').optional().isBoolean().withMessage('Invalid stock status'),
    query('isActive').optional().isBoolean().withMessage('Invalid active status'),
    query('sortBy').optional().isIn([
        'name', 'price', 'quantity', 'createdAt', 'updatedAt'
    ]).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Invalid sort order'),
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page number'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit')
];

// Routes
router
    .route('/')
    .get(
        protect,
        productQueryValidation,
        validateRequest,
        getProducts
    )
    .post(
        protect,
        authorize('ADMIN', 'MANAGER', 'WAREHOUSE_STAFF'),
        checkDepartmentAccess('INVENTORY', 'WAREHOUSE'),
        productValidation,
        validateRequest,
        createProduct
    );

// Search Products Route
router
    .route('/search')
    .get(
        protect,
        authorize('ADMIN', 'MANAGER', 'WAREHOUSE_STAFF'),
        searchProducts
    );

router
    .route('/:id')
    .get(
        protect,
        getProduct
    )
    .put(
        protect,
        authorize('ADMIN', 'MANAGER', 'WAREHOUSE_STAFF'),
        checkDepartmentAccess('INVENTORY', 'WAREHOUSE'),
        productValidation,
        validateRequest,
        updateProduct
    )
    .delete(
        protect,
        authorize('ADMIN', 'MANAGER'),
        checkDepartmentAccess('INVENTORY'),
        deleteProduct
    );

router.get(
    '/low-stock',
    protect,
    authorize('ADMIN', 'MANAGER', 'WAREHOUSE_STAFF'),
    getLowStockProducts
);

router.post(
    '/:id/stock',
    protect,
    authorize('ADMIN', 'MANAGER', 'WAREHOUSE_STAFF'),
    checkDepartmentAccess('INVENTORY', 'WAREHOUSE'),
    stockUpdateValidation,
    validateRequest,
    updateStock
);

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Product service is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
