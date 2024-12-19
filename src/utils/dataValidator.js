const { body, param, query } = require('express-validator');
const { prisma } = require('../server');
const logger = require('./logger');
const StringHelper = require('./stringHelper');
const DateHelper = require('./dateHelper');

/**
 * Data Validator Utility
 */
class DataValidator {
    /**
     * Common validation rules
     */
    static rules = {
        // String validations
        string: {
            required: (field, options = {}) => 
                body(field)
                    .trim()
                    .notEmpty()
                    .withMessage(`${StringHelper.camelToSentence(field)} is required`)
                    .isLength({ 
                        min: options.min || 1, 
                        max: options.max || 255 
                    })
                    .withMessage(`${StringHelper.camelToSentence(field)} must be between ${options.min || 1} and ${options.max || 255} characters`),

            optional: (field, options = {}) =>
                body(field)
                    .optional()
                    .trim()
                    .isLength({ 
                        min: options.min || 1, 
                        max: options.max || 255 
                    })
                    .withMessage(`${StringHelper.camelToSentence(field)} must be between ${options.min || 1} and ${options.max || 255} characters`)
        },

        // Number validations
        number: {
            required: (field, options = {}) =>
                body(field)
                    .notEmpty()
                    .withMessage(`${StringHelper.camelToSentence(field)} is required`)
                    .isNumeric()
                    .withMessage(`${StringHelper.camelToSentence(field)} must be a number`)
                    .custom(value => {
                        if (options.min !== undefined && value < options.min) {
                            throw new Error(`${StringHelper.camelToSentence(field)} must be at least ${options.min}`);
                        }
                        if (options.max !== undefined && value > options.max) {
                            throw new Error(`${StringHelper.camelToSentence(field)} must be at most ${options.max}`);
                        }
                        return true;
                    }),

            optional: (field, options = {}) =>
                body(field)
                    .optional()
                    .isNumeric()
                    .withMessage(`${StringHelper.camelToSentence(field)} must be a number`)
                    .custom(value => {
                        if (options.min !== undefined && value < options.min) {
                            throw new Error(`${StringHelper.camelToSentence(field)} must be at least ${options.min}`);
                        }
                        if (options.max !== undefined && value > options.max) {
                            throw new Error(`${StringHelper.camelToSentence(field)} must be at most ${options.max}`);
                        }
                        return true;
                    })
        },

        // Date validations
        date: {
            required: (field) =>
                body(field)
                    .notEmpty()
                    .withMessage(`${StringHelper.camelToSentence(field)} is required`)
                    .isISO8601()
                    .withMessage(`${StringHelper.camelToSentence(field)} must be a valid date`),

            optional: (field) =>
                body(field)
                    .optional()
                    .isISO8601()
                    .withMessage(`${StringHelper.camelToSentence(field)} must be a valid date`)
        },

        // Email validations
        email: {
            required: () =>
                body('email')
                    .trim()
                    .notEmpty()
                    .withMessage('Email is required')
                    .isEmail()
                    .withMessage('Please provide a valid email')
                    .normalizeEmail(),

            optional: () =>
                body('email')
                    .optional()
                    .trim()
                    .isEmail()
                    .withMessage('Please provide a valid email')
                    .normalizeEmail()
        },

        // Boolean validations
        boolean: {
            required: (field) =>
                body(field)
                    .notEmpty()
                    .withMessage(`${StringHelper.camelToSentence(field)} is required`)
                    .isBoolean()
                    .withMessage(`${StringHelper.camelToSentence(field)} must be a boolean`),

            optional: (field) =>
                body(field)
                    .optional()
                    .isBoolean()
                    .withMessage(`${StringHelper.camelToSentence(field)} must be a boolean`)
        },

        // Array validations
        array: {
            required: (field, options = {}) =>
                body(field)
                    .isArray()
                    .withMessage(`${StringHelper.camelToSentence(field)} must be an array`)
                    .custom(value => {
                        if (options.min !== undefined && value.length < options.min) {
                            throw new Error(`${StringHelper.camelToSentence(field)} must contain at least ${options.min} items`);
                        }
                        if (options.max !== undefined && value.length > options.max) {
                            throw new Error(`${StringHelper.camelToSentence(field)} must contain at most ${options.max} items`);
                        }
                        return true;
                    }),

            optional: (field, options = {}) =>
                body(field)
                    .optional()
                    .isArray()
                    .withMessage(`${StringHelper.camelToSentence(field)} must be an array`)
                    .custom(value => {
                        if (options.min !== undefined && value.length < options.min) {
                            throw new Error(`${StringHelper.camelToSentence(field)} must contain at least ${options.min} items`);
                        }
                        if (options.max !== undefined && value.length > options.max) {
                            throw new Error(`${StringHelper.camelToSentence(field)} must contain at most ${options.max} items`);
                        }
                        return true;
                    })
        }
    };

    /**
     * Custom validators
     */
    static custom = {
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

        // Check if value is unique in database
        unique: (model, field, excludeId = null) => async (value, { req }) => {
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

        // Validate date range
        dateRange: (startField, endField) => async (value, { req }) => {
            const startDate = new Date(req.body[startField]);
            const endDate = new Date(req.body[endField]);
            if (endDate < startDate) {
                throw new Error('End date must be after start date');
            }
            return true;
        },

        // Validate password strength
        passwordStrength: () => (value) => {
            const minLength = 8;
            const hasUpperCase = /[A-Z]/.test(value);
            const hasLowerCase = /[a-z]/.test(value);
            const hasNumbers = /\d/.test(value);
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

            if (value.length < minLength) {
                throw new Error('Password must be at least 8 characters long');
            }
            if (!hasUpperCase) {
                throw new Error('Password must contain at least one uppercase letter');
            }
            if (!hasLowerCase) {
                throw new Error('Password must contain at least one lowercase letter');
            }
            if (!hasNumbers) {
                throw new Error('Password must contain at least one number');
            }
            if (!hasSpecialChar) {
                throw new Error('Password must contain at least one special character');
            }
            return true;
        }
    };

    /**
     * Common validation chains
     */
    static chains = {
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

        // ID parameter validation
        id: [
            param('id')
                .isUUID()
                .withMessage('Invalid ID format')
        ],

        // Search query validation
        search: [
            query('search')
                .optional()
                .trim()
                .isLength({ min: 2 })
                .withMessage('Search query must be at least 2 characters long')
        ]
    };

    /**
     * Validate request data
     * @param {Object} schema - Validation schema
     * @returns {Array} Validation middleware array
     */
    static validate(schema) {
        const validations = [];

        Object.entries(schema).forEach(([field, rules]) => {
            if (Array.isArray(rules)) {
                validations.push(...rules);
            } else if (typeof rules === 'function') {
                validations.push(rules);
            }
        });

        return validations;
    }
}

module.exports = DataValidator;
