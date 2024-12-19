const { prisma } = require('../server');
const logger = require('./logger');
const cache = require('./cache');
const { EventHelper } = require('./eventEmitter');

/**
 * Feature Manager Utility
 */
class FeatureManager {
    constructor() {
        this.cache = cache;
        this.cacheTTL = 300; // 5 minutes
        this.cachePrefix = 'feature:';
        this.configPrefix = 'config:';

        // Default feature flags
        this.defaultFeatures = {
            // Core Features
            'api.rateLimit': true,
            'api.caching': true,
            'api.compression': true,
            'api.documentation': true,

            // Security Features
            'security.twoFactor': false,
            'security.ipWhitelist': false,
            'security.advancedEncryption': false,

            // Notification Features
            'notifications.email': true,
            'notifications.sms': false,
            'notifications.push': false,

            // Integration Features
            'integrations.webhook': true,
            'integrations.thirdParty': false,

            // Analytics Features
            'analytics.advanced': false,
            'analytics.reporting': true,
            'analytics.export': true,

            // Maintenance Features
            'maintenance.autoBackup': true,
            'maintenance.autoCleanup': true,
            'maintenance.monitoring': true
        };

        // Default configurations
        this.defaultConfigs = {
            // System Settings
            'system.timezone': 'UTC',
            'system.dateFormat': 'YYYY-MM-DD',
            'system.timeFormat': '24h',
            'system.language': 'en',

            // Business Settings
            'business.currency': 'USD',
            'business.taxRate': 0,
            'business.workingDays': '1,2,3,4,5',
            'business.workingHours': '09:00-17:00',

            // Notification Settings
            'notifications.frequency': 'instant',
            'notifications.batchSize': 100,
            'notifications.retryAttempts': 3,

            // Security Settings
            'security.passwordMinLength': 8,
            'security.sessionTimeout': 3600,
            'security.loginAttempts': 5,
            'security.lockoutDuration': 900,

            // Performance Settings
            'performance.cacheTimeout': 3600,
            'performance.queryTimeout': 30,
            'performance.maxPageSize': 100,
            'performance.minSearchChars': 3
        };
    }

    /**
     * Initialize feature manager
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            // Load features from database
            const features = await prisma.feature.findMany();
            const configs = await prisma.configuration.findMany();

            // Cache features and configs
            await this._cacheFeatures(features);
            await this._cacheConfigs(configs);

            logger.info('Feature manager initialized');
        } catch (error) {
            logger.error('Error initializing feature manager:', error);
            throw error;
        }
    }

    /**
     * Check if feature is enabled
     * @param {string} feature - Feature name
     * @param {Object} context - Context object (user, tenant, etc.)
     * @returns {Promise<boolean>} Whether feature is enabled
     */
    async isEnabled(feature, context = {}) {
        try {
            // Check cache first
            const cached = await this.cache.get(this.cachePrefix + feature);
            if (cached !== undefined) {
                return this._evaluateFeature(cached, context);
            }

            // Check database
            const featureData = await prisma.feature.findUnique({
                where: { name: feature }
            });

            if (!featureData) {
                // Return default if feature not found
                return this.defaultFeatures[feature] || false;
            }

            // Cache feature
            await this._cacheFeature(feature, featureData);

            return this._evaluateFeature(featureData, context);
        } catch (error) {
            logger.error(`Error checking feature '${feature}':`, error);
            return this.defaultFeatures[feature] || false;
        }
    }

    /**
     * Get configuration value
     * @param {string} key - Configuration key
     * @param {Object} context - Context object (user, tenant, etc.)
     * @returns {Promise<any>} Configuration value
     */
    async getConfig(key, context = {}) {
        try {
            // Check cache first
            const cached = await this.cache.get(this.configPrefix + key);
            if (cached !== undefined) {
                return this._evaluateConfig(cached, context);
            }

            // Check database
            const config = await prisma.configuration.findUnique({
                where: { key }
            });

            if (!config) {
                // Return default if config not found
                return this.defaultConfigs[key];
            }

            // Cache config
            await this._cacheConfig(key, config);

            return this._evaluateConfig(config, context);
        } catch (error) {
            logger.error(`Error getting config '${key}':`, error);
            return this.defaultConfigs[key];
        }
    }

