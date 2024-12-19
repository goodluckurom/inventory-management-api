const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const config = require('./config');
const DateHelper = require('./dateHelper');
const StringHelper = require('./stringHelper');
const CurrencyHelper = require('./currencyHelper');

/**
 * PDF Generator Utility
 */
class PDFGenerator {
    constructor() {
        this.outputDir = path.join(process.cwd(), 'public', 'documents');
        this.defaultOptions = {
            size: 'A4',
            margin: 50,
            info: {
                Creator: config.get('company.name'),
                Producer: 'Inventory Management System'
            },
            defaultStyle: {
                font: 'Helvetica',
                fontSize: 12,
                lineHeight: 1.5
            }
        };
    }

    /**
     * Generate invoice PDF
     * @param {Object} data - Invoice data
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Generated PDF path
     */
    async generateInvoice(data, options = {}) {
        try {
            const fileName = `invoice_${data.invoiceNumber}_${Date.now()}.pdf`;
            const filePath = path.join(this.outputDir, fileName);

            await this._ensureOutputDir();

            const doc = new PDFDocument({
                ...this.defaultOptions,
                ...options
            });

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Add company logo
            if (data.companyLogo) {
                doc.image(data.companyLogo, 50, 50, { width: 150 });
            }

            // Add header
            doc.fontSize(20)
               .text('INVOICE', { align: 'right' })
               .fontSize(12)
               .text(`Invoice #: ${data.invoiceNumber}`, { align: 'right' })
               .text(`Date: ${DateHelper.formatDate(data.date, 'long')}`, { align: 'right' })
               .moveDown();

            // Add company and client details
            this._addCompanyDetails(doc, data.company);
            this._addClientDetails(doc, data.client);

            // Add items table
            this._addItemsTable(doc, data.items);

            // Add totals
            this._addTotals(doc, data.totals);

            // Add footer
            this._addFooter(doc, data.footer);

            // Finalize PDF
            doc.end();

            await new Promise((resolve) => stream.on('finish', resolve));

            return filePath;
        } catch (error) {
            logger.error('Error generating invoice PDF:', error);
            throw error;
        }
    }

    /**
     * Generate purchase order PDF
     * @param {Object} data - Purchase order data
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Generated PDF path
     */
    async generatePurchaseOrder(data, options = {}) {
        try {
            const fileName = `po_${data.orderNumber}_${Date.now()}.pdf`;
            const filePath = path.join(this.outputDir, fileName);

            await this._ensureOutputDir();

            const doc = new PDFDocument({
                ...this.defaultOptions,
                ...options
            });

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Add header
            doc.fontSize(20)
               .text('PURCHASE ORDER', { align: 'center' })
               .moveDown();

            // Add order details
            doc.fontSize(12)
               .text(`PO Number: ${data.orderNumber}`)
               .text(`Date: ${DateHelper.formatDate(data.date, 'long')}`)
               .text(`Expected Delivery: ${DateHelper.formatDate(data.expectedDelivery, 'long')}`)
               .moveDown();

            // Add supplier details
            this._addSupplierDetails(doc, data.supplier);

            // Add items table
            this._addItemsTable(doc, data.items);

            // Add totals
            this._addTotals(doc, data.totals);

            // Add terms and conditions
            if (data.terms) {
                doc.moveDown()
                   .fontSize(12)
                   .text('Terms and Conditions', { underline: true })
                   .fontSize(10)
                   .text(data.terms);
            }

            // Finalize PDF
            doc.end();

            await new Promise((resolve) => stream.on('finish', resolve));

            return filePath;
        } catch (error) {
            logger.error('Error generating purchase order PDF:', error);
            throw error;
        }
    }

    /**
     * Generate shipping label PDF
     * @param {Object} data - Shipping data
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Generated PDF path
     */
    async generateShippingLabel(data, options = {}) {
        try {
            const fileName = `shipping_${data.trackingNumber}_${Date.now()}.pdf`;
            const filePath = path.join(this.outputDir, fileName);

            await this._ensureOutputDir();

            const doc = new PDFDocument({
                size: [4 * 72, 6 * 72], // 4x6 inches
                margin: 20,
                ...options
            });

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Add barcode
            if (data.barcode) {
                doc.image(data.barcode, 20, 20, { width: 200 });
            }

            // Add shipping details
            doc.fontSize(10)
               .text(`Tracking: ${data.trackingNumber}`)
               .moveDown(0.5);

            // Add addresses
            doc.fontSize(8)
               .text('From:', { underline: true })
               .text(this._formatAddress(data.from))
               .moveDown(0.5)
               .text('To:', { underline: true })
               .text(this._formatAddress(data.to));

            // Finalize PDF
            doc.end();

            await new Promise((resolve) => stream.on('finish', resolve));

            return filePath;
        } catch (error) {
            logger.error('Error generating shipping label PDF:', error);
            throw error;
        }
    }

