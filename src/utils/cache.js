const NodeCache = require('node-cache');
const logger = require('./logger');

// Cache TTL configurations (in seconds)
const TTL = {
    SHORT: 300,      // 5 minutes
    MEDIUM: 1800,    // 30 minutes
    LONG: 3600,      // 1 hour
    VERY_LONG: 86400 // 24 hours
};

// Initialize cache with default settings
const cache = new NodeCache({
    stdTTL: TTL.MEDIUM,
    checkperiod: 120,
    useClones: false
});

/**
 * Cache wrapper class
 */
class CacheService {
    constructor() {
        this.cache = cache;
        this.stats = {
            hits: 0,
            misses: 0
        };

        // Setup cache event listeners
        this.setupEventListeners();
    }

    /**
     * Setup cache event listeners
     */
    setupEventListeners() {
        this.cache.on('set', (key, value) => {
            logger.debug(`Cache set: ${key}`);
        });

        this.cache.on('del', (key) => {
            logger.debug(`Cache delete: ${key}`);
        });

        this.cache.on('expired', (key) => {
            logger.debug(`Cache expired: ${key}`);
        });

        this.cache.on('flush', () => {
            logger.debug('Cache flushed');
        });
    }

    /**
     * Generate cache key
     * @param {string} prefix - Key prefix
     * @param {Object} params - Parameters to include in key
     * @returns {string} Cache key
     */
    generateKey(prefix, params = {}) {
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((acc, key) => {
                acc[key] = params[key];
                return acc;
            }, {});

        return `${prefix}:${JSON.stringify(sortedParams)}`;
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {any} Cached value or undefined
     */
    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            this.stats.hits++;
            logger.debug(`Cache hit: ${key}`);
        } else {
            this.stats.misses++;
            logger.debug(`Cache miss: ${key}`);
        }
        return value;
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in seconds
     * @returns {boolean} Success status
     */
    set(key, value, ttl = TTL.MEDIUM) {
        try {
            return this.cache.set(key, value, ttl);
        } catch (error) {
            logger.error(`Error setting cache key ${key}:`, error);
            return false;
        }
    }

    /**
     * Delete value from cache
     * @param {string} key - Cache key
     * @returns {number} Number of deleted entries
     */
    delete(key) {
        return this.cache.del(key);
    }

    /**
     * Clear all cache entries
     * @returns {void}
     */
    flush() {
        this.cache.flushAll();
        this.stats.hits = 0;
        this.stats.misses = 0;
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const cacheStats = this.cache.getStats();
        return {
            ...cacheStats,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: this.stats.hits + this.stats.misses === 0 ? 0 :
                (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        };
    }

    /**
     * Wrap async function with cache
     * @param {string} key - Cache key
     * @param {Function} fn - Function to cache
     * @param {number} ttl - Time to live in seconds
     * @returns {Promise<any>} Function result
     */
    async wrap(key, fn, ttl = TTL.MEDIUM) {
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }

        const result = await fn();
        this.set(key, result, ttl);
        return result;
    }

    /**
     * Set multiple values in cache
     * @param {Object} keyValuePairs - Object with key-value pairs
     * @param {number} ttl - Time to live in seconds
     * @returns {boolean} Success status
     */
    mset(keyValuePairs, ttl = TTL.MEDIUM) {
        try {
            const pairs = Object.entries(keyValuePairs).map(([key, value]) => ({
                key,
                val: value,
                ttl
            }));
            return this.cache.mset(pairs);
        } catch (error) {
            logger.error('Error setting multiple cache keys:', error);
            return false;
        }
    }

    /**
     * Get multiple values from cache
     * @param {string[]} keys - Array of cache keys
     * @returns {Object} Object with key-value pairs
     */
    mget(keys) {
        return this.cache.mget(keys);
    }

    /**
     * Delete multiple values from cache
     * @param {string[]} keys - Array of cache keys
     * @returns {number} Number of deleted entries
     */
    mdelete(keys) {
        return this.cache.del(keys);
    }

    /**
     * Check if key exists in cache
     * @param {string} key - Cache key
     * @returns {boolean} True if key exists
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     * Get cache keys
     * @param {string} pattern - Pattern to match keys
     * @returns {string[]} Array of matching keys
     */
    keys(pattern = '') {
        const allKeys = this.cache.keys();
        if (!pattern) {
            return allKeys;
        }
        const regex = new RegExp(pattern);
        return allKeys.filter(key => regex.test(key));
    }

    /**
     * Get TTL for key
     * @param {string} key - Cache key
     * @returns {number} TTL in seconds or -1 if key doesn't exist
     */
    getTtl(key) {
        return this.cache.getTtl(key);
    }

    /**
     * Set new TTL for key
     * @param {string} key - Cache key
     * @param {number} ttl - New TTL in seconds
     * @returns {boolean} Success status
     */
    setTtl(key, ttl) {
        return this.cache.ttl(key, ttl);
    }
}

// Export singleton instance
module.exports = {
    cacheService: new CacheService(),
    TTL
};
