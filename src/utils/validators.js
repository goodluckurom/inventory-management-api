const { body, param, query } = require('express-validator');
const { prisma } = require('../server');

/**
 * Common validation rules
 */
const commonValidators = {
    // UUID validation
    uuid: (field) => param(field)
        .isUUID()
        .withMessage('Invalid ID format'),

    // Pagination validation
    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        query('sortBy')
            .optional()
            .isString()
            .trim(),
        query('order')
            .optional()
            .isIn(['asc', 'desc'])
            .withMessage('Order must be either asc or desc')
    ],

    // Date range validation
    dateRange: [
        query('startDate')
            .optional()
            .isISO8601()
            .withMessage('Start date must be a valid ISO 8601 date'),
        query('endDate')
            .optional()
            .isISO8601()
            .withMessage('End date must be a valid ISO 8601 date')
            .custom((endDate, { req }) => {
                if (req.query.startDate && endDate) {
                    const start = new Date(req.query.startDate);
                    const end = new Date(endDate);
                    if (end < start) {
                        throw new Error('End date must be after start date');
                    }
                }
                return true;
            })
    ],

    // Email validation
    email: body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),

    // Password validation
    password: body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/\d/)
        .withMessage('Password must contain a number')
        .matches(/[A-Z]/)
        .withMessage('Password must contain an uppercase letter')
        .matches(/[a-z]/)
        .withMessage('Password must contain a lowercase letter')
        .matches(/[!@#$%^&*(),.?":{}|<>]/)
        .withMessage('Password must contain a special character'),

    // Phone number validation
    phone: body('phone')
        .trim()
        .matches(/^\+?[\d\s-()]+$/)
        .withMessage('Please provide a valid phone number'),

    // URL validation
    url: body('url')
        .optional()
        .trim()
        .isURL()
        .withMessage('Please provide a valid URL'),

    // Decimal validation
    decimal: (field, { min = 0, max = undefined } = {}) => 
        body(field)
            .isFloat({ min, max })
            .withMessage(`${field} must be a valid number${min !== undefined ? ` greater than ${min}` : ''}${max !== undefined ? ` and less than ${max}` : ''}`),

    // Integer validation
    integer: (field, { min = 0, max = undefined } = {}) =>
        body(field)
            .isInt({ min, max })
            .withMessage(`${field} must be a valid integer${min !== undefined ? ` greater than ${min}` : ''}${max !== undefined ? ` and less than ${max}` : ''}`)
};

/**
 * Custom validators
 */
const customValidators = {
    // Check if entity exists in database
    exists: (model, field = 'id') => async (value) => {
        const entity = await prisma[model].findUnique({
            where: { [field]: value }
        });
        if (!entity) {
            throw new Error(`${model} not found`);
        }
        return true;
    },

    // Check if entity is unique in database
    isUnique: (model, field, excludeId = null) => async (value, { req }) => {
        const where = { [field]: value };
        if (excludeId) {
            where.id = { not: req.params[excludeId] };
        }
        const entity = await prisma[model].findFirst({ where });
        if (entity) {
            throw new Error(`${field} already exists`);
        }
        return true;
    },

    // Validate array of UUIDs
    arrayOfUuids: (value) => {
        if (!Array.isArray(value)) {
            throw new Error('Must be an array');
        }
        if (!value.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
            throw new Error('All elements must be valid UUIDs');
        }
        return true;
    },

    // Validate JSON string
    isJSON: (value) => {
        try {
            JSON.parse(value);
            return true;
        } catch (error) {
            throw new Error('Must be a valid JSON string');
        }
    },

    // Validate date is in future
    isFutureDate: (value) => {
        const date = new Date(value);
        const now = new Date();
        if (date <= now) {
            throw new Error('Date must be in the future');
        }
        return true;
    },

    // Validate date is in past
    isPastDate: (value) => {
        const date = new Date(value);
        const now = new Date();
        if (date >= now) {
            throw new Error('Date must be in the past');
        }
        return true;
    }
};

/**
 * Validation chains for common entities
 */
const validationChains = {
    // Address validation
    address: [
        body('street')
            .trim()
            .notEmpty()
            .withMessage('Street address is required'),
        body('city')
            .trim()
            .notEmpty()
            .withMessage('City is required'),
        body('state')
            .trim()
            .notEmpty()
            .withMessage('State is required'),
        body('country')
            .trim()
            .notEmpty()
            .withMessage('Country is required'),
        body('postalCode')
            .trim()
            .notEmpty()
            .withMessage('Postal code is required')
    ],

    // Price validation
    price: [
        body('price')
            .isFloat({ min: 0 })
            .withMessage('Price must be a positive number'),
        body('currency')
            .optional()
            .isLength({ min: 3, max: 3 })
            .withMessage('Currency must be a 3-letter code')
    ],

    // Quantity validation
    quantity: [
        body('quantity')
            .isInt({ min: 0 })
            .withMessage('Quantity must be a non-negative integer'),
        body('unit')
            .optional()
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Unit is required when quantity is specified')
    ]
};

module.exports = {
    commonValidators,
    customValidators,
    validationChains
};
