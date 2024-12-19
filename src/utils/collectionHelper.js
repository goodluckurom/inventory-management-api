/**
 * Collection Helper Utility for Array and Object Operations
 */
class CollectionHelper {
    /**
     * Group array of objects by key
     * @param {Array} array - Array to group
     * @param {string} key - Key to group by
     * @returns {Object} Grouped object
     */
    static groupBy(array, key) {
        return array.reduce((result, item) => {
            const groupKey = item[key];
            if (!result[groupKey]) {
                result[groupKey] = [];
            }
            result[groupKey].push(item);
            return result;
        }, {});
    }

    /**
     * Sort array of objects by key
     * @param {Array} array - Array to sort
     * @param {string} key - Key to sort by
     * @param {string} order - Sort order ('asc' or 'desc')
     * @returns {Array} Sorted array
     */
    static sortBy(array, key, order = 'asc') {
        return [...array].sort((a, b) => {
            if (a[key] < b[key]) return order === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    /**
     * Filter array of objects by multiple criteria
     * @param {Array} array - Array to filter
     * @param {Object} criteria - Filter criteria
     * @returns {Array} Filtered array
     */
    static filterBy(array, criteria) {
        return array.filter(item => {
            return Object.entries(criteria).every(([key, value]) => {
                if (value instanceof RegExp) {
                    return value.test(item[key]);
                }
                if (Array.isArray(value)) {
                    return value.includes(item[key]);
                }
                return item[key] === value;
            });
        });
    }

    /**
     * Sum array of numbers or specific key in array of objects
     * @param {Array} array - Array to sum
     * @param {string} key - Key to sum (optional)
     * @returns {number} Sum
     */
    static sum(array, key = null) {
        if (key) {
            return array.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
        }
        return array.reduce((sum, num) => sum + (Number(num) || 0), 0);
    }

    /**
     * Get unique values from array
     * @param {Array} array - Array to process
     * @param {string} key - Key for array of objects (optional)
     * @returns {Array} Array of unique values
     */
    static unique(array, key = null) {
        if (key) {
            return [...new Set(array.map(item => item[key]))];
        }
        return [...new Set(array)];
    }

    /**
     * Chunk array into smaller arrays
     * @param {Array} array - Array to chunk
     * @param {number} size - Chunk size
     * @returns {Array} Array of chunks
     */
    static chunk(array, size) {
        return array.reduce((chunks, item, index) => {
            const chunkIndex = Math.floor(index / size);
            if (!chunks[chunkIndex]) {
                chunks[chunkIndex] = [];
            }
            chunks[chunkIndex].push(item);
            return chunks;
        }, []);
    }

    /**
     * Deep clone object or array
     * @param {Object|Array} obj - Object or array to clone
     * @returns {Object|Array} Cloned object or array
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }

        return Object.keys(obj).reduce((clone, key) => {
            clone[key] = this.deepClone(obj[key]);
            return clone;
        }, {});
    }

    /**
     * Merge objects deeply
     * @param {...Object} objects - Objects to merge
     * @returns {Object} Merged object
     */
    static deepMerge(...objects) {
        return objects.reduce((result, obj) => {
            Object.keys(obj).forEach(key => {
                if (Array.isArray(result[key]) && Array.isArray(obj[key])) {
                    result[key] = [...result[key], ...obj[key]];
                } else if (this.isObject(result[key]) && this.isObject(obj[key])) {
                    result[key] = this.deepMerge(result[key], obj[key]);
                } else {
                    result[key] = obj[key];
                }
            });
            return result;
        }, {});
    }

    /**
     * Check if value is plain object
     * @param {*} value - Value to check
     * @returns {boolean} Whether value is plain object
     */
    static isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    /**
     * Pick specific keys from object
     * @param {Object} obj - Source object
     * @param {string[]} keys - Keys to pick
     * @returns {Object} New object with picked keys
     */
    static pick(obj, keys) {
        return keys.reduce((result, key) => {
            if (obj.hasOwnProperty(key)) {
                result[key] = obj[key];
            }
            return result;
        }, {});
    }

    /**
     * Omit specific keys from object
     * @param {Object} obj - Source object
     * @param {string[]} keys - Keys to omit
     * @returns {Object} New object without omitted keys
     */
    static omit(obj, keys) {
        return Object.keys(obj)
            .filter(key => !keys.includes(key))
            .reduce((result, key) => {
                result[key] = obj[key];
                return result;
            }, {});
    }

    /**
     * Flatten array by one level
     * @param {Array} array - Array to flatten
     * @returns {Array} Flattened array
     */
    static flatten(array) {
        return [].concat(...array);
    }

    /**
     * Deep flatten array
     * @param {Array} array - Array to flatten
     * @returns {Array} Flattened array
     */
    static deepFlatten(array) {
        return array.reduce((flat, item) => {
            return flat.concat(Array.isArray(item) ? this.deepFlatten(item) : item);
        }, []);
    }

    /**
     * Get nested object value safely
     * @param {Object} obj - Object to get value from
     * @param {string} path - Path to value (e.g., 'user.address.city')
     * @param {*} defaultValue - Default value if path doesn't exist
     * @returns {*} Value at path or default value
     */
    static get(obj, path, defaultValue = undefined) {
        const value = path
            .split('.')
            .reduce((current, key) => current && current[key], obj);
        return value === undefined ? defaultValue : value;
    }

    /**
     * Set nested object value safely
     * @param {Object} obj - Object to set value in
     * @param {string} path - Path to set value at (e.g., 'user.address.city')
     * @param {*} value - Value to set
     * @returns {Object} Updated object
     */
    static set(obj, path, value) {
        const clone = this.deepClone(obj);
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!(key in current)) {
                current[key] = {};
            }
            return current[key];
        }, clone);
        target[lastKey] = value;
        return clone;
    }
}

module.exports = CollectionHelper;
