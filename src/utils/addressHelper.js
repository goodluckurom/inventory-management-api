const logger = require('./logger');
const httpClient = require('./httpClient');
const config = require('./config');

/**
 * Address Helper Utility
 */
class AddressHelper {
    constructor() {
        this.geocodingApiKey = config.get('geocoding.apiKey');
        this.geocodingProvider = config.get('geocoding.provider') || 'nominatim'; // Using OpenStreetMap's Nominatim by default (free)
        this.cache = new Map();
        this.cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
    }

    /**
     * Format address
     * @param {Object} address - Address object
     * @param {string} format - Format type
     * @returns {string} Formatted address
     */
    formatAddress({
        street,
        street2,
        city,
        state,
        country,
        postalCode
    }, format = 'single-line') {
        try {
            const parts = [
                street,
                street2,
                city,
                state,
                postalCode,
                country
            ].filter(Boolean);

            switch (format) {
                case 'single-line':
                    return parts.join(', ');
                case 'multi-line':
                    return parts.join('\n');
                case 'html':
                    return parts.join('<br>');
                default:
                    return parts.join(', ');
            }
        } catch (error) {
            logger.error('Error formatting address:', error);
            throw error;
        }
    }

    /**
     * Parse address string
     * @param {string} addressString - Address string
     * @returns {Object} Parsed address
     */
    parseAddress(addressString) {
        try {
            // Basic address parsing (can be enhanced with more sophisticated regex)
            const parts = addressString.split(',').map(part => part.trim());
            
            return {
                street: parts[0] || '',
                city: parts[1] || '',
                state: parts[2] || '',
                postalCode: parts[3] || '',
                country: parts[4] || ''
            };
        } catch (error) {
            logger.error('Error parsing address:', error);
            throw error;
        }
    }

    /**
     * Validate address
     * @param {Object} address - Address object
     * @returns {Object} Validation result
     */
    validateAddress(address) {
        const errors = [];
        const required = ['street', 'city', 'state', 'country', 'postalCode'];

        // Check required fields
        required.forEach(field => {
            if (!address[field]) {
                errors.push(`${field} is required`);
            }
        });

        // Validate postal code format (basic example)
        if (address.postalCode && !this._isValidPostalCode(address.postalCode, address.country)) {
            errors.push('Invalid postal code format');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Geocode address
     * @param {Object|string} address - Address to geocode
     * @returns {Promise<Object>} Geocoding result
     */
    async geocodeAddress(address) {
        try {
            const addressString = typeof address === 'string' ? 
                address : this.formatAddress(address);

            // Check cache
            const cached = this._getCachedGeocode(addressString);
            if (cached) return cached;

            let result;
            switch (this.geocodingProvider) {
                case 'nominatim':
                    result = await this._geocodeWithNominatim(addressString);
                    break;
                // Add other providers as needed
                default:
                    throw new Error('Unsupported geocoding provider');
            }

            // Cache result
            this._cacheGeocode(addressString, result);

            return result;
        } catch (error) {
            logger.error('Error geocoding address:', error);
            throw error;
        }
    }

    /**
     * Calculate distance between two addresses
     * @param {Object} address1 - First address
     * @param {Object} address2 - Second address
     * @returns {Promise<Object>} Distance calculation
     */
    async calculateDistance(address1, address2) {
        try {
            const [coords1, coords2] = await Promise.all([
                this.geocodeAddress(address1),
                this.geocodeAddress(address2)
            ]);

            const distance = this._calculateHaversineDistance(
                coords1.latitude,
                coords1.longitude,
                coords2.latitude,
                coords2.longitude
            );

            return {
                distanceKm: distance,
                distanceMiles: distance * 0.621371
            };
        } catch (error) {
            logger.error('Error calculating distance:', error);
            throw error;
        }
    }

    /**
     * Get timezone for address
     * @param {Object} address - Address object
     * @returns {Promise<Object>} Timezone information
     */
    async getTimezone(address) {
        try {
            const coords = await this.geocodeAddress(address);
            const response = await httpClient.get(
                `http://api.geonames.org/timezoneJSON?lat=${coords.latitude}&lng=${coords.longitude}&username=${config.get('geonames.username')}`
            );

            return {
                timezone: response.data.timezoneId,
                offset: response.data.rawOffset,
                dstOffset: response.data.dstOffset
            };
        } catch (error) {
            logger.error('Error getting timezone:', error);
            throw error;
        }
    }

    /**
     * Validate postal code
     * @param {string} postalCode - Postal code
     * @param {string} country - Country code
     * @returns {boolean} Whether postal code is valid
     * @private
     */
    _isValidPostalCode(postalCode, country) {
        // Add country-specific postal code validation
        const patterns = {
            'US': /^\d{5}(-\d{4})?$/,
            'UK': /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
            'CA': /^[ABCEGHJKLMNPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/i
            // Add more country patterns as needed
        };

        return !patterns[country] || patterns[country].test(postalCode);
    }

    /**
     * Geocode with Nominatim
     * @param {string} address - Address string
     * @returns {Promise<Object>} Geocoding result
     * @private
     */
    async _geocodeWithNominatim(address) {
        try {
            const response = await httpClient.get(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
                {
                    headers: {
                        'User-Agent': 'InventoryManagementSystem/1.0'
                    }
                }
            );

            if (!response.data?.[0]) {
                throw new Error('Address not found');
            }

            const result = response.data[0];
            return {
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                displayName: result.display_name,
                type: result.type,
                confidence: parseInt(result.importance * 10)
            };
        } catch (error) {
            logger.error('Error geocoding with Nominatim:', error);
            throw error;
        }
    }

    /**
     * Calculate Haversine distance
     * @param {number} lat1 - Latitude 1
     * @param {number} lon1 - Longitude 1
     * @param {number} lat2 - Latitude 2
     * @param {number} lon2 - Longitude 2
     * @returns {number} Distance in kilometers
     * @private
     */
    _calculateHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this._toRad(lat2 - lat1);
        const dLon = this._toRad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this._toRad(lat1)) * Math.cos(this._toRad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees - Degrees
     * @returns {number} Radians
     * @private
     */
    _toRad(degrees) {
        return degrees * Math.PI / 180;
    }

    /**
     * Get cached geocode
     * @param {string} address - Address string
     * @returns {Object|null} Cached result
     * @private
     */
    _getCachedGeocode(address) {
        const cached = this.cache.get(address);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        return null;
    }

    /**
     * Cache geocode result
     * @param {string} address - Address string
     * @param {Object} data - Geocoding result
     * @private
     */
    _cacheGeocode(address, data) {
        this.cache.set(address, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Clean cache
     * @private
     */
    _cleanCache() {
        const now = Date.now();
        for (const [address, cached] of this.cache.entries()) {
            if (now - cached.timestamp >= this.cacheTTL) {
                this.cache.delete(address);
            }
        }
    }
}

module.exports = new AddressHelper();
