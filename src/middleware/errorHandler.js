const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error for debugging
    console.error(err);

    // Prisma Error Handling
    if (err.code) {
        switch (err.code) {
            // Unique constraint violation
            case 'P2002':
                error = new ErrorResponse(`Duplicate field value entered: ${err.meta?.target}`, 400);
                break;
            // Record not found
            case 'P2001':
            case 'P2018':
                error = new ErrorResponse('Resource not found', 404);
                break;
            // Foreign key constraint violation
            case 'P2003':
                error = new ErrorResponse('Related resource not found', 404);
                break;
            // Invalid data type
            case 'P2005':
            case 'P2006':
                error = new ErrorResponse('Invalid input data', 400);
                break;
            // Required field missing
            case 'P2011':
                error = new ErrorResponse('Required field missing', 400);
                break;
            // Null constraint violation
            case 'P2012':
                error = new ErrorResponse('Required field cannot be null', 400);
                break;
            // Invalid database operation
            case 'P2015':
                error = new ErrorResponse('Invalid operation', 400);
                break;
        }
    }

    // JWT Error
    if (err.name === 'JsonWebTokenError') {
        error = new ErrorResponse('Invalid token', 401);
    }

    // JWT Expired Error
    if (err.name === 'TokenExpiredError') {
        error = new ErrorResponse('Token expired', 401);
    }

    // Validation Error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message);
        error = new ErrorResponse(message, 400);
    }

    // Rate limit error
    if (err.name === 'TooManyRequests') {
        error = new ErrorResponse('Too many requests, please try again later', 429);
    }

    // File upload error
    if (err.name === 'FileUploadError') {
        error = new ErrorResponse(err.message || 'Problem with file upload', 400);
    }

    // Default server error
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';

    // Send response
    res.status(statusCode).json({
        success: false,
        error: {
            message,
            code: error.code,
            ...(process.env.NODE_ENV === 'development' && { 
                stack: err.stack,
                details: err.meta 
            })
        },
        timestamp: new Date().toISOString(),
        path: req.originalUrl
    });
};

module.exports = errorHandler;
