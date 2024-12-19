const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');
const DateHelper = require('./dateHelper');
const StringHelper = require('./stringHelper');
const CurrencyHelper = require('./currencyHelper');

/**
 * Excel Processor Utility
 */
class ExcelProcessor {
    constructor() {
        this.outputDir = path.join(process.cwd(), 'public', 'exports');
        this.defaultStyles = {
            header: {
                font: {
                    bold: true,
                    size: 12
                },
                fill: {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' }
                },
                alignment: {
                    vertical: 'middle',
                    horizontal: 'center'
                }
            },
            currency: {
                numFmt: '"$"#,##0.00'
            },
            date: {
                numFmt: 'yyyy-mm-dd'
            },
            percentage: {
                numFmt: '0.00%'
            }
        };
    }

    /**
     * Generate inventory report
     * @param {Array} data - Inventory data
     * @param {Object} options - Report options
     * @returns {Promise<string>} Generated file path
     */
    async generateInventoryReport(data, options = {}) {
        try {
            const fileName = `inventory_report_${DateHelper.getCurrentDateTime().replace(/[:.]/g, '-')}.xlsx`;
            const filePath = path.join(this.outputDir, fileName);

            await this._ensureOutputDir();

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Inventory');

            // Define columns
            worksheet.columns = [
                { header: 'SKU', key: 'sku', width: 15 },
                { header: 'Name', key: 'name', width: 30 },
                { header: 'Category', key: 'category', width: 20 },
                { header: 'Quantity', key: 'quantity', width: 12 },
                { header: 'Unit', key: 'unit', width: 10 },
                { header: 'Price', key: 'price', width: 15 },
                { header: 'Value', key: 'value', width: 15 },
                { header: 'Location', key: 'location', width: 20 },
                { header: 'Last Updated', key: 'lastUpdated', width: 20 }
            ];

            // Apply header styles
            worksheet.getRow(1).eachCell(cell => {
                Object.assign(cell, this.defaultStyles.header);
            });

            // Add data
            data.forEach(item => {
                worksheet.addRow({
                    sku: item.sku,
                    name: item.name,
                    category: item.category,
                    quantity: item.quantity,
                    unit: item.unit,
                    price: item.price,
                    value: item.quantity * item.price,
                    location: item.location,
                    lastUpdated: item.lastUpdated
                });
            });

            // Apply column styles
            worksheet.getColumn('price').numFmt = this.defaultStyles.currency.numFmt;
            worksheet.getColumn('value').numFmt = this.defaultStyles.currency.numFmt;
            worksheet.getColumn('lastUpdated').numFmt = this.defaultStyles.date.numFmt;

            // Add totals
            const lastRow = worksheet.rowCount + 2;
            worksheet.addRow({
                name: 'Total',
                quantity: {
                    formula: `SUM(D2:D${worksheet.rowCount})`
                },
                value: {
                    formula: `SUM(G2:G${worksheet.rowCount})`
                }
            });
            worksheet.getRow(lastRow).font = { bold: true };

            await workbook.xlsx.writeFile(filePath);
            return filePath;
        } catch (error) {
            logger.error('Error generating inventory report:', error);
            throw error;
        }
    }

