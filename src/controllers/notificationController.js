const { prisma } = require('../server');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/asyncHandler');
const { sendEmail } = require('../utils/emailService');

/**
 * @desc    Get all notifications for a user
 * @route   GET /api/v1/notifications
 * @access  Private
 */
exports.getNotifications = asyncHandler(async (req, res) => {
    const {
        read,
        type,
        sortBy = 'createdAt',
        order = 'desc',
        page = 1,
        limit = 20
    } = req.query;

    // Build filter conditions
    const where = {
        AND: [
            { users: { some: { userId: req.user.id } } },
            // Filter by read status
            read !== undefined ? {
                users: { some: { userId: req.user.id, isRead: read === 'true' } }
            } : {},
            // Filter by type
            type ? { type } : {}
        ]
    };

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination
    const total = await prisma.notification.count({ where });

    // Get notifications
    const notifications = await prisma.notification.findMany({
        where,
        include: {
            users: {
                where: { userId: req.user.id },
                select: {
                    isRead: true,
                    readAt: true
                }
            }
        },
        orderBy: {
            [sortBy]: order.toLowerCase()
        },
        skip,
        take: parseInt(limit)
    });

    // Calculate pagination details
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasMore = page < totalPages;

    res.status(200).json({
        success: true,
        count: notifications.length,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages,
            hasMore
        },
        data: notifications
    });
});

/**
 * @desc    Mark notification as read
 * @route   PUT /api/v1/notifications/:id/read
 * @access  Private
 */
exports.markAsRead = asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findUnique({
        where: { id: req.params.id },
        include: {
            users: {
                where: { userId: req.user.id }
            }
        }
    });

    if (!notification) {
        throw new ErrorResponse('Notification not found', 404);
    }

    if (notification.users.length === 0) {
        throw new ErrorResponse('Notification not assigned to user', 404);
    }

    await prisma.userNotification.update({
        where: {
            notificationId_userId: {
                notificationId: req.params.id,
                userId: req.user.id
            }
        },
        data: {
            isRead: true,
            readAt: new Date()
        }
    });

    res.status(200).json({
        success: true,
        data: {}
    });
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/v1/notifications/read-all
 * @access  Private
 */
exports.markAllAsRead = asyncHandler(async (req, res) => {
    await prisma.userNotification.updateMany({
        where: {
            userId: req.user.id,
            isRead: false
        },
        data: {
            isRead: true,
            readAt: new Date()
        }
    });

    res.status(200).json({
        success: true,
        data: {}
    });
});

/**
 * @desc    Create notification
 * @route   POST /api/v1/notifications
 * @access  Private/Admin
 */
exports.createNotification = asyncHandler(async (req, res) => {
    const { type, message, userIds, sendEmail: shouldSendEmail } = req.body;

    // Create notification
    const notification = await prisma.notification.create({
        data: {
            type,
            message,
            users: {
                create: userIds.map(userId => ({
                    user: { connect: { id: userId } }
                }))
            }
        },
        include: {
            users: {
                include: {
                    user: {
                        select: {
                            email: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            }
        }
    });

    // Send email notifications if requested
    if (shouldSendEmail) {
        const emailPromises = notification.users.map(userNotification => {
            const { email, firstName, lastName } = userNotification.user;
            return sendEmail({
                email,
                subject: `New Notification: ${type}`,
                template: 'notification',
                data: {
                    firstName,
                    lastName,
                    message,
                    type,
                    date: new Date().toLocaleDateString()
                }
            });
        });

        await Promise.all(emailPromises);
    }

    res.status(201).json({
        success: true,
        data: notification
    });
});

/**
 * @desc    Delete notification
 * @route   DELETE /api/v1/notifications/:id
 * @access  Private/Admin
 */
exports.deleteNotification = asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findUnique({
        where: { id: req.params.id }
    });

    if (!notification) {
        throw new ErrorResponse('Notification not found', 404);
    }

    await prisma.notification.delete({
        where: { id: req.params.id }
    });

    res.status(200).json({
        success: true,
        data: {}
    });
});

/**
 * @desc    Get unread notifications count
 * @route   GET /api/v1/notifications/unread-count
 * @access  Private
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
    const count = await prisma.userNotification.count({
        where: {
            userId: req.user.id,
            isRead: false
        }
    });

    res.status(200).json({
        success: true,
        data: { count }
    });
});

/**
 * Create system notification helper function
 * @param {Object} params - Notification parameters
 * @returns {Promise<Object>} Created notification
 */
exports.createSystemNotification = async ({
    type,
    message,
    userIds,
    sendEmail: shouldSendEmail = false
}) => {
    try {
        const notification = await prisma.notification.create({
            data: {
                type,
                message,
                users: {
                    create: userIds.map(userId => ({
                        user: { connect: { id: userId } }
                    }))
                }
            },
            include: {
                users: {
                    include: {
                        user: {
                            select: {
                                email: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                }
            }
        });

        if (shouldSendEmail) {
            const emailPromises = notification.users.map(userNotification => {
                const { email, firstName, lastName } = userNotification.user;
                return sendEmail({
                    email,
                    subject: `New Notification: ${type}`,
                    template: 'notification',
                    data: {
                        firstName,
                        lastName,
                        message,
                        type,
                        date: new Date().toLocaleDateString()
                    }
                });
            });

            await Promise.all(emailPromises);
        }

        return notification;
    } catch (error) {
        console.error('Error creating system notification:', error);
        throw error;
    }
};
