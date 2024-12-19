const crypto = require('crypto');
const xss = require('xss');
const logger = require('./logger');

/**
 * Security Utility Class
 */
class Security {
    /**
     * Sanitize user input to prevent XSS attacks
     * @param {string|Object} input - Input to sanitize
     * @returns {string|Object} Sanitized input
     */
    static sanitizeInput(input) {
        if (typeof input === 'string') {
            return xss(input.trim());
        }

        if (typeof input === 'object' && input !== null) {
            return Object.keys(input).reduce((acc, key) => {
                acc[key] = this.sanitizeInput(input[key]);
                return acc;
            }, Array.isArray(input) ? [] : {});
        }

        return input;
    }

    /**
     * Generate a secure random token
     * @param {number} length - Length of the token
     * @returns {string} Random token
     */
    static generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Hash a string using SHA-256
     * @param {string} data - Data to hash
     * @returns {string} Hashed string
     */
    static hashString(data) {
        return crypto
            .createHash('sha256')
            .update(data)
            .digest('hex');
    }

    /**
     * Generate a secure random password
     * @param {Object} options - Password generation options
     * @returns {string} Generated password
     */
    static generateSecurePassword({
        length = 12,
        includeUppercase = true,
        includeLowercase = true,
        includeNumbers = true,
        includeSymbols = true
    } = {}) {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

        let chars = '';
        if (includeUppercase) chars += uppercase;
        if (includeLowercase) chars += lowercase;
        if (includeNumbers) chars += numbers;
        if (includeSymbols) chars += symbols;

        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Ensure at least one character from each required set
        const requirements = [];
        if (includeUppercase) requirements.push(uppercase);
        if (includeLowercase) requirements.push(lowercase);
        if (includeNumbers) requirements.push(numbers);
        if (includeSymbols) requirements.push(symbols);

        requirements.forEach((set, index) => {
            password = password.slice(0, index) +
                set.charAt(Math.floor(Math.random() * set.length)) +
                password.slice(index + 1);
        });

        return password;
    }

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} Validation result
     */
    static validatePasswordStrength(password) {
        const result = {
            isValid: false,
            score: 0,
            errors: []
        };

        // Length check
        if (password.length < 8) {
            result.errors.push('Password must be at least 8 characters long');
        } else {
            result.score += 2;
        }

        // Uppercase check
        if (!/[A-Z]/.test(password)) {
            result.errors.push('Password must contain at least one uppercase letter');
        } else {
            result.score += 2;
        }

        // Lowercase check
        if (!/[a-z]/.test(password)) {
            result.errors.push('Password must contain at least one lowercase letter');
        } else {
            result.score += 2;
        }

        // Number check
        if (!/\d/.test(password)) {
            result.errors.push('Password must contain at least one number');
        } else {
            result.score += 2;
        }

        // Special character check
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            result.errors.push('Password must contain at least one special character');
        } else {
            result.score += 2;
        }

        result.isValid = result.errors.length === 0;
        return result;
    }

    /**
     * Sanitize file name to prevent path traversal
     * @param {string} filename - File name to sanitize
     * @returns {string} Sanitized file name
     */
    static sanitizeFilename(filename) {
        return filename
            .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace invalid chars with underscore
            .replace(/\.{2,}/g, '.') // Replace multiple dots with single dot
            .toLowerCase();
    }

    /**
     * Validate and sanitize URL
     * @param {string} url - URL to validate and sanitize
     * @returns {string|null} Sanitized URL or null if invalid
     */
    static sanitizeUrl(url) {
        try {
            const parsed = new URL(url);
            // Only allow http and https protocols
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return null;
            }
            return parsed.toString();
        } catch {
            return null;
        }
    }

    /**
     * Mask sensitive data in logs
     * @param {Object} data - Data to mask
     * @param {string[]} fieldsToMask - Fields to mask
     * @returns {Object} Masked data
     */
    static maskSensitiveData(data, fieldsToMask = ['password', 'token', 'secret', 'credit_card']) {
        const masked = { ...data };
        fieldsToMask.forEach(field => {
            if (masked[field]) {
                masked[field] = '********';
            }
        });
        return masked;
    }

    /**
     * Generate a CSRF token
     * @param {string} sessionId - Session ID to bind the token to
     * @returns {string} CSRF token
     */
    static generateCsrfToken(sessionId) {
        const timestamp = Date.now().toString();
        return this.hashString(`${sessionId}${timestamp}${process.env.JWT_SECRET}`);
    }

    /**
     * Validate CSRF token
     * @param {string} token - Token to validate
     * @param {string} sessionId - Session ID to validate against
     * @returns {boolean} Validation result
     */
    static validateCsrfToken(token, sessionId) {
        // In a real implementation, you would store tokens and validate against stored ones
        // This is a simplified example
        return typeof token === 'string' && token.length === 64;
    }

    /**
     * Log security event
     * @param {string} event - Event description
     * @param {Object} details - Event details
     */
    static logSecurityEvent(event, details) {
        logger.warn({
            type: 'security_event',
            event,
            details: this.maskSensitiveData(details),
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = Security;