    /**
     * Generate sales report
     * @param {Array} data - Sales data
     * @param {Object} options - Report options
     * @returns {Promise<string>} Generated file path
     */
    async generateSalesReport(data, options = {}) {
        try {
            const fileName = `sales_report_${DateHelper.getCurrentDateTime().replace(/[:.]/g, '-')}.xlsx`;
            const filePath = path.join(this.outputDir, fileName);

            await this._ensureOutputDir();

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales');

            // Define columns
            worksheet.columns = [
                { header: 'Order Number', key: 'orderNumber', width: 15 },
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Customer', key: 'customer', width: 30 },
                { header: 'Items', key: 'items', width: 40 },
                { header: 'Subtotal', key: 'subtotal', width: 15 },
                { header: 'Tax', key: 'tax', width: 15 },
                { header: 'Total', key: 'total', width: 15 },
                { header: 'Status', key: 'status', width: 15 }
            ];

            // Apply header styles
            worksheet.getRow(1).eachCell(cell => {
                Object.assign(cell, this.defaultStyles.header);
            });

            // Add data
            data.forEach(sale => {
                worksheet.addRow({
                    orderNumber: sale.orderNumber,
                    date: sale.date,
                    customer: sale.customer,
                    items: sale.items.map(item => `${item.quantity}x ${item.name}`).join(', '),
                    subtotal: sale.subtotal,
                    tax: sale.tax,
                    total: sale.total,
                    status: sale.status
                });
            });

            // Apply column styles
            worksheet.getColumn('date').numFmt = this.defaultStyles.date.numFmt;
            worksheet.getColumn('subtotal').numFmt = this.defaultStyles.currency.numFmt;
            worksheet.getColumn('tax').numFmt = this.defaultStyles.currency.numFmt;
            worksheet.getColumn('total').numFmt = this.defaultStyles.currency.numFmt;

            // Add summary
            const summarySheet = workbook.addWorksheet('Summary');
            this._addSalesSummary(summarySheet, data);

            await workbook.xlsx.writeFile(filePath);
            return filePath;
        } catch (error) {
            logger.error('Error generating sales report:', error);
            throw error;
        }
    }

    /**
     * Import data from Excel
     * @param {string} filePath - Excel file path
     * @param {Object} options - Import options
     * @returns {Promise<Array>} Imported data
     */
    async importFromExcel(filePath, options = {}) {
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);

            const worksheet = workbook.getWorksheet(1);
            const headers = {};
            const data = [];

            // Get headers
            worksheet.getRow(1).eachCell((cell, colNumber) => {
                headers[colNumber] = cell.value;
            });

            // Get data
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header row

                const rowData = {};
                row.eachCell((cell, colNumber) => {
                    rowData[headers[colNumber]] = cell.value;
                });

                data.push(rowData);
            });

            return data;
        } catch (error) {
            logger.error('Error importing from Excel:', error);
            throw error;
        }
    }

    /**
     * Add sales summary to worksheet
     * @param {Worksheet} worksheet - Excel worksheet
     * @param {Array} data - Sales data
     * @private
     */
    _addSalesSummary(worksheet, data) {
        // Define columns
        worksheet.columns = [
            { header: 'Metric', key: 'metric', width: 30 },
            { header: 'Value', key: 'value', width: 20 }
        ];

        // Apply header styles
        worksheet.getRow(1).eachCell(cell => {
            Object.assign(cell, this.defaultStyles.header);
        });

        // Calculate summary metrics
        const totalSales = data.reduce((sum, sale) => sum + sale.total, 0);
        const totalOrders = data.length;
        const averageOrderValue = totalSales / totalOrders;

        // Add summary data
        const summaryData = [
            { metric: 'Total Sales', value: totalSales },
            { metric: 'Total Orders', value: totalOrders },
            { metric: 'Average Order Value', value: averageOrderValue }
        ];

        summaryData.forEach(item => {
            worksheet.addRow(item);
        });

        // Apply styles
        worksheet.getColumn('value').numFmt = this.defaultStyles.currency.numFmt;
    }

    /**
     * Ensure output directory exists
     * @returns {Promise<void>}
     * @private
     */
    async _ensureOutputDir() {
        await fs.mkdir(this.outputDir, { recursive: true });
    }

    /**
     * Format cell value
     * @param {*} value - Cell value
     * @param {string} type - Value type
     * @returns {*} Formatted value
     * @private
     */
    _formatCellValue(value, type) {
        switch (type) {
            case 'currency':
                return typeof value === 'number' ? value : parseFloat(value) || 0;
            case 'date':
                return value instanceof Date ? value : new Date(value);
            case 'number':
                return typeof value === 'number' ? value : parseFloat(value) || 0;
            default:
                return value;
        }
    }
}

module.exports = new ExcelProcessor();
