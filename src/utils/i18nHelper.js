const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const cache = require('./cache');
const config = require('./config');

/**
 * Internationalization Helper Utility
 */
class I18nHelper {
    constructor() {
        this.translations = new Map();
        this.defaultLocale = config.get('i18n.defaultLocale') || 'en';
        this.fallbackLocale = config.get('i18n.fallbackLocale') || 'en';
        this.supportedLocales = config.get('i18n.supportedLocales') || ['en'];
        this.translationsDir = path.join(process.cwd(), 'locales');
        this.cache = cache;
        this.cacheTTL = 3600; // 1 hour
        this.cachePrefix = 'i18n:';

        // Initialize translations
        this.initialize();
    }

    /**
     * Initialize translations
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            // Ensure translations directory exists
            await fs.mkdir(this.translationsDir, { recursive: true });

            // Load all translation files
            for (const locale of this.supportedLocales) {
                await this.loadTranslations(locale);
            }

            logger.info('Translations initialized');
        } catch (error) {
            logger.error('Error initializing translations:', error);
            throw error;
        }
    }

    /**
     * Load translations for a locale
     * @param {string} locale - Locale code
     * @returns {Promise<void>}
     */
    async loadTranslations(locale) {
        try {
            // Check cache first
            const cached = await this.cache.get(this.cachePrefix + locale);
            if (cached) {
                this.translations.set(locale, cached);
                return;
            }

            // Load from file
            const filePath = path.join(this.translationsDir, `${locale}.json`);
            const content = await fs.readFile(filePath, 'utf8');
            const translations = JSON.parse(content);

            // Store in memory and cache
            this.translations.set(locale, translations);
            await this.cache.set(
                this.cachePrefix + locale,
                translations,
                this.cacheTTL
            );
        } catch (error) {
            logger.error(`Error loading translations for locale '${locale}':`, error);
            throw error;
        }
    }

    /**
     * Translate a key
     * @param {string} key - Translation key
     * @param {Object} params - Parameters for interpolation
     * @param {string} locale - Locale code
     * @returns {string} Translated text
     */
    translate(key, params = {}, locale = this.defaultLocale) {
        try {
            // Get translations for locale
            const translations = this.translations.get(locale) ||
                               this.translations.get(this.fallbackLocale);

            if (!translations) {
                logger.warn(`No translations found for locale '${locale}'`);
                return key;
            }

            // Get translation
            let translation = this._getNestedValue(translations, key);

            // Fallback to default locale if translation not found
            if (!translation && locale !== this.fallbackLocale) {
                const fallbackTranslations = this.translations.get(this.fallbackLocale);
                translation = fallbackTranslations ? 
                    this._getNestedValue(fallbackTranslations, key) : 
                    key;
            }

            // Return key if no translation found
            if (!translation) {
                logger.warn(`Translation not found for key '${key}'`);
                return key;
            }

            // Interpolate parameters
            return this._interpolate(translation, params);
        } catch (error) {
            logger.error(`Error translating key '${key}':`, error);
            return key;
        }
    }

    /**
     * Add translations
     * @param {string} locale - Locale code
     * @param {Object} translations - Translations object
     * @returns {Promise<void>}
     */
    async addTranslations(locale, translations) {
        try {
            // Merge with existing translations
            const existing = this.translations.get(locale) || {};
            const merged = this._deepMerge(existing, translations);

            // Update in memory
            this.translations.set(locale, merged);

            // Update cache
            await this.cache.set(
                this.cachePrefix + locale,
                merged,
                this.cacheTTL
            );

            // Save to file
            const filePath = path.join(this.translationsDir, `${locale}.json`);
            await fs.writeFile(filePath, JSON.stringify(merged, null, 2));

            logger.info(`Translations added for locale '${locale}'`);
        } catch (error) {
            logger.error(`Error adding translations for locale '${locale}':`, error);
            throw error;
        }
    }

