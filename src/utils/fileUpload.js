const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const ErrorResponse = require('./errorResponse');
const logger = require('./logger');

// Configuration
const UPLOAD_PATH = process.env.FILE_UPLOAD_PATH || './public/uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_UPLOAD) || 10485760; // 10MB

// Ensure upload directories exist
const createUploadDirs = async () => {
    const dirs = [
        UPLOAD_PATH,
        `${UPLOAD_PATH}/products`,
        `${UPLOAD_PATH}/documents`,
        `${UPLOAD_PATH}/temp`
    ];

    for (const dir of dirs) {
        try {
            await fs.access(dir);
        } catch {
            await fs.mkdir(dir, { recursive: true });
        }
    }
};

createUploadDirs().catch(err => {
    logger.error('Error creating upload directories:', err);
});

// Generate unique filename
const generateFileName = (originalname) => {
    const timestamp = Date.now();
    const hash = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalname);
    return `${timestamp}-${hash}${ext}`;
};

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadDir = UPLOAD_PATH;
        
        // Determine upload directory based on file type
        switch (file.fieldname) {
            case 'productImage':
                uploadDir = `${UPLOAD_PATH}/products`;
                break;
            case 'document':
                uploadDir = `${UPLOAD_PATH}/documents`;
                break;
            default:
                uploadDir = `${UPLOAD_PATH}/temp`;
        }
        
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, generateFileName(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    // Define allowed mime types for different file types
    const allowedMimes = {
        image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        document: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]
    };

    // Check file type
    if (file.fieldname === 'productImage' && !allowedMimes.image.includes(file.mimetype)) {
        cb(new ErrorResponse('Please upload a valid image file', 400), false);
    } else if (file.fieldname === 'document' && !allowedMimes.document.includes(file.mimetype)) {
        cb(new ErrorResponse('Please upload a valid document file', 400), false);
    } else {
        cb(null, true);
    }
};

// Configure multer upload
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE
    }
});

/**
 * File upload middleware configurations
 */
const uploadConfig = {
    // Single file uploads
    productImage: upload.single('productImage'),
    document: upload.single('document'),
    
    // Multiple file uploads
    productImages: upload.array('productImage', 5),
    documents: upload.array('document', 10),
    
    // Mixed file uploads
    mixed: upload.fields([
        { name: 'productImage', maxCount: 5 },
        { name: 'document', maxCount: 3 }
    ])
};

/**
 * Delete file from storage
 * @param {string} filePath - Path to file
 * @returns {Promise<void>}
 */
const deleteFile = async (filePath) => {
    try {
        await fs.unlink(filePath);
        logger.info(`File deleted successfully: ${filePath}`);
    } catch (error) {
        logger.error(`Error deleting file ${filePath}:`, error);
        throw new ErrorResponse('Error deleting file', 500);
    }
};

/**
 * Move file from temp to permanent location
 * @param {string} tempPath - Temporary file path
 * @param {string} targetPath - Target file path
 * @returns {Promise<void>}
 */
const moveFile = async (tempPath, targetPath) => {
    try {
        await fs.rename(tempPath, targetPath);
        logger.info(`File moved successfully from ${tempPath} to ${targetPath}`);
    } catch (error) {
        logger.error(`Error moving file from ${tempPath} to ${targetPath}:`, error);
        throw new ErrorResponse('Error moving file', 500);
    }
};

/**
 * Clean temporary files
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {Promise<void>}
 */
const cleanTempFiles = async (maxAge = 24 * 60 * 60 * 1000) => { // Default 24 hours
    try {
        const tempDir = `${UPLOAD_PATH}/temp`;
        const files = await fs.readdir(tempDir);
        const now = Date.now();

        for (const file of files) {
            const filePath = path.join(tempDir, file);
            const stats = await fs.stat(filePath);
            const age = now - stats.mtimeMs;

            if (age > maxAge) {
                await deleteFile(filePath);
                logger.info(`Cleaned up temporary file: ${file}`);
            }
        }
    } catch (error) {
        logger.error('Error cleaning temporary files:', error);
    }
};

/**
 * Get file information
 * @param {string} filePath - Path to file
 * @returns {Promise<Object>} File information
 */
const getFileInfo = async (filePath) => {
    try {
        const stats = await fs.stat(filePath);
        return {
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            mime: path.extname(filePath).slice(1)
        };
    } catch (error) {
        logger.error(`Error getting file info for ${filePath}:`, error);
        throw new ErrorResponse('Error getting file information', 500);
    }
};

// Export file upload utilities
module.exports = {
    uploadConfig,
    deleteFile,
    moveFile,
    cleanTempFiles,
    getFileInfo,
    UPLOAD_PATH
};
