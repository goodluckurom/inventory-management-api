const bwipjs = require('bwip-js');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');
const config = require('./config');
const StringHelper = require('./stringHelper');

/**
 * Barcode Generator Utility
 */
class BarcodeGenerator {
    constructor() {
        this.outputDir = path.join(process.cwd(), 'public', 'barcodes');
        this.defaultOptions = {
            barcode: {
                bcid: 'code128',       // Barcode type
                scale: 3,              // Scale factor
                height: 10,            // Bar height in millimeters
                includetext: true,     // Show human-readable text
                textxalign: 'center'   // Center-align text
            },
            qr: {
                version: 4,            // QR Code version
                errorCorrectionLevel: 'M',
                margin: 4,
                scale: 4,
                width: 200
            }
        };
    }

    /**
     * Generate barcode
     * @param {string} data - Data to encode
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Generated barcode path
     */
    async generateBarcode(data, options = {}) {
        try {
            const fileName = `barcode_${StringHelper.slugify(data)}_${Date.now()}.png`;
            const filePath = path.join(this.outputDir, fileName);

            // Ensure output directory exists
            await fs.mkdir(this.outputDir, { recursive: true });

            // Generate barcode
            const buffer = await this._generateBarcodeBuffer(data, {
                ...this.defaultOptions.barcode,
                ...options
            });

            // Save to file
            await fs.writeFile(filePath, buffer);

            logger.debug(`Generated barcode: ${filePath}`);
            return filePath;
        } catch (error) {
            logger.error('Error generating barcode:', error);
            throw error;
        }
    }

    /**
     * Generate QR code
     * @param {string} data - Data to encode
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Generated QR code path
     */
    async generateQRCode(data, options = {}) {
        try {
            const fileName = `qr_${StringHelper.slugify(data)}_${Date.now()}.png`;
            const filePath = path.join(this.outputDir, fileName);

            // Ensure output directory exists
            await fs.mkdir(this.outputDir, { recursive: true });

            // Generate QR code
            await QRCode.toFile(filePath, data, {
                ...this.defaultOptions.qr,
                ...options
            });

            logger.debug(`Generated QR code: ${filePath}`);
            return filePath;
        } catch (error) {
            logger.error('Error generating QR code:', error);
            throw error;
        }
    }

    /**
     * Generate barcode buffer
     * @param {string} data - Data to encode
     * @param {Object} options - Generation options
     * @returns {Promise<Buffer>} Barcode buffer
     * @private
     */
    async _generateBarcodeBuffer(data, options) {
        return new Promise((resolve, reject) => {
            bwipjs.toBuffer({
                ...options,
                text: data
            }, (error, buffer) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(buffer);
                }
            });
        });
    }

    /**
     * Generate product barcode
     * @param {Object} product - Product data
     * @returns {Promise<Object>} Generated barcode paths
     */
    async generateProductBarcodes(product) {
        try {
            // Generate standard barcode for SKU
            const barcodePath = await this.generateBarcode(product.sku, {
                alttext: product.name // Show product name as alternative text
            });

            // Generate QR code with detailed product info
            const qrData = JSON.stringify({
                sku: product.sku,
                name: product.name,
                category: product.category?.name,
                location: product.location
            });
            const qrPath = await this.generateQRCode(qrData);

            return {
                barcode: barcodePath,
                qrCode: qrPath
            };
        } catch (error) {
            logger.error('Error generating product barcodes:', error);
            throw error;
        }
    }

    /**
     * Generate location barcode
     * @param {Object} location - Location data
     * @returns {Promise<Object>} Generated barcode paths
     */
    async generateLocationBarcodes(location) {
        try {
            // Generate standard barcode for location code
            const barcodePath = await this.generateBarcode(location.code, {
                alttext: location.name
            });

            // Generate QR code with location info
            const qrData = JSON.stringify({
                code: location.code,
                name: location.name,
                warehouse: location.warehouse?.name,
                zone: location.zone?.name
            });
            const qrPath = await this.generateQRCode(qrData);

            return {
                barcode: barcodePath,
                qrCode: qrPath
            };
        } catch (error) {
            logger.error('Error generating location barcodes:', error);
            throw error;
        }
    }

    /**
     * Generate batch of barcodes
     * @param {Array} items - Items to generate barcodes for
     * @param {Object} options - Generation options
     * @returns {Promise<Array>} Generated barcode paths
     */
    async generateBatchBarcodes(items, options = {}) {
        try {
            const results = await Promise.all(
                items.map(async item => {
                    const barcodePath = await this.generateBarcode(
                        item.code || item.sku,
                        {
                            ...options,
                            alttext: item.name
                        }
                    );
                    return {
                        item,
                        barcodePath
                    };
                })
            );

            logger.info(`Generated ${results.length} barcodes in batch`);
            return results;
        } catch (error) {
            logger.error('Error generating batch barcodes:', error);
            throw error;
        }
    }

    /**
     * Clean up old barcode files
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {Promise<number>} Number of files deleted
     */
    async cleanup(maxAge = 24 * 60 * 60 * 1000) { // Default 24 hours
        try {
            const files = await fs.readdir(this.outputDir);
            const now = Date.now();
            let deleted = 0;

            for (const file of files) {
                const filePath = path.join(this.outputDir, file);
                const stats = await fs.stat(filePath);
                const age = now - stats.mtimeMs;

                if (age > maxAge) {
                    await fs.unlink(filePath);
                    deleted++;
                }
            }

            logger.info(`Cleaned up ${deleted} old barcode files`);
            return deleted;
        } catch (error) {
            logger.error('Error cleaning up barcodes:', error);
            throw error;
        }
    }

    /**
     * Generate barcode data URL
     * @param {string} data - Data to encode
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Data URL
     */
    async generateBarcodeDataUrl(data, options = {}) {
        try {
            const buffer = await this._generateBarcodeBuffer(data, {
                ...this.defaultOptions.barcode,
                ...options
            });
            return `data:image/png;base64,${buffer.toString('base64')}`;
        } catch (error) {
            logger.error('Error generating barcode data URL:', error);
            throw error;
        }
    }

    /**
     * Generate QR code data URL
     * @param {string} data - Data to encode
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Data URL
     */
    async generateQRCodeDataUrl(data, options = {}) {
        try {
            return await QRCode.toDataURL(data, {
                ...this.defaultOptions.qr,
                ...options
            });
        } catch (error) {
            logger.error('Error generating QR code data URL:', error);
            throw error;
        }
    }
}

module.exports = new BarcodeGenerator();
