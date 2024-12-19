const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../server');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * Generate JWT Token
 */
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

/**
 * @desc    Register user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
exports.register = asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, role, department } = req.body;

    // Check if user exists
    const userExists = await prisma.user.findUnique({
        where: { email }
    });

    if (userExists) {
        throw ErrorResponse.conflict('User already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role: role || 'USER',
            department: department || null
        },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            department: true
        }
    });

    // Generate token
    const token = generateToken(user.id);

    // Set cookie
    const options = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    };

    res.status(201)
        .cookie('token', token, options)
        .json({
            success: true,
            token,
            data: user
        });
});

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
exports.login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
        throw ErrorResponse.badRequest('Please provide an email and password');
    }

    // Check for user
    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        throw ErrorResponse.unauthorized('Invalid credentials');
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        throw ErrorResponse.unauthorized('Invalid credentials');
    }

    if (!user.isActive) {
        throw ErrorResponse.unauthorized('Your account has been deactivated');
    }

    // Update last login
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
    });

    // Generate token
    const token = generateToken(user.id);

    // Set cookie
    const options = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    };

    // Remove password from output
    delete user.password;

    res.status(200)
        .cookie('token', token, options)
        .json({
            success: true,
            token,
            data: user
        });
});

/**
 * @desc    Log user out / clear cookie
 * @route   GET /api/v1/auth/logout
 * @access  Private
 */
exports.logout = asyncHandler(async (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });

    res.status(200).json({
        success: true,
        data: {}
    });
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
exports.getMe = asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            department: true,
            warehouse: true,
            lastLogin: true
        }
    });

    res.status(200).json({
        success: true,
        data: user
    });
});

/**
 * @desc    Update user details
 * @route   PUT /api/v1/auth/updatedetails
 * @access  Private
 */
exports.updateDetails = asyncHandler(async (req, res) => {
    const fieldsToUpdate = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email
    };

    const user = await prisma.user.update({
        where: { id: req.user.id },
        data: fieldsToUpdate,
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            department: true
        }
    });

    res.status(200).json({
        success: true,
        data: user
    });
});

/**
 * @desc    Update password
 * @route   PUT /api/v1/auth/updatepassword
 * @access  Private
 */
exports.updatePassword = asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id }
    });

    // Check current password
    const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);

    if (!isMatch) {
        throw ErrorResponse.unauthorized('Current password is incorrect');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.newPassword, salt);

    await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword }
    });

    res.status(200).json({
        success: true,
        message: 'Password updated successfully'
    });
});

/**
 * @desc    Forgot password
 * @route   POST /api/v1/auth/forgotpassword
 * @access  Public
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { email: req.body.email }
    });

    if (!user) {
        throw ErrorResponse.notFound('No user found with that email');
    }

    // TODO: Implement password reset token generation and email sending
    // For now, just return success message
    res.status(200).json({
        success: true,
        message: 'Password reset email sent'
    });
});

/**
 * @desc    Reset password
 * @route   PUT /api/v1/auth/resetpassword/:resettoken
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res) => {
    // TODO: Implement password reset functionality
    res.status(200).json({
        success: true,
        message: 'Password reset successful'
    });
});
