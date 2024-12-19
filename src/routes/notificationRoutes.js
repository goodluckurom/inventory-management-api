const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const {
    getNotifications,
    markAsRead,
    markAllAsRead,
    createNotification,
    deleteNotification,
    getUnreadCount
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

// Validation rules
const createNotificationValidation = [
    body('type')
        .isIn([
            'LOW_STOCK',
            'STOCK_OUT',
            'PRICE_CHANGE',
            'NEW_SHIPMENT',
            'ORDER_STATUS',
            'QUALITY_ALERT',
            'SYSTEM'
        ])
        .withMessage('Invalid notification type'),
    body('message')
        .trim()
        .notEmpty()
        .withMessage('Message is required')
        .isLength({ max: 500 })
        .withMessage('Message cannot exceed 500 characters'),
    body('userIds')
        .isArray()
        .withMessage('User IDs must be an array')
        .notEmpty()
        .withMessage('At least one user ID is required'),
    body('userIds.*')
        .isUUID()
        .withMessage('Invalid user ID format'),
    body('sendEmail')
        .optional()
        .isBoolean()
        .withMessage('sendEmail must be a boolean')
];

const notificationQueryValidation = [
    query('read')
        .optional()
        .isBoolean()
        .withMessage('Invalid read status'),
    query('type')
        .optional()
        .isIn([
            'LOW_STOCK',
            'STOCK_OUT',
            'PRICE_CHANGE',
            'NEW_SHIPMENT',
            'ORDER_STATUS',
            'QUALITY_ALERT',
            'SYSTEM'
        ])
        .withMessage('Invalid notification type'),
    query('sortBy')
        .optional()
        .isIn(['createdAt', 'type'])
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
        notificationQueryValidation,
        validateRequest,
        getNotifications
    )
    .post(
        protect,
        authorize('ADMIN', 'MANAGER'),
        createNotificationValidation,
        validateRequest,
        createNotification
    );

router.put(
    '/:id/read',
    protect,
    markAsRead
);

router.put(
    '/read-all',
    protect,
    markAllAsRead
);

router.get(
    '/unread-count',
    protect,
    getUnreadCount
);

router.delete(
    '/:id',
    protect,
    authorize('ADMIN'),
    deleteNotification
);

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Notification service is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
