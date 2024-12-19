const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');
const DateHelper = require('./dateHelper');
const StringHelper = require('./stringHelper');
const CollectionHelper = require('./collectionHelper');

/**
 * Report Generator Utility
 */
class ReportGenerator {
    /**
     * Generate Excel report
     * @param {Object} options - Report options
     * @returns {Promise<Buffer>} Excel file buffer
     */
    static async generateExcel({ title, data, columns, sheetName = 'Sheet1' }) {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(sheetName);

            // Add title
            worksheet.addRow([title]);
            worksheet.mergeCells('A1:' + StringHelper.toExcelColumn(columns.length) + '1');
            worksheet.getCell('A1').font = { bold: true, size: 14 };
            worksheet.getCell('A1').alignment = { horizontal: 'center' };

            // Add headers
            worksheet.addRow(columns.map(col => col.header));
            worksheet.getRow(2).font = { bold: true };

            // Add data
            data.forEach(item => {
                const row = columns.map(col => item[col.key]);
                worksheet.addRow(row);
            });

            // Style columns
            columns.forEach((col, index) => {
                const column = worksheet.getColumn(index + 1);
                column.width = col.width || 15;

                if (col.type === 'number') {
                    column.numFmt = col.format || '#,##0.00';
                } else if (col.type === 'date') {
                    column.numFmt = col.format || 'dd/mm/yyyy';
                }
            });

            // Generate buffer
            return await workbook.xlsx.writeBuffer();
        } catch (error) {
            logger.error('Error generating Excel report:', error);
            throw error;
        }
    }

    /**
     * Generate PDF report
     * @param {Object} options - Report options
     * @returns {Promise<Buffer>} PDF file buffer
     */
    static async generatePDF({ title, data, columns, options = {} }) {
        return new Promise((resolve, reject) => {
            try {
                const chunks = [];
                const doc = new PDFDocument({
                    margin: 50,
                    size: 'A4',
                    ...options
                });

                // Collect data chunks
                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));

                // Add title
                doc.fontSize(16)
                   .font('Helvetica-Bold')
                   .text(title, { align: 'center' })
                   .moveDown();

                // Add timestamp
                doc.fontSize(10)
                   .font('Helvetica')
                   .text(`Generated on: ${DateHelper.formatDate(new Date(), 'long')}`)
                   .moveDown();

                // Create table
                const tableTop = 150;
                let currentTop = tableTop;

                // Add headers
                doc.font('Helvetica-Bold');
                columns.forEach((col, i) => {
                    doc.text(col.header, 
                        50 + (i * (500 / columns.length)), 
                        currentTop, 
                        { width: 500 / columns.length, align: 'left' }
                    );
                });

                // Add data
                doc.font('Helvetica');
                data.forEach((item, rowIndex) => {
                    currentTop = tableTop + 25 + (rowIndex * 25);
                    
                    // Add new page if needed
                    if (currentTop > 750) {
                        doc.addPage();
                        currentTop = 50;
                    }

                    columns.forEach((col, i) => {
                        let value = item[col.key];
                        if (col.type === 'date') {
                            value = DateHelper.formatDate(value, col.format || 'short');
                        } else if (col.type === 'number') {
                            value = typeof value === 'number' ? 
                                value.toLocaleString(undefined, { 
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2 
                                }) : value;
                        }

                        doc.text(value, 
                            50 + (i * (500 / columns.length)), 
                            currentTop,
                            { width: 500 / columns.length, align: 'left' }
                        );
                    });
                });

                doc.end();
            } catch (error) {
                logger.error('Error generating PDF report:', error);
                reject(error);
            }
        });
    }

    /**
     * Generate CSV report
     * @param {Object} options - Report options
     * @returns {Promise<string>} CSV string
     */
    static async generateCSV({ data, columns }) {
        try {
            const fields = columns.map(col => ({
                label: col.header,
                value: col.key,
                default: col.default || ''
            }));

            const parser = new Parser({ fields });
            return parser.parse(data);
        } catch (error) {
            logger.error('Error generating CSV report:', error);
            throw error;
        }
    }

    /**
     * Generate inventory report
     * @param {Object} options - Report options
     * @returns {Promise<Buffer>} Report buffer
     */
    static async generateInventoryReport({ format = 'excel', filters = {} }) {
        try {
            // Get inventory data
            const { prisma } = require('../server');
            const products = await prisma.product.findMany({
                where: filters,
                include: {
                    category: true,
                    supplier: true
                }
            });

            const reportData = products.map(product => ({
                sku: product.sku,
                name: product.name,
                category: product.category.name,
                quantity: product.quantity,
                reorderPoint: product.reorderPoint,
                supplier: product.supplier.name,
                price: product.price,
                lastUpdated: product.updatedAt
            }));

            const columns = [
                { key: 'sku', header: 'SKU', width: 15 },
                { key: 'name', header: 'Product Name', width: 30 },
                { key: 'category', header: 'Category', width: 20 },
                { key: 'quantity', header: 'Quantity', type: 'number', width: 15 },
                { key: 'reorderPoint', header: 'Reorder Point', type: 'number', width: 15 },
                { key: 'supplier', header: 'Supplier', width: 30 },
                { key: 'price', header: 'Price', type: 'number', width: 15 },
                { key: 'lastUpdated', header: 'Last Updated', type: 'date', width: 20 }
            ];

            switch (format.toLowerCase()) {
                case 'excel':
                    return await this.generateExcel({
                        title: 'Inventory Report',
                        data: reportData,
                        columns
                    });
                case 'pdf':
                    return await this.generatePDF({
                        title: 'Inventory Report',
                        data: reportData,
                        columns
                    });
                case 'csv':
                    return await this.generateCSV({
                        data: reportData,
                        columns
                    });
                default:
                    throw new Error('Unsupported format');
            }
        } catch (error) {
            logger.error('Error generating inventory report:', error);
            throw error;
        }
    }

    /**
     * Generate sales report
     * @param {Object} options - Report options
     * @returns {Promise<Buffer>} Report buffer
     */
    static async generateSalesReport({ format = 'excel', startDate, endDate, filters = {} }) {
        // Implementation similar to inventory report
        // Add sales-specific logic here
    }

    /**
     * Save report to file
     * @param {Buffer|string} content - Report content
     * @param {string} filename - File name
     * @param {string} directory - Directory to save to
     * @returns {Promise<string>} File path
     */
    static async saveReport(content, filename, directory = 'reports') {
        try {
            const reportDir = path.join(process.cwd(), directory);
            await fs.mkdir(reportDir, { recursive: true });

            const filePath = path.join(reportDir, filename);
            await fs.writeFile(filePath, content);

            logger.info(`Report saved: ${filePath}`);
            return filePath;
        } catch (error) {
            logger.error('Error saving report:', error);
            throw error;
        }
    }
}

module.exports = ReportGenerator;
