const crypto = require('crypto');
const { prisma } = require('../server');
const logger = require('./logger');
const httpClient = require('./httpClient');
const config = require('./config');
const queueManager = require('./queueManager');
const { EventHelper } = require('./eventEmitter');

/**
 * Webhook Manager Utility
 */
class WebhookManager {
    constructor() {
        this.secret = config.get('webhook.secret') || 'your-webhook-secret';
        this.retryAttempts = config.get('webhook.retryAttempts') || 3;
        this.retryDelay = config.get('webhook.retryDelay') || 5000; // 5 seconds
        this.queue = queueManager.getQueue('webhooks');

        this._setupQueue();
    }

    /**
     * Setup webhook queue
     * @private
     */
    _setupQueue() {
        this.queue.process(async (job) => {
            try {
                await this._processWebhook(job.data);
            } catch (error) {
                logger.error('Error processing webhook:', error);
                throw error;
            }
        });
    }

    /**
     * Register webhook endpoint
     * @param {Object} options - Registration options
     * @returns {Promise<Object>} Created webhook
     */
    async registerWebhook({
        url,
        events,
        description,
        isActive = true,
        metadata = {}
    }) {
        try {
            const webhook = await prisma.webhook.create({
                data: {
                    url,
                    events,
                    description,
                    isActive,
                    metadata,
                    secret: crypto.randomBytes(32).toString('hex')
                }
            });

            logger.info('Webhook registered:', {
                id: webhook.id,
                url: webhook.url,
                events: webhook.events
            });

            return webhook;
        } catch (error) {
            logger.error('Error registering webhook:', error);
            throw error;
        }
    }

    /**
     * Update webhook
     * @param {string} id - Webhook ID
     * @param {Object} updates - Update data
     * @returns {Promise<Object>} Updated webhook
     */
    async updateWebhook(id, updates) {
        try {
            const webhook = await prisma.webhook.update({
                where: { id },
                data: updates
            });

            logger.info('Webhook updated:', {
                id: webhook.id,
                updates
            });

            return webhook;
        } catch (error) {
            logger.error('Error updating webhook:', error);
            throw error;
        }
    }

    /**
     * Delete webhook
     * @param {string} id - Webhook ID
     * @returns {Promise<Object>} Deleted webhook
     */
    async deleteWebhook(id) {
        try {
            const webhook = await prisma.webhook.delete({
                where: { id }
            });

            logger.info('Webhook deleted:', { id });

            return webhook;
        } catch (error) {
            logger.error('Error deleting webhook:', error);
            throw error;
        }
    }

    /**
     * Trigger webhook event
     * @param {string} event - Event name
     * @param {Object} payload - Event payload
     * @returns {Promise<void>}
     */
    async triggerEvent(event, payload) {
        try {
            const webhooks = await prisma.webhook.findMany({
                where: {
                    isActive: true,
                    events: {
                        has: event
                    }
                }
            });

            const deliveries = webhooks.map(webhook => ({
                webhookId: webhook.id,
                event,
                payload,
                attempt: 1
            }));

            // Add to queue
            await Promise.all(
                deliveries.map(delivery =>
                    this.queue.add(delivery, {
                        attempts: this.retryAttempts,
                        backoff: {
                            type: 'exponential',
                            delay: this.retryDelay
                        }
                    })
                )
            );

            logger.info('Webhook event triggered:', {
                event,
                webhookCount: webhooks.length
            });
        } catch (error) {
            logger.error('Error triggering webhook event:', error);
            throw error;
        }
    }

    /**
     * Process webhook delivery
     * @param {Object} delivery - Webhook delivery data
     * @returns {Promise<void>}
     * @private
     */
    async _processWebhook(delivery) {
        try {
            const webhook = await prisma.webhook.findUnique({
                where: { id: delivery.webhookId }
            });

            if (!webhook || !webhook.isActive) {
                logger.warn('Webhook not found or inactive:', {
                    webhookId: delivery.webhookId
                });
                return;
            }

            // Generate signature
            const signature = this._generateSignature(
                delivery.event,
                delivery.payload,
                webhook.secret
            );

            // Send webhook
            const response = await httpClient.post(webhook.url, {
                event: delivery.event,
                payload: delivery.payload,
                timestamp: new Date().toISOString(),
                signature
            });

            // Log delivery
            await this._logDelivery({
                webhookId: webhook.id,
                event: delivery.event,
                payload: delivery.payload,
                attempt: delivery.attempt,
                status: 'success',
                statusCode: response.status,
                response: response.data
            });

            logger.info('Webhook delivered successfully:', {
                webhookId: webhook.id,
                event: delivery.event
            });
        } catch (error) {
            // Log failed delivery
            await this._logDelivery({
                webhookId: delivery.webhookId,
                event: delivery.event,
                payload: delivery.payload,
                attempt: delivery.attempt,
                status: 'failed',
                statusCode: error.response?.status,
                error: error.message
            });

            logger.error('Webhook delivery failed:', {
                webhookId: delivery.webhookId,
                event: delivery.event,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Log webhook delivery
     * @param {Object} data - Delivery data
     * @returns {Promise<Object>} Created delivery log
     * @private
     */
    async _logDelivery(data) {
        try {
            return await prisma.webhookDelivery.create({
                data: {
                    webhookId: data.webhookId,
                    event: data.event,
                    payload: JSON.stringify(data.payload),
                    attempt: data.attempt,
                    status: data.status,
                    statusCode: data.statusCode,
                    response: data.response ? JSON.stringify(data.response) : null,
                    error: data.error
                }
            });
        } catch (error) {
            logger.error('Error logging webhook delivery:', error);
        }
    }

    /**
     * Generate webhook signature
     * @param {string} event - Event name
     * @param {Object} payload - Event payload
     * @param {string} secret - Webhook secret
     * @returns {string} Signature
     * @private
     */
    _generateSignature(event, payload, secret) {
        const data = JSON.stringify({ event, payload });
        return crypto
            .createHmac('sha256', secret)
            .update(data)
            .digest('hex');
    }

    /**
     * Verify webhook signature
     * @param {string} signature - Request signature
     * @param {string} event - Event name
     * @param {Object} payload - Event payload
     * @param {string} secret - Webhook secret
     * @returns {boolean} Whether signature is valid
     */
    verifySignature(signature, event, payload, secret) {
        const expectedSignature = this._generateSignature(event, payload, secret);
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }

    /**
     * Create webhook middleware
     * @param {Object} options - Middleware options
     * @returns {Function} Express middleware
     */
    createMiddleware(options = {}) {
        return async (req, res, next) => {
            const signature = req.headers['x-webhook-signature'];
            const event = req.headers['x-webhook-event'];

            if (!signature || !event) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing webhook signature or event'
                });
            }

            if (!this.verifySignature(signature, event, req.body, this.secret)) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid webhook signature'
                });
            }

            // Emit event
            EventHelper.emitSystemEvent(`webhook:${event}`, req.body);

            res.status(200).json({ success: true });
        };
    }
}

module.exports = new WebhookManager();