    /**
     * Format date according to locale
     * @param {Date|string} date - Date to format
     * @param {Object} options - Format options
     * @param {string} locale - Locale code
     * @returns {string} Formatted date
     */
    formatDate(date, options = {}, locale = this.defaultLocale) {
        try {
            const dateObj = new Date(date);
            return new Intl.DateTimeFormat(locale, options).format(dateObj);
        } catch (error) {
            logger.error('Error formatting date:', error);
            return date.toString();
        }
    }

    /**
     * Format number according to locale
     * @param {number} number - Number to format
     * @param {Object} options - Format options
     * @param {string} locale - Locale code
     * @returns {string} Formatted number
     */
    formatNumber(number, options = {}, locale = this.defaultLocale) {
        try {
            return new Intl.NumberFormat(locale, options).format(number);
        } catch (error) {
            logger.error('Error formatting number:', error);
            return number.toString();
        }
    }

    /**
     * Format currency according to locale
     * @param {number} amount - Amount to format
     * @param {string} currency - Currency code
     * @param {string} locale - Locale code
     * @returns {string} Formatted currency
     */
    formatCurrency(amount, currency = 'USD', locale = this.defaultLocale) {
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency
            }).format(amount);
        } catch (error) {
            logger.error('Error formatting currency:', error);
            return amount.toString();
        }
    }

    /**
     * Get nested value from object using dot notation
     * @param {Object} obj - Object to search
     * @param {string} path - Path to value
     * @returns {*} Found value or undefined
     * @private
     */
    _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => 
            current && current[key], obj);
    }

    /**
     * Interpolate parameters into string
     * @param {string} text - Text to interpolate
     * @param {Object} params - Parameters
     * @returns {string} Interpolated text
     * @private
     */
    _interpolate(text, params) {
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return params.hasOwnProperty(key) ? params[key] : match;
        });
    }

    /**
     * Deep merge objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     * @private
     */
    _deepMerge(target, source) {
        const output = { ...target };
        
        Object.keys(source).forEach(key => {
            if (source[key] instanceof Object) {
                if (key in target) {
                    output[key] = this._deepMerge(target[key], source[key]);
                } else {
                    output[key] = { ...source[key] };
                }
            } else {
                output[key] = source[key];
            }
        });

        return output;
    }

    /**
     * Get supported locales
     * @returns {Array} Supported locales
     */
    getSupportedLocales() {
        return this.supportedLocales;
    }

    /**
     * Check if locale is supported
     * @param {string} locale - Locale code
     * @returns {boolean} Whether locale is supported
     */
    isSupported(locale) {
        return this.supportedLocales.includes(locale);
    }

    /**
     * Get current locale
     * @returns {string} Current locale
     */
    getCurrentLocale() {
        return this.defaultLocale;
    }

    /**
     * Set current locale
     * @param {string} locale - Locale code
     */
    setCurrentLocale(locale) {
        if (this.isSupported(locale)) {
            this.defaultLocale = locale;
        } else {
            logger.warn(`Locale '${locale}' is not supported`);
        }
    }

    /**
     * Get translation completion status
     * @returns {Object} Completion status
     */
    getCompletionStatus() {
        const status = {};
        const baseTranslations = this.translations.get(this.fallbackLocale) || {};
        const baseKeys = this._getAllKeys(baseTranslations);

        this.supportedLocales.forEach(locale => {
            const translations = this.translations.get(locale) || {};
            const keys = this._getAllKeys(translations);
            const missing = baseKeys.filter(key => 
                !this._getNestedValue(translations, key)
            );

            status[locale] = {
                total: baseKeys.length,
                translated: keys.length,
                missing: missing.length,
                completion: Math.round((keys.length / baseKeys.length) * 100)
            };
        });

        return status;
    }

    /**
     * Get all keys from object (including nested)
     * @param {Object} obj - Object to get keys from
     * @param {string} prefix - Key prefix
     * @returns {Array} Array of keys
     * @private
     */
    _getAllKeys(obj, prefix = '') {
        return Object.entries(obj).reduce((keys, [key, value]) => {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (value instanceof Object && !Array.isArray(value)) {
                return [...keys, ...this._getAllKeys(value, newKey)];
            }
            return [...keys, newKey];
        }, []);
    }
}

module.exports = new I18nHelper();
