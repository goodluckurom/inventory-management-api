const EventEmitter = require('events');
const logger = require('./logger');
const config = require('./config');

/**
 * Simple in-memory queue implementation
 */
class InMemoryQueue extends EventEmitter {
    constructor(name, options = {}) {
        super();
        this.name = name;
        this.options = options;
        this.jobs = [];
        this.processing = false;
    }

    async add(data, options = {}) {
        const job = {
            id: Date.now().toString(),
            data,
            options,
            attempts: 0,
            status: 'waiting',
            timestamp: new Date()
        };
        this.jobs.push(job);
        this.emit('added', job);
        this.process();
        return job;
    }

    async process(handler) {
        if (handler) {
            this.handler = handler;
        }
        if (this.processing || !this.handler) return;

        this.processing = true;
        while (this.jobs.length > 0) {
            const job = this.jobs[0];
            try {
                job.status = 'processing';
                this.emit('processing', job);
                await this.handler(job);
                job.status = 'completed';
                this.emit('completed', job);
            } catch (error) {
                job.attempts++;
                if (job.attempts < (job.options.attempts || 3)) {
                    job.status = 'waiting';
                    // Move to end of queue
                    this.jobs.push(this.jobs.shift());
                    continue;
                }
                job.status = 'failed';
                job.error = error;
                this.emit('failed', job, error);
            }
            this.jobs.shift();
        }
        this.processing = false;
    }

    async getJob(jobId) {
        return this.jobs.find(job => job.id === jobId);
    }

    async clean(grace, status) {
        const before = new Date(Date.now() - grace);
        this.jobs = this.jobs.filter(job => {
            if (status && job.status !== status) return true;
            return job.timestamp > before;
        });
    }
}

/**
 * Queue Manager
 */
class QueueManager {
    constructor() {
        this.queues = new Map();
        this.handlers = new Map();
        this.useRedis = false;
        this.Bull = null;

        // Try to load Bull if Redis is configured
        try {
            if (process.env.REDIS_URL) {
                this.Bull = require('bull');
                this.useRedis = true;
                logger.info('Using Redis-based queue system');
            }
        } catch (error) {
            logger.info('Using in-memory queue system');
        }
    }

    /**
     * Get or create queue
     * @param {string} name - Queue name
     * @param {Object} options - Queue options
     * @returns {Object} Queue instance
     */
    getQueue(name, options = {}) {
        if (!this.queues.has(name)) {
            if (this.useRedis && this.Bull) {
                const queue = new this.Bull(name, {
                    redis: process.env.REDIS_URL,
                    ...options
                });
                this._setupBullListeners(queue);
                this.queues.set(name, queue);
            } else {
                const queue = new InMemoryQueue(name, options);
                this._setupInMemoryListeners(queue);
                this.queues.set(name, queue);
            }
        }
        return this.queues.get(name);
    }

    /**
     * Add job to queue
     * @param {string} queueName - Queue name
     * @param {Object} data - Job data
     * @param {Object} options - Job options
     * @returns {Promise<Object>} Job instance
     */
    async addJob(queueName, data, options = {}) {
        const queue = this.getQueue(queueName);
        return await queue.add(data, options);
    }

    /**
     * Process queue
     * @param {string} queueName - Queue name
     * @param {Function} handler - Job handler
     */
    process(queueName, handler) {
        const queue = this.getQueue(queueName);
        this.handlers.set(queueName, handler);
        
        if (this.useRedis) {
            queue.process(async (job) => {
                try {
                    return await handler(job.data);
                } catch (error) {
                    logger.error(`Error processing job in queue ${queueName}:`, error);
                    throw error;
                }
            });
        } else {
            queue.process(async (job) => {
                try {
                    return await handler(job.data);
                } catch (error) {
                    logger.error(`Error processing job in queue ${queueName}:`, error);
                    throw error;
                }
            });
        }
    }

    /**
     * Setup Bull queue listeners
     * @param {Object} queue - Bull queue instance
     * @private
     */
    _setupBullListeners(queue) {
        queue.on('error', error => {
            logger.error(`Queue ${queue.name} error:`, error);
        });

        queue.on('waiting', jobId => {
            logger.debug(`Job ${jobId} waiting in queue ${queue.name}`);
        });

        queue.on('active', job => {
            logger.debug(`Job ${job.id} started in queue ${queue.name}`);
        });

        queue.on('completed', job => {
            logger.debug(`Job ${job.id} completed in queue ${queue.name}`);
        });

        queue.on('failed', (job, error) => {
            logger.error(`Job ${job.id} failed in queue ${queue.name}:`, error);
        });

        queue.on('stalled', job => {
            logger.warn(`Job ${job.id} stalled in queue ${queue.name}`);
        });
    }

    /**
     * Setup in-memory queue listeners
     * @param {Object} queue - In-memory queue instance
     * @private
     */
    _setupInMemoryListeners(queue) {
        queue.on('added', job => {
            logger.debug(`Job ${job.id} added to queue ${queue.name}`);
        });

        queue.on('processing', job => {
            logger.debug(`Job ${job.id} started in queue ${queue.name}`);
        });

        queue.on('completed', job => {
            logger.debug(`Job ${job.id} completed in queue ${queue.name}`);
        });

        queue.on('failed', (job, error) => {
            logger.error(`Job ${job.id} failed in queue ${queue.name}:`, error);
        });
    }

    /**
     * Clean old jobs from queue
     * @param {string} queueName - Queue name
     * @param {number} grace - Grace period in milliseconds
     * @param {string} status - Job status to clean
     */
    async clean(queueName, grace = 24 * 3600 * 1000, status = 'completed') {
        const queue = this.getQueue(queueName);
        await queue.clean(grace, status);
    }

    /**
     * Get queue status
     * @param {string} queueName - Queue name
     * @returns {Promise<Object>} Queue status
     */
    async getStatus(queueName) {
        const queue = this.getQueue(queueName);
        
        if (this.useRedis) {
            const [waiting, active, completed, failed] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
                queue.getCompletedCount(),
                queue.getFailedCount()
            ]);
            
            return { waiting, active, completed, failed };
        } else {
            const jobs = queue.jobs;
            return {
                waiting: jobs.filter(job => job.status === 'waiting').length,
                active: jobs.filter(job => job.status === 'processing').length,
                completed: jobs.filter(job => job.status === 'completed').length,
                failed: jobs.filter(job => job.status === 'failed').length
            };
        }
    }
}

// Export singleton instance
module.exports = new QueueManager();
