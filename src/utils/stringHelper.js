/**
 * String Helper Utility
 */
class StringHelper {
    /**
     * Generate a slug from a string
     * @param {string} text - Text to convert to slug
     * @returns {string} Slugified text
     */
    static slugify(text) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')        // Replace spaces with -
            .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
            .replace(/\-\-+/g, '-')      // Replace multiple - with single -
            .replace(/^-+/, '')          // Trim - from start of text
            .replace(/-+$/, '');         // Trim - from end of text
    }

    /**
     * Truncate text to specified length
     * @param {string} text - Text to truncate
     * @param {number} length - Maximum length
     * @param {string} suffix - Suffix to add to truncated text
     * @returns {string} Truncated text
     */
    static truncate(text, length = 100, suffix = '...') {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length).trim() + suffix;
    }

    /**
     * Convert string to title case
     * @param {string} text - Text to convert
     * @returns {string} Title cased text
     */
    static toTitleCase(text) {
        return text
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Convert camelCase to sentence case
     * @param {string} text - Text to convert
     * @returns {string} Sentence cased text
     */
    static camelToSentence(text) {
        const result = text.replace(/([A-Z])/g, ' $1');
        return result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
    }

    /**
     * Generate random string
     * @param {number} length - Length of string
     * @param {string} charset - Characters to use
     * @returns {string} Random string
     */
    static generateRandomString(length = 10, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return result;
    }

    /**
     * Format number as currency
     * @param {number} amount - Amount to format
     * @param {string} currency - Currency code
     * @param {string} locale - Locale code
     * @returns {string} Formatted currency
     */
    static formatCurrency(amount, currency = 'USD', locale = 'en-US') {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    /**
     * Format number with commas
     * @param {number} number - Number to format
     * @returns {string} Formatted number
     */
    static formatNumber(number) {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * Extract initials from name
     * @param {string} name - Full name
     * @returns {string} Initials
     */
    static getInitials(name) {
        return name
            .split(' ')
            .map(part => part.charAt(0))
            .join('')
            .toUpperCase();
    }

    /**
     * Convert bytes to human readable size
     * @param {number} bytes - Bytes to convert
     * @returns {string} Human readable size
     */
    static formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }

    /**
     * Convert string to kebab case
     * @param {string} text - Text to convert
     * @returns {string} Kebab cased text
     */
    static toKebabCase(text) {
        return text
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/[\s_]+/g, '-')
            .toLowerCase();
    }

    /**
     * Convert string to snake case
     * @param {string} text - Text to convert
     * @returns {string} Snake cased text
     */
    static toSnakeCase(text) {
        return text
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .replace(/[\s-]+/g, '_')
            .toLowerCase();
    }

    /**
     * Convert string to camel case
     * @param {string} text - Text to convert
     * @returns {string} Camel cased text
     */
    static toCamelCase(text) {
        return text
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => 
                index === 0 ? letter.toLowerCase() : letter.toUpperCase()
            )
            .replace(/[\s-_]+/g, '');
    }

    /**
     * Strip HTML tags from string
     * @param {string} html - HTML string
     * @returns {string} Text without HTML tags
     */
    static stripHtml(html) {
        return html.replace(/<[^>]*>/g, '');
    }

    /**
     * Check if string contains only numbers
     * @param {string} text - Text to check
     * @returns {boolean} Whether string contains only numbers
     */
    static isNumeric(text) {
        return /^\d+$/.test(text);
    }

    /**
     * Mask string (e.g., for sensitive data)
     * @param {string} text - Text to mask
     * @param {number} visibleStart - Number of characters visible at start
     * @param {number} visibleEnd - Number of characters visible at end
     * @param {string} maskChar - Character to use for masking
     * @returns {string} Masked string
     */
    static maskString(text, visibleStart = 4, visibleEnd = 4, maskChar = '*') {
        if (!text) return '';
        const start = text.slice(0, visibleStart);
        const end = text.slice(-visibleEnd);
        const maskLength = Math.max(text.length - (visibleStart + visibleEnd), 0);
        const mask = maskChar.repeat(maskLength);
        return start + mask + end;
    }

    /**
     * Generate a reference number
     * @param {string} prefix - Prefix for reference number
     * @param {number} length - Length of number part
     * @returns {string} Reference number
     */
    static generateReference(prefix = 'REF', length = 8) {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 2 + length - 6);
        return `${prefix}${timestamp}${random}`.toUpperCase();
    }
}

module.exports = StringHelper;
