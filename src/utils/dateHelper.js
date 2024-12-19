/**
 * Date and Time Helper Utility
 */
class DateHelper {
    /**
     * Get current date and time in ISO format
     * @returns {string} Current date and time
     */
    static getCurrentDateTime() {
        return new Date().toISOString();
    }

    /**
     * Format date to specific format
     * @param {Date|string} date - Date to format
     * @param {string} format - Format type ('short', 'long', 'iso', 'relative')
     * @returns {string} Formatted date
     */
    static formatDate(date, format = 'short') {
        const dateObj = new Date(date);

        switch (format) {
            case 'short':
                return dateObj.toLocaleDateString();
            case 'long':
                return dateObj.toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            case 'iso':
                return dateObj.toISOString();
            case 'relative':
                return this.getRelativeTimeString(dateObj);
            default:
                return dateObj.toLocaleDateString();
        }
    }

    /**
     * Get relative time string (e.g., "2 hours ago")
     * @param {Date|string} date - Date to compare
     * @returns {string} Relative time string
     */
    static getRelativeTimeString(date) {
        const now = new Date();
        const past = new Date(date);
        const diffInSeconds = Math.floor((now - past) / 1000);

        if (diffInSeconds < 60) {
            return 'just now';
        }

        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };

        for (const [unit, seconds] of Object.entries(intervals)) {
            const interval = Math.floor(diffInSeconds / seconds);
            if (interval >= 1) {
                return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
            }
        }
    }

    /**
     * Add time to date
     * @param {Date|string} date - Base date
     * @param {number} amount - Amount to add
     * @param {string} unit - Time unit ('minutes', 'hours', 'days', 'weeks', 'months', 'years')
     * @returns {Date} New date
     */
    static addTime(date, amount, unit) {
        const dateObj = new Date(date);

        switch (unit) {
            case 'minutes':
                return new Date(dateObj.getTime() + amount * 60000);
            case 'hours':
                return new Date(dateObj.getTime() + amount * 3600000);
            case 'days':
                return new Date(dateObj.getTime() + amount * 86400000);
            case 'weeks':
                return new Date(dateObj.getTime() + amount * 604800000);
            case 'months':
                return new Date(dateObj.setMonth(dateObj.getMonth() + amount));
            case 'years':
                return new Date(dateObj.setFullYear(dateObj.getFullYear() + amount));
            default:
                throw new Error('Invalid time unit');
        }
    }

    /**
     * Subtract time from date
     * @param {Date|string} date - Base date
     * @param {number} amount - Amount to subtract
     * @param {string} unit - Time unit ('minutes', 'hours', 'days', 'weeks', 'months', 'years')
     * @returns {Date} New date
     */
    static subtractTime(date, amount, unit) {
        return this.addTime(date, -amount, unit);
    }

    /**
     * Get start of period
     * @param {Date|string} date - Base date
     * @param {string} period - Period type ('day', 'week', 'month', 'year')
     * @returns {Date} Start of period
     */
    static getStartOfPeriod(date, period) {
        const dateObj = new Date(date);

        switch (period) {
            case 'day':
                return new Date(dateObj.setHours(0, 0, 0, 0));
            case 'week':
                const day = dateObj.getDay();
                return new Date(dateObj.setDate(dateObj.getDate() - day));
            case 'month':
                return new Date(dateObj.setDate(1));
            case 'year':
                return new Date(dateObj.setMonth(0, 1));
            default:
                throw new Error('Invalid period type');
        }
    }

    /**
     * Get end of period
     * @param {Date|string} date - Base date
     * @param {string} period - Period type ('day', 'week', 'month', 'year')
     * @returns {Date} End of period
     */
    static getEndOfPeriod(date, period) {
        const dateObj = new Date(date);

        switch (period) {
            case 'day':
                return new Date(dateObj.setHours(23, 59, 59, 999));
            case 'week':
                const day = dateObj.getDay();
                return new Date(dateObj.setDate(dateObj.getDate() + (6 - day)));
            case 'month':
                return new Date(dateObj.setMonth(dateObj.getMonth() + 1, 0));
            case 'year':
                return new Date(dateObj.setMonth(11, 31));
            default:
                throw new Error('Invalid period type');
        }
    }

    /**
     * Check if date is within range
     * @param {Date|string} date - Date to check
     * @param {Date|string} startDate - Start of range
     * @param {Date|string} endDate - End of range
     * @returns {boolean} Whether date is within range
     */
    static isWithinRange(date, startDate, endDate) {
        const dateObj = new Date(date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return dateObj >= start && dateObj <= end;
    }

    /**
     * Get difference between dates
     * @param {Date|string} date1 - First date
     * @param {Date|string} date2 - Second date
     * @param {string} unit - Unit to return difference in ('seconds', 'minutes', 'hours', 'days')
     * @returns {number} Difference between dates
     */
    static getDifference(date1, date2, unit = 'days') {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffMs = Math.abs(d2 - d1);

        switch (unit) {
            case 'seconds':
                return Math.floor(diffMs / 1000);
            case 'minutes':
                return Math.floor(diffMs / 60000);
            case 'hours':
                return Math.floor(diffMs / 3600000);
            case 'days':
                return Math.floor(diffMs / 86400000);
            default:
                throw new Error('Invalid unit');
        }
    }

    /**
     * Check if date is valid
     * @param {Date|string} date - Date to validate
     * @returns {boolean} Whether date is valid
     */
    static isValidDate(date) {
        const dateObj = new Date(date);
        return dateObj instanceof Date && !isNaN(dateObj);
    }

    /**
     * Get business days between dates (excluding weekends)
     * @param {Date|string} startDate - Start date
     * @param {Date|string} endDate - End date
     * @returns {number} Number of business days
     */
    static getBusinessDays(startDate, endDate) {
        let count = 0;
        let current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            const dayOfWeek = current.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                count++;
            }
            current = this.addTime(current, 1, 'days');
        }

        return count;
    }
}

module.exports = DateHelper;
