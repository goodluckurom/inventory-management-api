const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');

/**
 * Email Templates
 */
const EMAIL_TEMPLATES = {
    notification: {
        subject: 'New Notification',
        template: 'notification.hbs'
    },
    lowStock: {
        subject: 'Low Stock Alert',
        template: 'low-stock.hbs'
    },
    orderStatus: {
        subject: 'Order Status Update',
        template: 'order-status.hbs'
    },
    qualityAlert: {
        subject: 'Quality Control Alert',
        template: 'quality-alert.hbs'
    }
};

/**
 * Create Nodemailer transporter
 */
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Cache for compiled templates
 */
const templateCache = new Map();

/**
 * Load and compile email template
 * @param {string} templateName - Name of the template file
 * @returns {Promise<Function>} Compiled template function
 */
async function loadTemplate(templateName) {
    // Check cache first
    if (templateCache.has(templateName)) {
        return templateCache.get(templateName);
    }

    try {
        const templatePath = path.join(__dirname, '../templates/emails', templateName);
        const templateContent = await fs.readFile(templatePath, 'utf-8');
        const compiledTemplate = handlebars.compile(templateContent);
        
        // Cache the compiled template
        templateCache.set(templateName, compiledTemplate);
        
        return compiledTemplate;
    } catch (error) {
        console.error(`Error loading email template ${templateName}:`, error);
        throw new Error('Failed to load email template');
    }
}

/**
 * Send email using template
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name
 * @param {Object} options.data - Template data
 * @returns {Promise<void>}
 */
async function sendEmail({ email, subject, template, data }) {
    try {
        // Get template configuration
        const templateConfig = EMAIL_TEMPLATES[template];
        if (!templateConfig) {
            throw new Error(`Invalid template: ${template}`);
        }

        // Load and compile template
        const compiledTemplate = await loadTemplate(templateConfig.template);
        
        // Generate HTML content
        const html = compiledTemplate({
            ...data,
            year: new Date().getFullYear(),
            companyName: process.env.COMPANY_NAME || 'Inventory Management System'
        });

        // Prepare email options
        const mailOptions = {
            from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
            to: email,
            subject: subject || templateConfig.subject,
            html
        };

        // Send email
        await transporter.sendMail(mailOptions);
        
        // Log success in development
        if (process.env.NODE_ENV === 'development') {
            console.log(`Email sent successfully to ${email}`);
        }
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Failed to send email');
    }
}

/**
 * Send bulk emails using template
 * @param {Object[]} recipients - Array of recipient objects
 * @param {string} template - Template name
 * @param {Object} commonData - Common template data
 * @returns {Promise<void>}
 */
async function sendBulkEmails(recipients, template, commonData = {}) {
    try {
        const emailPromises = recipients.map(recipient => 
            sendEmail({
                email: recipient.email,
                template,
                data: {
                    ...commonData,
                    ...recipient.data
                }
            })
        );

        await Promise.all(emailPromises);
    } catch (error) {
        console.error('Error sending bulk emails:', error);
        throw new Error('Failed to send bulk emails');
    }
}

/**
 * Verify SMTP connection
 * @returns {Promise<boolean>}
 */
async function verifyConnection() {
    try {
        await transporter.verify();
        return true;
    } catch (error) {
        console.error('SMTP connection verification failed:', error);
        return false;
    }
}

// Export email service functions
module.exports = {
    sendEmail,
    sendBulkEmails,
    verifyConnection
};
