const { validationResult } = require('express-validator');
const ErrorResponse = require('../utils/errorResponse');

/**
 * Middleware to validate request using express-validator
 * Throws an error if validation fails
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @throws {ErrorResponse} - Throws 400 error if validation fails
 */
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        // Format validation errors
        const formattedErrors = errors.array().map(error => ({
            field: error.param,
            message: error.msg,
            value: error.value
        }));

        // Group errors by field
        const groupedErrors = formattedErrors.reduce((acc, curr) => {
            if (!acc[curr.field]) {
                acc[curr.field] = [];
            }
            acc[curr.field].push(curr.message);
            return acc;
        }, {});

        throw new ErrorResponse('Validation Error', 400, 'VALIDATION_ERROR', {
            errors: groupedErrors
        });
    }

    next();
};

module.exports = validateRequest;
