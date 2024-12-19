const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const {
    getWarehouses,
    getWarehouse,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    getWarehouseInventory
} = require('../controllers/warehouseController');
const { protect, authorize, checkDepartmentAccess } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

// Validation rules
const warehouseValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Warehouse name is required')
        .isLength({ max: 100 })
        .withMessage('Name cannot exceed 100 characters'),
    body('code')
        .trim()
        .notEmpty()
        .withMessage('Warehouse code is required')
        .matches(/^[A-Za-z0-9-_]+$/)
        .withMessage('Code can only contain letters, numbers, hyphens, and underscores'),
    body('type')
        .isIn(['MAIN', 'SATELLITE', 'THIRD_PARTY', 'TRANSIT'])
        .withMessage('Invalid warehouse type'),
    body('capacity')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Capacity must be a positive integer'),

    // Address validation
    body('address.street')
        .trim()
        .notEmpty()
        .withMessage('Street address is required'),
    body('address.city')
        .trim()
        .notEmpty()
        .withMessage('City is required'),
    body('address.state')
        .trim()
        .notEmpty()
        .withMessage('State is required'),
    body('address.country')
        .trim()
        .notEmpty()
        .withMessage('Country is required'),
    body('address.postalCode')
        .trim()
        .notEmpty()
        .withMessage('Postal code is required'),

    // Zones validation
    body('zones')
        .optional()
        .isArray()
        .withMessage('Zones must be an array'),
    body('zones.*.name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Zone name is required'),
    body('zones.*.code')
        .optional()
        .trim()
        .matches(/^[A-Za-z0-9-_]+$/)
        .withMessage('Zone code can only contain letters, numbers, hyphens, and underscores'),
    body('zones.*.description')
        .optional()
        .trim(),
    body('zones.*.capacity')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Zone capacity must be a positive integer'),

    // Staff validation
    body('staff')
        .optional()
        .isArray()
        .withMessage('Staff must be an array'),
    body('staff.*')
        .optional()
        .isUUID()
        .withMessage('Invalid staff ID format')
];

const warehouseQueryValidation = [
    query('search').optional().trim(),
    query('type')
        .optional()
        .isIn(['MAIN', 'SATELLITE', 'THIRD_PARTY', 'TRANSIT'])
        .withMessage('Invalid warehouse type'),
    query('sortBy')
        .optional()
        .isIn(['name', 'code', 'type', 'createdAt', 'capacity'])
        .withMessage('Invalid sort field'),
    query('order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Invalid sort order'),
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Invalid page number'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Invalid limit')
];

// Routes
router
    .route('/')
    .get(
        protect,
        warehouseQueryValidation,
        validateRequest,
        getWarehouses
    )
    .post(
        protect,
        authorize('ADMIN', 'MANAGER'),
        checkDepartmentAccess('WAREHOUSE', 'INVENTORY'),
        warehouseValidation,
        validateRequest,
        createWarehouse
    );

router
    .route('/:id')
    .get(
        protect,
        getWarehouse
    )
    .put(
        protect,
        authorize('ADMIN', 'MANAGER'),
        checkDepartmentAccess('WAREHOUSE', 'INVENTORY'),
        warehouseValidation,
        validateRequest,
        updateWarehouse
    )
    .delete(
        protect,
        authorize('ADMIN'),
        checkDepartmentAccess('WAREHOUSE'),
        deleteWarehouse
    );

router.get(
    '/:id/inventory',
    protect,
    authorize('ADMIN', 'MANAGER', 'WAREHOUSE_STAFF'),
    checkDepartmentAccess('WAREHOUSE', 'INVENTORY'),
    getWarehouseInventory
);

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Warehouse service is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