    /**
     * Add company details to PDF
     * @param {PDFDocument} doc - PDF document
     * @param {Object} company - Company details
     * @private
     */
    _addCompanyDetails(doc, company) {
        doc.fontSize(12)
           .text(company.name)
           .fontSize(10)
           .text(company.address)
           .text(`Phone: ${company.phone}`)
           .text(`Email: ${company.email}`)
           .moveDown();
    }

    /**
     * Add client details to PDF
     * @param {PDFDocument} doc - PDF document
     * @param {Object} client - Client details
     * @private
     */
    _addClientDetails(doc, client) {
        doc.fontSize(12)
           .text('Bill To:', { underline: true })
           .fontSize(10)
           .text(client.name)
           .text(client.address)
           .text(`Phone: ${client.phone}`)
           .text(`Email: ${client.email}`)
           .moveDown();
    }

    /**
     * Add items table to PDF
     * @param {PDFDocument} doc - PDF document
     * @param {Array} items - Items array
     * @private
     */
    _addItemsTable(doc, items) {
        const tableTop = doc.y;
        const itemsPerPage = 20;
        let currentItem = 0;

        while (currentItem < items.length) {
            const pageItems = items.slice(currentItem, currentItem + itemsPerPage);
            
            // Add table headers
            this._drawTableRow(doc, tableTop, [
                'Item',
                'Description',
                'Quantity',
                'Price',
                'Total'
            ], true);

            // Add items
            let y = doc.y;
            pageItems.forEach((item, index) => {
                y = this._drawTableRow(doc, y, [
                    item.name,
                    item.description,
                    item.quantity.toString(),
                    CurrencyHelper.formatPrice(item.price),
                    CurrencyHelper.formatPrice(item.total)
                ]);
            });

            currentItem += itemsPerPage;

            // Add new page if more items
            if (currentItem < items.length) {
                doc.addPage();
            }
        }
    }

    /**
     * Draw table row
     * @param {PDFDocument} doc - PDF document
     * @param {number} y - Y position
     * @param {Array} items - Row items
     * @param {boolean} isHeader - Whether row is header
     * @returns {number} Next Y position
     * @private
     */
    _drawTableRow(doc, y, items, isHeader = false) {
        const columnWidths = [0.2, 0.3, 0.15, 0.15, 0.2];
        const startX = doc.page.margins.left;
        const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        doc.fontSize(isHeader ? 10 : 9);

        items.forEach((item, i) => {
            const x = startX + width * columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
            const colWidth = width * columnWidths[i];
            
            doc.text(item, x, y, {
                width: colWidth,
                align: i > 1 ? 'right' : 'left'
            });
        });

        return y + 20;
    }

    /**
     * Add totals to PDF
     * @param {PDFDocument} doc - PDF document
     * @param {Object} totals - Totals object
     * @private
     */
    _addTotals(doc, totals) {
        const width = 150;
        const x = doc.page.width - doc.page.margins.right - width;
        let y = doc.y + 20;

        Object.entries(totals).forEach(([label, value]) => {
            doc.fontSize(10)
               .text(label, x, y)
               .text(CurrencyHelper.formatPrice(value), x, y, {
                   width,
                   align: 'right'
               });
            y += 20;
        });
    }

    /**
     * Add footer to PDF
     * @param {PDFDocument} doc - PDF document
     * @param {string} footer - Footer text
     * @private
     */
    _addFooter(doc, footer) {
        const bottom = doc.page.height - doc.page.margins.bottom;
        
        doc.fontSize(8)
           .text(footer, doc.page.margins.left, bottom - 20, {
               width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
               align: 'center'
           });
    }

    /**
     * Format address for PDF
     * @param {Object} address - Address object
     * @returns {string} Formatted address
     * @private
     */
    _formatAddress(address) {
        return [
            address.name,
            address.street,
            address.street2,
            `${address.city}, ${address.state} ${address.postalCode}`,
            address.country
        ].filter(Boolean).join('\n');
    }

    /**
     * Ensure output directory exists
     * @returns {Promise<void>}
     * @private
     */
    async _ensureOutputDir() {
        await fs.mkdir(this.outputDir, { recursive: true });
    }
}

module.exports = new PDFGenerator();