    /**
     * Update feature
     * @param {string} feature - Feature name
     * @param {Object} data - Feature data
     * @returns {Promise<Object>} Updated feature
     */
    async updateFeature(feature, data) {
        try {
            const updated = await prisma.feature.upsert({
                where: { name: feature },
                update: data,
                create: {
                    name: feature,
                    ...data
                }
            });

            // Update cache
            await this._cacheFeature(feature, updated);

            // Emit event
            EventHelper.emitSystemEvent('feature:updated', {
                feature,
                data: updated
            });

            return updated;
        } catch (error) {
            logger.error(`Error updating feature '${feature}':`, error);
            throw error;
        }
    }

    /**
     * Update configuration
     * @param {string} key - Configuration key
     * @param {*} value - Configuration value
     * @returns {Promise<Object>} Updated configuration
     */
    async updateConfig(key, value) {
        try {
            const updated = await prisma.configuration.upsert({
                where: { key },
                update: { value },
                create: {
                    key,
                    value
                }
            });

            // Update cache
            await this._cacheConfig(key, updated);

            // Emit event
            EventHelper.emitSystemEvent('config:updated', {
                key,
                value: updated
            });

            return updated;
        } catch (error) {
            logger.error(`Error updating config '${key}':`, error);
            throw error;
        }
    }

    /**
     * Get all features
     * @returns {Promise<Object>} Features object
     */
    async getAllFeatures() {
        try {
            const features = await prisma.feature.findMany();
            return features.reduce((acc, feature) => {
                acc[feature.name] = feature;
                return acc;
            }, { ...this.defaultFeatures });
        } catch (error) {
            logger.error('Error getting all features:', error);
            return this.defaultFeatures;
        }
    }

    /**
     * Get all configurations
     * @returns {Promise<Object>} Configurations object
     */
    async getAllConfigs() {
        try {
            const configs = await prisma.configuration.findMany();
            return configs.reduce((acc, config) => {
                acc[config.key] = config.value;
                return acc;
            }, { ...this.defaultConfigs });
        } catch (error) {
            logger.error('Error getting all configs:', error);
            return this.defaultConfigs;
        }
    }

    /**
     * Cache feature
     * @param {string} feature - Feature name
     * @param {Object} data - Feature data
     * @returns {Promise<void>}
     * @private
     */
    async _cacheFeature(feature, data) {
        await this.cache.set(
            this.cachePrefix + feature,
            data,
            this.cacheTTL
        );
    }

    /**
     * Cache configuration
     * @param {string} key - Configuration key
     * @param {Object} data - Configuration data
     * @returns {Promise<void>}
     * @private
     */
    async _cacheConfig(key, data) {
        await this.cache.set(
            this.configPrefix + key,
            data,
            this.cacheTTL
        );
    }

    /**
     * Cache all features
     * @param {Array} features - Features array
     * @returns {Promise<void>}
     * @private
     */
    async _cacheFeatures(features) {
        await Promise.all(
            features.map(feature =>
                this._cacheFeature(feature.name, feature)
            )
        );
    }

    /**
     * Cache all configurations
     * @param {Array} configs - Configurations array
     * @returns {Promise<void>}
     * @private
     */
    async _cacheConfigs(configs) {
        await Promise.all(
            configs.map(config =>
                this._cacheConfig(config.key, config)
            )
        );
    }

    /**
     * Evaluate feature
     * @param {Object} feature - Feature data
     * @param {Object} context - Context object
     * @returns {boolean} Whether feature is enabled
     * @private
     */
    _evaluateFeature(feature, context) {
        if (!feature.enabled) return false;

        // Check conditions if any
        if (feature.conditions) {
            return this._evaluateConditions(feature.conditions, context);
        }

        return true;
    }

    /**
     * Evaluate configuration
     * @param {Object} config - Configuration data
     * @param {Object} context - Context object
     * @returns {*} Configuration value
     * @private
     */
    _evaluateConfig(config, context) {
        if (config.conditions) {
            const condition = this._evaluateConditions(config.conditions, context);
            return condition ? config.value : config.defaultValue;
        }

        return config.value;
    }

    /**
     * Evaluate conditions
     * @param {Object} conditions - Conditions object
     * @param {Object} context - Context object
     * @returns {boolean} Whether conditions are met
     * @private
     */
    _evaluateConditions(conditions, context) {
        // Simple condition evaluation
        // In a real implementation, this would be more sophisticated
        return Object.entries(conditions).every(([key, value]) => {
            return context[key] === value;
        });
    }
}

module.exports = new FeatureManager();
