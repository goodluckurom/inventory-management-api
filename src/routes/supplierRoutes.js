const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const {
    getSuppliers,
    getSupplier,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    getSupplierPerformance
} = require('../controllers/supplierController');
const { protect, authorize, checkDepartmentAccess } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

// Validation rules
const supplierValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Supplier name is required')
        .isLength({ max: 100 })
        .withMessage('Name cannot exceed 100 characters'),
    body('code')
        .trim()
        .notEmpty()
        .withMessage('Supplier code is required')
        .matches(/^[A-Za-z0-9-_]+$/)
        .withMessage('Code can only contain letters, numbers, hyphens, and underscores'),
    body('type')
        .isIn(['MANUFACTURER', 'WHOLESALER', 'DISTRIBUTOR', 'IMPORTER'])
        .withMessage('Invalid supplier type'),
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('phone')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required')
        .matches(/^\+?[\d\s-()]+$/)
        .withMessage('Please provide a valid phone number'),
    body('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING'])
        .withMessage('Invalid status'),
    body('taxId')
        .optional()
        .trim(),
    body('paymentTerms')
        .optional()
        .trim(),
    body('creditLimit')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Credit limit must be a positive number'),
    body('website')
        .optional()
        .trim()
        .isURL()
        .withMessage('Please provide a valid URL'),
    
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
    
    // Documents validation
    body('documents')
        .optional()
        .isArray()
        .withMessage('Documents must be an array'),
    body('documents.*.type')
        .optional()
        .isIn(['INVOICE', 'RECEIPT', 'CERTIFICATE', 'SPECIFICATION', 'MANUAL', 'CONTRACT', 'REPORT'])
        .withMessage('Invalid document type'),
    body('documents.*.url')
        .optional()
        .isURL()
        .withMessage('Please provide a valid document URL'),
    body('documents.*.name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Document name is required'),
    
    // Notes validation
    body('notes')
        .optional()
        .isArray()
        .withMessage('Notes must be an array'),
    body('notes.*')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Note content cannot be empty')
];

const supplierQueryValidation = [
    query('search').optional().trim(),
    query('type')
        .optional()
        .isIn(['MANUFACTURER', 'WHOLESALER', 'DISTRIBUTOR', 'IMPORTER'])
        .withMessage('Invalid supplier type'),
    query('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING'])
        .withMessage('Invalid status'),
    query('sortBy')
        .optional()
        .isIn(['name', 'code', 'type', 'createdAt', 'rating'])
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
        supplierQueryValidation,
        validateRequest,
        getSuppliers
    )
    .post(
        protect,
        authorize('ADMIN', 'MANAGER'),
        checkDepartmentAccess('PURCHASING', 'INVENTORY'),
        supplierValidation,
        validateRequest,
        createSupplier
    );

router
    .route('/:id')
    .get(
        protect,
        getSupplier
    )
    .put(
        protect,
        authorize('ADMIN', 'MANAGER'),
        checkDepartmentAccess('PURCHASING', 'INVENTORY'),
        supplierValidation,
        validateRequest,
        updateSupplier
    )
    .delete(
        protect,
        authorize('ADMIN'),
        checkDepartmentAccess('PURCHASING'),
        deleteSupplier
    );

router.get(
    '/:id/performance',
    protect,
    authorize('ADMIN', 'MANAGER'),
    checkDepartmentAccess('PURCHASING', 'INVENTORY'),
    getSupplierPerformance
);

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Supplier service is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
