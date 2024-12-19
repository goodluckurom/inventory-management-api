require('dotenv').config();
const path = require('path');

/**
 * Configuration Manager
 * Centralizes all configuration settings and provides validation
 */
class Config {
    constructor() {
        this.config = {
            // Server Configuration
            server: {
                port: this.getNumber('PORT', 3000),
                env: this.getString('NODE_ENV', 'development'),
                apiPrefix: this.getString('API_PREFIX', '/api/v1'),
                corsOrigin: this.getString('CORS_ORIGIN', '*'),
                corsMethods: this.getString('CORS_METHODS', 'GET,HEAD,PUT,PATCH,POST,DELETE'),
                corsCredentials: this.getBoolean('CORS_CREDENTIALS', true)
            },

            // Database Configuration
            database: {
                url: this.getRequired('DATABASE_URL'),
                maxConnections: this.getNumber('DB_MAX_CONNECTIONS', 10),
                ssl: this.getBoolean('DB_SSL', false)
            },

            // Authentication Configuration
            auth: {
                jwtSecret: this.getRequired('JWT_SECRET'),
                jwtExpire: this.getString('JWT_EXPIRE', '24h'),
                jwtCookieExpire: this.getNumber('JWT_COOKIE_EXPIRE', 24),
                saltRounds: this.getNumber('SALT_ROUNDS', 10)
            },

            // Email Configuration
            email: {
                host: this.getString('SMTP_HOST', ''),
                port: this.getNumber('SMTP_PORT', 587),
                user: this.getString('SMTP_USER', ''),
                pass: this.getString('SMTP_PASS', ''),
                fromEmail: this.getString('SMTP_FROM_EMAIL', 'noreply@example.com'),
                fromName: this.getString('SMTP_FROM_NAME', 'Inventory System')
            },

            // File Upload Configuration
            upload: {
                maxSize: this.getNumber('MAX_FILE_UPLOAD', 10485760), // 10MB
                path: this.getString('FILE_UPLOAD_PATH', './public/uploads'),
                allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
            },

            // Logging Configuration
            logging: {
                level: this.getString('LOG_LEVEL', 'info'),
                file: this.getString('LOG_FILE_PATH', './logs/app.log')
            },

            // Rate Limiting Configuration
            rateLimit: {
                windowMs: this.getNumber('RATE_LIMIT_WINDOW', 15) * 60 * 1000, // 15 minutes
                max: this.getNumber('RATE_LIMIT_MAX_REQUESTS', 100)
            },

            // Cache Configuration
            cache: {
                ttl: this.getNumber('CACHE_TTL', 3600), // 1 hour
                checkPeriod: this.getNumber('CACHE_CHECK_PERIOD', 120)
            },

            // Security Configuration
            security: {
                bcryptRounds: this.getNumber('BCRYPT_ROUNDS', 10),
                maxLoginAttempts: this.getNumber('MAX_LOGIN_ATTEMPTS', 5),
                lockoutTime: this.getNumber('LOCKOUT_TIME', 15) // minutes
            },

            // Notification Configuration
            notification: {
                enabled: this.getBoolean('NOTIFICATIONS_ENABLED', true),
                emailEnabled: this.getBoolean('EMAIL_NOTIFICATIONS_ENABLED', true)
            },

            // Business Logic Configuration
            business: {
                lowStockThreshold: this.getNumber('LOW_STOCK_THRESHOLD', 10),
                defaultCurrency: this.getString('DEFAULT_CURRENCY', 'USD'),
                orderPrefix: this.getString('ORDER_PREFIX', 'ORD'),
                taxRate: this.getNumber('TAX_RATE', 0)
            }
        };

        // Validate configuration
        this.validate();
    }

    /**
     * Get required environment variable
     * @param {string} key - Environment variable key
     * @returns {string} Environment variable value
     * @throws {Error} If environment variable is not set
     */
    getRequired(key) {
        const value = process.env[key];
        if (!value) {
            throw new Error(`Required environment variable ${key} is not set`);
        }
        return value;
    }

    /**
     * Get string environment variable with default
     * @param {string} key - Environment variable key
     * @param {string} defaultValue - Default value
     * @returns {string} Environment variable value or default
     */
    getString(key, defaultValue) {
        return process.env[key] || defaultValue;
    }

    /**
     * Get number environment variable with default
     * @param {string} key - Environment variable key
     * @param {number} defaultValue - Default value
     * @returns {number} Environment variable value or default
     */
    getNumber(key, defaultValue) {
        const value = process.env[key];
        return value ? parseInt(value, 10) : defaultValue;
    }

    /**
     * Get boolean environment variable with default
     * @param {string} key - Environment variable key
     * @param {boolean} defaultValue - Default value
     * @returns {boolean} Environment variable value or default
     */
    getBoolean(key, defaultValue) {
        const value = process.env[key];
        if (value === undefined) return defaultValue;
        return value.toLowerCase() === 'true';
    }

    /**
     * Validate configuration
     * @throws {Error} If configuration is invalid
     */
    validate() {
        // Validate database URL format
        if (!/^postgresql:\/\/.+/.test(this.config.database.url)) {
            throw new Error('Invalid database URL format');
        }

        // Validate JWT secret length
        if (this.config.auth.jwtSecret.length < 32) {
            throw new Error('JWT secret must be at least 32 characters long');
        }

        // Validate upload path
        if (!path.isAbsolute(this.config.upload.path)) {
            this.config.upload.path = path.resolve(process.cwd(), this.config.upload.path);
        }

        // Validate rate limit values
        if (this.config.rateLimit.windowMs < 0 || this.config.rateLimit.max < 1) {
            throw new Error('Invalid rate limit configuration');
        }

        // Validate cache TTL
        if (this.config.cache.ttl < 0) {
            throw new Error('Cache TTL must be non-negative');
        }
    }

    /**
     * Get configuration value
     * @param {string} key - Configuration key (dot notation)
     * @returns {any} Configuration value
     */
    get(key) {
        return key.split('.').reduce((obj, k) => obj && obj[k], this.config);
    }

    /**
     * Get all configuration
     * @returns {Object} Complete configuration object
     */
    getAll() {
        return this.config;
    }

    /**
     * Check if running in production
     * @returns {boolean} Whether running in production
     */
    isProduction() {
        return this.config.server.env === 'production';
    }

    /**
     * Check if running in development
     * @returns {boolean} Whether running in development
     */
    isDevelopment() {
        return this.config.server.env === 'development';
    }

    /**
     * Check if running in test
     * @returns {boolean} Whether running in test
     */
    isTest() {
        return this.config.server.env === 'test';
    }
}

// Export singleton instance
module.exports = new Config();
