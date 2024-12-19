const logger = require('./logger');

/**
 * Unit Converter Utility
 */
class UnitConverter {
    constructor() {
        // Weight conversions (base: grams)
        this.weightConversions = {
            'mg': 0.001,      // milligrams
            'g': 1,           // grams
            'kg': 1000,       // kilograms
            'oz': 28.3495,    // ounces
            'lb': 453.592,    // pounds
            't': 1000000      // metric tons
        };

        // Volume conversions (base: milliliters)
        this.volumeConversions = {
            'ml': 1,          // milliliters
            'l': 1000,        // liters
            'gal': 3785.41,   // gallons
            'qt': 946.353,    // quarts
            'pt': 473.176,    // pints
            'fl_oz': 29.5735  // fluid ounces
        };

        // Length conversions (base: millimeters)
        this.lengthConversions = {
            'mm': 1,          // millimeters
            'cm': 10,         // centimeters
            'm': 1000,        // meters
            'km': 1000000,    // kilometers
            'in': 25.4,       // inches
            'ft': 304.8,      // feet
            'yd': 914.4,      // yards
            'mi': 1609344     // miles
        };

        // Area conversions (base: square millimeters)
        this.areaConversions = {
            'mm2': 1,             // square millimeters
            'cm2': 100,           // square centimeters
            'm2': 1000000,        // square meters
            'ha': 10000000000,    // hectares
            'in2': 645.16,        // square inches
            'ft2': 92903.04,      // square feet
            'yd2': 836127.36,     // square yards
            'ac': 4046856422.4    // acres
        };

        // Temperature conversions are handled separately due to different conversion formulas
    }

    /**
     * Convert weight
     * @param {number} value - Value to convert
     * @param {string} fromUnit - Source unit
     * @param {string} toUnit - Target unit
     * @returns {number} Converted value
     */
    convertWeight(value, fromUnit, toUnit) {
        try {
            if (!this.weightConversions[fromUnit] || !this.weightConversions[toUnit]) {
                throw new Error('Invalid weight unit');
            }

            const baseValue = value * this.weightConversions[fromUnit];
            return baseValue / this.weightConversions[toUnit];
        } catch (error) {
            logger.error('Error converting weight:', error);
            throw error;
        }
    }

    /**
     * Convert volume
     * @param {number} value - Value to convert
     * @param {string} fromUnit - Source unit
     * @param {string} toUnit - Target unit
     * @returns {number} Converted value
     */
    convertVolume(value, fromUnit, toUnit) {
        try {
            if (!this.volumeConversions[fromUnit] || !this.volumeConversions[toUnit]) {
                throw new Error('Invalid volume unit');
            }

            const baseValue = value * this.volumeConversions[fromUnit];
            return baseValue / this.volumeConversions[toUnit];
        } catch (error) {
            logger.error('Error converting volume:', error);
            throw error;
        }
    }

    /**
     * Convert length
     * @param {number} value - Value to convert
     * @param {string} fromUnit - Source unit
     * @param {string} toUnit - Target unit
     * @returns {number} Converted value
     */
    convertLength(value, fromUnit, toUnit) {
        try {
            if (!this.lengthConversions[fromUnit] || !this.lengthConversions[toUnit]) {
                throw new Error('Invalid length unit');
            }

            const baseValue = value * this.lengthConversions[fromUnit];
            return baseValue / this.lengthConversions[toUnit];
        } catch (error) {
            logger.error('Error converting length:', error);
            throw error;
        }
    }

    /**
     * Convert area
     * @param {number} value - Value to convert
     * @param {string} fromUnit - Source unit
     * @param {string} toUnit - Target unit
     * @returns {number} Converted value
     */
    convertArea(value, fromUnit, toUnit) {
        try {
            if (!this.areaConversions[fromUnit] || !this.areaConversions[toUnit]) {
                throw new Error('Invalid area unit');
            }

            const baseValue = value * this.areaConversions[fromUnit];
            return baseValue / this.areaConversions[toUnit];
        } catch (error) {
            logger.error('Error converting area:', error);
            throw error;
        }
    }

