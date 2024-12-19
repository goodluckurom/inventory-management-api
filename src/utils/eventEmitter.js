const EventEmitter = require('events');
const logger = require('./logger');

/**
 * Custom Event Emitter for application-wide events
 */
class AppEventEmitter extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(20); // Increase max listeners
        this._setupErrorHandling();
        this._setupLogging();
    }

    /**
     * Setup error handling for events
     * @private
     */
    _setupErrorHandling() {
        this.on('error', (error) => {
            logger.error('Event Error:', error);
        });
    }

    /**
     * Setup logging for events
     * @private
     */
    _setupLogging() {
        const originalEmit = this.emit;
        this.emit = function(type, ...args) {
            logger.debug({
                type: 'event_emitted',
                event: type,
                timestamp: new Date().toISOString(),
                args: args.map(arg => 
                    arg instanceof Error ? 
                        { message: arg.message, stack: arg.stack } : 
                        arg
                )
            });
            return originalEmit.apply(this, [type, ...args]);
        };
    }
}

// Create event emitter instance
const eventEmitter = new AppEventEmitter();

/**
 * Event Types
 */
const EventTypes = {
    // Inventory Events
    INVENTORY_LOW: 'inventory:low',
    INVENTORY_OUT: 'inventory:out',
    INVENTORY_UPDATED: 'inventory:updated',
    INVENTORY_MOVEMENT: 'inventory:movement',

    // Order Events
    ORDER_CREATED: 'order:created',
    ORDER_UPDATED: 'order:updated',
    ORDER_CANCELLED: 'order:cancelled',
    ORDER_COMPLETED: 'order:completed',
    ORDER_SHIPPED: 'order:shipped',

    // Product Events
    PRODUCT_CREATED: 'product:created',
    PRODUCT_UPDATED: 'product:updated',
    PRODUCT_DELETED: 'product:deleted',
    PRODUCT_PRICE_CHANGED: 'product:price_changed',

    // Supplier Events
    SUPPLIER_CREATED: 'supplier:created',
    SUPPLIER_UPDATED: 'supplier:updated',
    SUPPLIER_DELETED: 'supplier:deleted',

    // User Events
    USER_CREATED: 'user:created',
    USER_UPDATED: 'user:updated',
    USER_DELETED: 'user:deleted',
    USER_LOGIN: 'user:login',
    USER_LOGOUT: 'user:logout',

    // Notification Events
    NOTIFICATION_CREATED: 'notification:created',
    NOTIFICATION_READ: 'notification:read',

    // System Events
    SYSTEM_ERROR: 'system:error',
    SYSTEM_WARNING: 'system:warning',
    SYSTEM_MAINTENANCE: 'system:maintenance'
};

/**
 * Event Handlers
 */
const eventHandlers = {
    // Inventory Handlers
    [EventTypes.INVENTORY_LOW]: async ({ productId, quantity, threshold }) => {
        try {
            // Handle low inventory notification
            await require('../controllers/notificationController').createSystemNotification({
                type: 'LOW_STOCK',
                message: `Product ${productId} is running low (${quantity}/${threshold})`,
                userIds: [], // TODO: Get relevant user IDs
                sendEmail: true
            });
        } catch (error) {
            logger.error('Error handling low inventory event:', error);
        }
    },

    [EventTypes.INVENTORY_MOVEMENT]: async ({ productId, type, quantity, reason }) => {
        try {
            // Log inventory movement
            logger.info({
                type: 'inventory_movement',
                productId,
                movementType: type,
                quantity,
                reason,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error handling inventory movement event:', error);
        }
    },

    // Order Handlers
    [EventTypes.ORDER_CREATED]: async (order) => {
        try {
            // Handle order creation tasks
            await require('../controllers/notificationController').createSystemNotification({
                type: 'ORDER_STATUS',
                message: `New order created: ${order.orderNumber}`,
                userIds: [order.userId],
                sendEmail: true
            });
        } catch (error) {
            logger.error('Error handling order created event:', error);
        }
    },

    // System Event Handlers
    [EventTypes.SYSTEM_ERROR]: async (error) => {
        try {
            logger.error('System Error:', error);
            // Additional error handling logic
        } catch (err) {
            logger.error('Error handling system error event:', err);
        }
    }
};

// Register event handlers
Object.entries(eventHandlers).forEach(([event, handler]) => {
    eventEmitter.on(event, handler);
});

/**
 * Event Helper Functions
 */
const EventHelper = {
    /**
     * Emit inventory event
     * @param {string} type - Event type
     * @param {Object} data - Event data
     */
    emitInventoryEvent(type, data) {
        eventEmitter.emit(type, {
            ...data,
            timestamp: new Date().toISOString()
        });
    },

    /**
     * Emit order event
     * @param {string} type - Event type
     * @param {Object} order - Order data
     */
    emitOrderEvent(type, order) {
        eventEmitter.emit(type, {
            ...order,
            timestamp: new Date().toISOString()
        });
    },

    /**
     * Emit system event
     * @param {string} type - Event type
     * @param {Object} data - Event data
     */
    emitSystemEvent(type, data) {
        eventEmitter.emit(type, {
            ...data,
            timestamp: new Date().toISOString()
        });
    },

    /**
     * Register custom event handler
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     */
    registerHandler(event, handler) {
        eventEmitter.on(event, handler);
    },

    /**
     * Remove event handler
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     */
    removeHandler(event, handler) {
        eventEmitter.off(event, handler);
    },

    /**
     * Register one-time event handler
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     */
    registerOneTimeHandler(event, handler) {
        eventEmitter.once(event, handler);
    }
};

module.exports = {
    eventEmitter,
    EventTypes,
    EventHelper
};
