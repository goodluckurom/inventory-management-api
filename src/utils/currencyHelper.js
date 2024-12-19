const logger = require('./logger');
const config = require('./config');

/**
 * Currency Helper Utility
 */
class CurrencyHelper {
    constructor() {
        this.defaultCurrency = config.get('business.defaultCurrency') || 'USD';
        this.exchangeRates = new Map();
        this.precision = 2;

        // Initialize with some common exchange rates
        // In a production environment, these would be fetched from an external API
        this._initializeExchangeRates();
    }

    /**
     * Initialize exchange rates
     * @private
     */
    _initializeExchangeRates() {
        // Example rates (should be updated from an external service in production)
        this.exchangeRates.set('USD', 1.0);
        this.exchangeRates.set('EUR', 0.85);
        this.exchangeRates.set('GBP', 0.73);
        this.exchangeRates.set('JPY', 110.0);
        this.exchangeRates.set('CAD', 1.25);
        this.exchangeRates.set('AUD', 1.35);
    }

    /**
     * Format price
     * @param {number} amount - Amount to format
     * @param {string} currency - Currency code
     * @param {string} locale - Locale code
     * @returns {string} Formatted price
     */
    formatPrice(amount, currency = this.defaultCurrency, locale = 'en-US') {
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency
            }).format(amount);
        } catch (error) {
            logger.error('Error formatting price:', error);
            return `${currency} ${amount.toFixed(this.precision)}`;
        }
    }

    /**
     * Convert price between currencies
     * @param {number} amount - Amount to convert
     * @param {string} fromCurrency - Source currency
     * @param {string} toCurrency - Target currency
     * @returns {number} Converted amount
     */
    convertPrice(amount, fromCurrency, toCurrency) {
        try {
            if (fromCurrency === toCurrency) return amount;

            const fromRate = this.exchangeRates.get(fromCurrency);
            const toRate = this.exchangeRates.get(toCurrency);

            if (!fromRate || !toRate) {
                throw new Error('Invalid currency code');
            }

            const converted = (amount / fromRate) * toRate;
            return Number(converted.toFixed(this.precision));
        } catch (error) {
            logger.error('Error converting price:', error);
            throw error;
        }
    }

    /**
     * Calculate total with tax
     * @param {number} amount - Base amount
     * @param {number} taxRate - Tax rate percentage
     * @returns {Object} Calculation result
     */
    calculateTotalWithTax(amount, taxRate = 0) {
        try {
            const taxAmount = (amount * taxRate) / 100;
            const total = amount + taxAmount;

            return {
                baseAmount: Number(amount.toFixed(this.precision)),
                taxRate,
                taxAmount: Number(taxAmount.toFixed(this.precision)),
                total: Number(total.toFixed(this.precision))
            };
        } catch (error) {
            logger.error('Error calculating total with tax:', error);
            throw error;
        }
    }

    /**
     * Calculate discount
     * @param {number} amount - Base amount
     * @param {number} discountPercent - Discount percentage
     * @returns {Object} Calculation result
     */
    calculateDiscount(amount, discountPercent) {
        try {
            const discountAmount = (amount * discountPercent) / 100;
            const finalAmount = amount - discountAmount;

            return {
                originalAmount: Number(amount.toFixed(this.precision)),
                discountPercent,
                discountAmount: Number(discountAmount.toFixed(this.precision)),
                finalAmount: Number(finalAmount.toFixed(this.precision))
            };
        } catch (error) {
            logger.error('Error calculating discount:', error);
            throw error;
        }
    }

    /**
     * Calculate bulk pricing
     * @param {number} unitPrice - Unit price
     * @param {number} quantity - Quantity
     * @param {Array} bulkPricingTiers - Bulk pricing tiers
     * @returns {Object} Calculation result
     */
    calculateBulkPrice(unitPrice, quantity, bulkPricingTiers = []) {
        try {
            // Sort tiers by quantity in descending order
            const sortedTiers = [...bulkPricingTiers].sort((a, b) => b.quantity - a.quantity);

            // Find applicable tier
            const tier = sortedTiers.find(t => quantity >= t.quantity);
            const discount = tier ? tier.discount : 0;
            
            const discountAmount = (unitPrice * discount) / 100;
            const finalUnitPrice = unitPrice - discountAmount;
            const totalPrice = finalUnitPrice * quantity;

            return {
                originalUnitPrice: Number(unitPrice.toFixed(this.precision)),
                quantity,
                appliedDiscount: discount,
                finalUnitPrice: Number(finalUnitPrice.toFixed(this.precision)),
                totalPrice: Number(totalPrice.toFixed(this.precision))
            };
        } catch (error) {
            logger.error('Error calculating bulk price:', error);
            throw error;
        }
    }

    /**
     * Calculate margin
     * @param {number} costPrice - Cost price
     * @param {number} sellingPrice - Selling price
     * @returns {Object} Calculation result
     */
    calculateMargin(costPrice, sellingPrice) {
        try {
            const profit = sellingPrice - costPrice;
            const marginPercent = (profit / sellingPrice) * 100;
            const markupPercent = (profit / costPrice) * 100;

            return {
                costPrice: Number(costPrice.toFixed(this.precision)),
                sellingPrice: Number(sellingPrice.toFixed(this.precision)),
                profit: Number(profit.toFixed(this.precision)),
                marginPercent: Number(marginPercent.toFixed(this.precision)),
                markupPercent: Number(markupPercent.toFixed(this.precision))
            };
        } catch (error) {
            logger.error('Error calculating margin:', error);
            throw error;
        }
    }

    /**
     * Calculate shipping cost
     * @param {number} basePrice - Base shipping price
     * @param {number} weight - Weight in kg
     * @param {string} zone - Shipping zone
     * @returns {Object} Calculation result
     */
    calculateShippingCost(basePrice, weight, zone) {
        try {
            // Example shipping calculation logic
            const zoneMultiplier = {
                'local': 1.0,
                'regional': 1.5,
                'national': 2.0,
                'international': 3.0
            }[zone] || 1.0;

            const weightCost = weight * 0.5; // $0.50 per kg
            const totalCost = (basePrice + weightCost) * zoneMultiplier;

            return {
                basePrice: Number(basePrice.toFixed(this.precision)),
                weight,
                zone,
                weightCost: Number(weightCost.toFixed(this.precision)),
                zoneMultiplier,
                totalCost: Number(totalCost.toFixed(this.precision))
            };
        } catch (error) {
            logger.error('Error calculating shipping cost:', error);
            throw error;
        }
    }

    /**
     * Round price according to pricing rules
     * @param {number} price - Price to round
     * @param {Object} rules - Rounding rules
     * @returns {number} Rounded price
     */
    roundPrice(price, rules = {}) {
        try {
            const {
                roundTo = 0.05, // Round to nearest 0.05
                roundUp = true  // Round up or down
            } = rules;

            const multiplier = 1 / roundTo;
            const rounded = roundUp
                ? Math.ceil(price * multiplier) / multiplier
                : Math.floor(price * multiplier) / multiplier;

            return Number(rounded.toFixed(this.precision));
        } catch (error) {
            logger.error('Error rounding price:', error);
            throw error;
        }
    }

    /**
     * Parse price string to number
     * @param {string} priceString - Price string
     * @returns {number} Parsed price
     */
    parsePrice(priceString) {
        try {
            // Remove currency symbols and non-numeric characters except decimal point
            const cleaned = priceString.replace(/[^0-9.]/g, '');
            const parsed = parseFloat(cleaned);

            if (isNaN(parsed)) {
                throw new Error('Invalid price format');
            }

            return Number(parsed.toFixed(this.precision));
        } catch (error) {
            logger.error('Error parsing price:', error);
            throw error;
        }
    }
}

module.exports = new CurrencyHelper();
