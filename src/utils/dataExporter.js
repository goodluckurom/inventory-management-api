const { prisma } = require('../server');
const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const logger = require('./logger');
const DateHelper = require('./dateHelper');
const StringHelper = require('./stringHelper');

/**
 * Data Export/Import Utility
 */
class DataExporter {
    constructor() {
        this.exportDir = path.join(process.cwd(), 'exports');
        this.importDir = path.join(process.cwd(), 'imports');
    }

    /**
     * Export data to JSON
     * @param {Object} options - Export options
     * @returns {Promise<string>} Export file path
     */
    async exportToJson(options = {}) {
        try {
            const timestamp = DateHelper.getCurrentDateTime().replace(/[:.]/g, '-');
            const fileName = `export_${timestamp}.json`;
            const filePath = path.join(this.exportDir, fileName);

            // Ensure export directory exists
            await fs.mkdir(this.exportDir, { recursive: true });

            // Get data for each model
            const data = await this._getAllData(options.models);

            // Write to file
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));

            logger.info(`Data exported to ${filePath}`);
            return filePath;
        } catch (error) {
            logger.error('Error exporting data to JSON:', error);
            throw error;
        }
    }

    /**
     * Export data to CSV
     * @param {string} model - Model name
     * @param {Object} options - Export options
     * @returns {Promise<string>} Export file path
     */
    async exportToCsv(model, options = {}) {
        try {
            const timestamp = DateHelper.getCurrentDateTime().replace(/[:.]/g, '-');
            const fileName = `${model}_${timestamp}.csv`;
            const filePath = path.join(this.exportDir, fileName);

            // Ensure export directory exists
            await fs.mkdir(this.exportDir, { recursive: true });

            // Get data
            const data = await prisma[model].findMany(options.query || {});

            // Configure CSV writer
            const csvWriter = createCsvWriter({
                path: filePath,
                header: this._generateCsvHeaders(data[0])
            });

            // Write data
            await csvWriter.writeRecords(data.map(item => this._flattenObject(item)));

            logger.info(`Data exported to ${filePath}`);
            return filePath;
        } catch (error) {
            logger.error('Error exporting data to CSV:', error);
            throw error;
        }
    }

    /**
     * Import data from JSON
     * @param {string} filePath - JSON file path
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import results
     */
    async importFromJson(filePath, options = {}) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            const results = {};

            // Import data for each model
            for (const [model, items] of Object.entries(data)) {
                if (!Array.isArray(items)) continue;

                results[model] = {
                    total: items.length,
                    success: 0,
                    failed: 0,
                    errors: []
                };

                for (const item of items) {
                    try {
                        await prisma[model].create({
                            data: this._cleanImportData(item)
                        });
                        results[model].success++;
                    } catch (error) {
                        results[model].failed++;
                        results[model].errors.push({
                            item,
                            error: error.message
                        });
                    }
                }
            }

            logger.info('Data import completed', { results });
            return results;
        } catch (error) {
            logger.error('Error importing data from JSON:', error);
            throw error;
        }
    }

    /**
     * Import data from CSV
     * @param {string} model - Model name
     * @param {string} filePath - CSV file path
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import results
     */
    async importFromCsv(model, filePath, options = {}) {
        try {
            const results = {
                total: 0,
                success: 0,
                failed: 0,
                errors: []
            };

            const rows = await this._readCsvFile(filePath);

            for (const row of rows) {
                results.total++;
                try {
                    await prisma[model].create({
                        data: this._cleanImportData(row)
                    });
                    results.success++;
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        row,
                        error: error.message
                    });
                }
            }

            logger.info('CSV import completed', { results });
            return results;
        } catch (error) {
            logger.error('Error importing data from CSV:', error);
            throw error;
        }
    }

    /**
     * Create database backup
     * @returns {Promise<string>} Backup file path
     */
    async createBackup() {
        try {
            const timestamp = DateHelper.getCurrentDateTime().replace(/[:.]/g, '-');
            const fileName = `backup_${timestamp}.json`;
            const filePath = path.join(this.exportDir, 'backups', fileName);

            // Ensure backup directory exists
            await fs.mkdir(path.dirname(filePath), { recursive: true });

            // Get all data
            const data = await this._getAllData();

            // Write backup file
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));

            logger.info(`Backup created at ${filePath}`);
            return filePath;
        } catch (error) {
            logger.error('Error creating backup:', error);
            throw error;
        }
    }

    /**
     * Restore from backup
     * @param {string} filePath - Backup file path
     * @returns {Promise<Object>} Restore results
     */
    async restoreFromBackup(filePath) {
        try {
            // Validate backup file
            const stats = await fs.stat(filePath);
            if (!stats.isFile()) {
                throw new Error('Invalid backup file');
            }

            // Import data
            return await this.importFromJson(filePath, { isRestore: true });
        } catch (error) {
            logger.error('Error restoring from backup:', error);
            throw error;
        }
    }

    /**
     * Get all data for specified models
     * @param {string[]} models - Models to export (optional)
     * @returns {Promise<Object>} Data object
     * @private
     */
    async _getAllData(models = null) {
        const data = {};
        const modelNames = models || Object.keys(prisma);

        for (const model of modelNames) {
            if (typeof prisma[model].findMany === 'function') {
                data[model] = await prisma[model].findMany();
            }
        }

        return data;
    }

    /**
     * Generate CSV headers from object
     * @param {Object} obj - Sample object
     * @returns {Array} CSV headers
     * @private
     */
    _generateCsvHeaders(obj) {
        if (!obj) return [];

        return Object.keys(this._flattenObject(obj)).map(key => ({
            id: key,
            title: StringHelper.camelToSentence(key)
        }));
    }

    /**
     * Flatten nested object
     * @param {Object} obj - Object to flatten
     * @param {string} prefix - Key prefix
     * @returns {Object} Flattened object
     * @private
     */
    _flattenObject(obj, prefix = '') {
        return Object.keys(obj).reduce((acc, k) => {
            const pre = prefix.length ? `${prefix}.` : '';
            if (
                typeof obj[k] === 'object' && 
                obj[k] !== null && 
                !Array.isArray(obj[k]) &&
                !(obj[k] instanceof Date)
            ) {
                Object.assign(acc, this._flattenObject(obj[k], pre + k));
            } else {
                acc[pre + k] = obj[k];
            }
            return acc;
        }, {});
    }

    /**
     * Clean import data
     * @param {Object} data - Data to clean
     * @returns {Object} Cleaned data
     * @private
     */
    _cleanImportData(data) {
        const cleaned = { ...data };

        // Remove metadata fields
        delete cleaned.id;
        delete cleaned.createdAt;
        delete cleaned.updatedAt;

        // Convert string dates to Date objects
        Object.keys(cleaned).forEach(key => {
            if (typeof cleaned[key] === 'string' && DateHelper.isValidDate(cleaned[key])) {
                cleaned[key] = new Date(cleaned[key]);
            }
        });

        return cleaned;
    }

    /**
     * Read CSV file
     * @param {string} filePath - CSV file path
     * @returns {Promise<Array>} CSV data
     * @private
     */
    async _readCsvFile(filePath) {
        return new Promise((resolve, reject) => {
            const results = [];
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => resolve(results))
                .on('error', (error) => reject(error));
        });
    }
}

module.exports = new DataExporter();
