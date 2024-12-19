const jwt = require('jsonwebtoken');
const { prisma } = require('../server');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('./asyncHandler');

/**
 * Protect routes - Verify token and authenticate user
 */
exports.protect = asyncHandler(async (req, res, next) => {
    let token;

    // Get token from headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // Get token from cookies
    else if (req.cookies?.token) {
        token = req.cookies.token;
    }

    // Check if token exists
    if (!token) {
        throw ErrorResponse.unauthorized('Not authorized to access this route');
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                department: true,
                warehouseId: true,
                isActive: true
            }
        });

        if (!user) {
            throw ErrorResponse.unauthorized('User no longer exists');
        }

        if (!user.isActive) {
            throw ErrorResponse.unauthorized('User account is deactivated');
        }

        // Add user to request object
        req.user = user;
        next();
    } catch (error) {
        throw ErrorResponse.unauthorized('Not authorized to access this route');
    }
});

/**
 * Grant access to specific roles
 */
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            throw ErrorResponse.forbidden(
                `User role ${req.user.role} is not authorized to access this route`
            );
        }
        next();
    };
};

/**
 * Check if user has access to specific warehouse
 */
exports.checkWarehouseAccess = asyncHandler(async (req, res, next) => {
    // Skip for admin users
    if (req.user.role === 'ADMIN') {
        return next();
    }

    const warehouseId = req.params.warehouseId || req.body.warehouseId;

    if (!warehouseId) {
        return next();
    }

    // Check if user is assigned to the warehouse
    if (req.user.warehouseId !== warehouseId) {
        throw ErrorResponse.forbidden('Not authorized to access this warehouse');
    }

    next();
});

/**
 * Check if user has access to specific department
 */
exports.checkDepartmentAccess = (...departments) => {
    return (req, res, next) => {
        if (!departments.includes(req.user.department)) {
            throw ErrorResponse.forbidden(
                `User from ${req.user.department} department is not authorized to access this route`
            );
        }
        next();
    };
};