    /**
     * Convert temperature
     * @param {number} value - Value to convert
     * @param {string} fromUnit - Source unit (C, F, or K)
     * @param {string} toUnit - Target unit (C, F, or K)
     * @returns {number} Converted value
     */
    convertTemperature(value, fromUnit, toUnit) {
        try {
            // Convert to Kelvin first (base unit)
            let kelvin;
            switch (fromUnit.toUpperCase()) {
                case 'C':
                    kelvin = value + 273.15;
                    break;
                case 'F':
                    kelvin = (value + 459.67) * 5/9;
                    break;
                case 'K':
                    kelvin = value;
                    break;
                default:
                    throw new Error('Invalid temperature unit');
            }

            // Convert from Kelvin to target unit
            switch (toUnit.toUpperCase()) {
                case 'C':
                    return kelvin - 273.15;
                case 'F':
                    return kelvin * 9/5 - 459.67;
                case 'K':
                    return kelvin;
                default:
                    throw new Error('Invalid temperature unit');
            }
        } catch (error) {
            logger.error('Error converting temperature:', error);
            throw error;
        }
    }

    /**
     * Format measurement with unit
     * @param {number} value - Value to format
     * @param {string} unit - Unit
     * @param {number} precision - Decimal precision
     * @returns {string} Formatted measurement
     */
    formatMeasurement(value, unit, precision = 2) {
        try {
            return `${value.toFixed(precision)} ${unit}`;
        } catch (error) {
            logger.error('Error formatting measurement:', error);
            throw error;
        }
    }

    /**
     * Parse measurement string
     * @param {string} measurement - Measurement string (e.g., "5.2 kg")
     * @returns {Object} Parsed value and unit
     */
    parseMeasurement(measurement) {
        try {
            const match = measurement.match(/^([\d.]+)\s*([a-zA-Z]+[0-9]*)$/);
            if (!match) {
                throw new Error('Invalid measurement format');
            }

            return {
                value: parseFloat(match[1]),
                unit: match[2].toLowerCase()
            };
        } catch (error) {
            logger.error('Error parsing measurement:', error);
            throw error;
        }
    }

    /**
     * Calculate dimensional weight
     * @param {number} length - Length in cm
     * @param {number} width - Width in cm
     * @param {number} height - Height in cm
     * @param {number} factor - Dimensional weight factor (default: 5000)
     * @returns {number} Dimensional weight in kg
     */
    calculateDimensionalWeight(length, width, height, factor = 5000) {
        try {
            const volumetricWeight = (length * width * height) / factor;
            return Math.ceil(volumetricWeight * 100) / 100;
        } catch (error) {
            logger.error('Error calculating dimensional weight:', error);
            throw error;
        }
    }

    /**
     * Get supported units
     * @param {string} type - Measurement type
     * @returns {string[]} Supported units
     */
    getSupportedUnits(type) {
        switch (type.toLowerCase()) {
            case 'weight':
                return Object.keys(this.weightConversions);
            case 'volume':
                return Object.keys(this.volumeConversions);
            case 'length':
                return Object.keys(this.lengthConversions);
            case 'area':
                return Object.keys(this.areaConversions);
            case 'temperature':
                return ['C', 'F', 'K'];
            default:
                throw new Error('Invalid measurement type');
        }
    }

    /**
     * Validate unit
     * @param {string} unit - Unit to validate
     * @param {string} type - Measurement type
     * @returns {boolean} Whether unit is valid
     */
    isValidUnit(unit, type) {
        try {
            const supportedUnits = this.getSupportedUnits(type);
            return supportedUnits.includes(unit.toLowerCase());
        } catch (error) {
            return false;
        }
    }
}

module.exports = new UnitConverter();
