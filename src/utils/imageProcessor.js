const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');
const config = require('./config');

/**
 * Image Processor Utility
 */
class ImageProcessor {
    constructor() {
        this.outputDir = path.join(process.cwd(), 'public', 'images');
        this.defaultOptions = {
            thumbnail: {
                width: 150,
                height: 150,
                fit: 'cover'
            },
            product: {
                width: 800,
                height: 800,
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            },
            watermark: {
                text: config.get('company.name') || 'Inventory System',
                fontSize: 24,
                opacity: 0.3
            },
            quality: 80,
            format: 'jpeg'
        };
    }

    /**
     * Process product image
     * @param {string|Buffer} input - Input image path or buffer
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processed image paths
     */
    async processProductImage(input, options = {}) {
        try {
            const fileName = this._generateFileName('product');
            const { mainImage, thumbnail } = await this._processImage(input, fileName, {
                ...this.defaultOptions,
                ...options
            });

            return {
                mainImage,
                thumbnail
            };
        } catch (error) {
            logger.error('Error processing product image:', error);
            throw error;
        }
    }

    /**
     * Process document scan
     * @param {string|Buffer} input - Input image path or buffer
     * @param {Object} options - Processing options
     * @returns {Promise<string>} Processed image path
     */
    async processDocumentScan(input, options = {}) {
        try {
            const fileName = this._generateFileName('document');
            const processedPath = await this._processDocument(input, fileName, {
                ...options,
                grayscale: true,
                sharpen: true
            });

            return processedPath;
        } catch (error) {
            logger.error('Error processing document scan:', error);
            throw error;
        }
    }

    /**
     * Add watermark to image
     * @param {string|Buffer} input - Input image path or buffer
     * @param {Object} options - Watermark options
     * @returns {Promise<string>} Processed image path
     */
    async addWatermark(input, options = {}) {
        try {
            const fileName = this._generateFileName('watermarked');
            const outputPath = path.join(this.outputDir, fileName);

            await this._ensureOutputDir();

            const watermarkOptions = {
                ...this.defaultOptions.watermark,
                ...options
            };

            await sharp(input)
                .composite([{
                    input: await this._createWatermarkBuffer(watermarkOptions),
                    gravity: 'center'
                }])
                .toFile(outputPath);

            return outputPath;
        } catch (error) {
            logger.error('Error adding watermark:', error);
            throw error;
        }
    }

    /**
     * Create image collage
     * @param {Array<string|Buffer>} images - Input images
     * @param {Object} options - Collage options
     * @returns {Promise<string>} Collage image path
     */
    async createCollage(images, options = {}) {
        try {
            const {
                columns = 2,
                spacing = 10,
                background = { r: 255, g: 255, b: 255, alpha: 1 }
            } = options;

            const fileName = this._generateFileName('collage');
            const outputPath = path.join(this.outputDir, fileName);

            await this._ensureOutputDir();

            // Process all images to same size
            const processedImages = await Promise.all(
                images.map(image => 
                    sharp(image)
                        .resize(400, 400, { fit: 'contain' })
                        .toBuffer()
                )
            );

            const rows = Math.ceil(images.length / columns);
            const width = (400 * columns) + (spacing * (columns + 1));
            const height = (400 * rows) + (spacing * (rows + 1));

            // Create blank canvas
            const canvas = sharp({
                create: {
                    width,
                    height,
                    channels: 4,
                    background
                }
            });

            // Position images
            const composites = processedImages.map((buffer, index) => ({
                input: buffer,
                left: spacing + (index % columns) * (400 + spacing),
                top: spacing + Math.floor(index / columns) * (400 + spacing)
            }));

            await canvas
                .composite(composites)
                .toFile(outputPath);

            return outputPath;
        } catch (error) {
            logger.error('Error creating collage:', error);
            throw error;
        }
    }

    /**
     * Process image
     * @param {string|Buffer} input - Input image
     * @param {string} fileName - Output file name
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processed image paths
     * @private
     */
    async _processImage(input, fileName, options) {
        await this._ensureOutputDir();

        const mainPath = path.join(this.outputDir, `main_${fileName}`);
        const thumbPath = path.join(this.outputDir, `thumb_${fileName}`);

        // Process main image
        await sharp(input)
            .resize(options.product.width, options.product.height, {
                fit: options.product.fit,
                background: options.product.background
            })
            .jpeg({ quality: options.quality })
            .toFile(mainPath);

        // Create thumbnail
        await sharp(input)
            .resize(options.thumbnail.width, options.thumbnail.height, {
                fit: options.thumbnail.fit
            })
            .jpeg({ quality: options.quality })
            .toFile(thumbPath);

        return {
            mainImage: mainPath,
            thumbnail: thumbPath
        };
    }

    /**
     * Process document
     * @param {string|Buffer} input - Input document
     * @param {string} fileName - Output file name
     * @param {Object} options - Processing options
     * @returns {Promise<string>} Processed document path
     * @private
     */
    async _processDocument(input, fileName, options) {
        await this._ensureOutputDir();

        const outputPath = path.join(this.outputDir, fileName);
        let pipeline = sharp(input);

        if (options.grayscale) {
            pipeline = pipeline.grayscale();
        }

        if (options.sharpen) {
            pipeline = pipeline.sharpen();
        }

        if (options.contrast) {
            pipeline = pipeline.normalise();
        }

        await pipeline
            .jpeg({ quality: 90 })
            .toFile(outputPath);

        return outputPath;
    }

    /**
     * Create watermark buffer
     * @param {Object} options - Watermark options
     * @returns {Promise<Buffer>} Watermark buffer
     * @private
     */
    async _createWatermarkBuffer(options) {
        const { text, fontSize, opacity } = options;
        const svg = `
            <svg width="500" height="100">
                <style>
                    .watermark { 
                        fill: rgba(0, 0, 0, ${opacity});
                        font-size: ${fontSize}px;
                        font-family: Arial;
                    }
                </style>
                <text x="50%" y="50%" text-anchor="middle" class="watermark">
                    ${text}
                </text>
            </svg>
        `;

        return Buffer.from(svg);
    }

    /**
     * Generate file name
     * @param {string} prefix - File name prefix
     * @returns {string} Generated file name
     * @private
     */
    _generateFileName(prefix) {
        return `${prefix}_${Date.now()}.jpg`;
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
     * Get image metadata
     * @param {string|Buffer} input - Input image
     * @returns {Promise<Object>} Image metadata
     */
    async getMetadata(input) {
        try {
            const metadata = await sharp(input).metadata();
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                space: metadata.space,
                channels: metadata.channels,
                depth: metadata.depth,
                density: metadata.density,
                hasAlpha: metadata.hasAlpha,
                size: metadata.size
            };
        } catch (error) {
            logger.error('Error getting image metadata:', error);
            throw error;
        }
    }

    /**
     * Optimize image
     * @param {string|Buffer} input - Input image
     * @param {Object} options - Optimization options
     * @returns {Promise<Buffer>} Optimized image buffer
     */
    async optimizeImage(input, options = {}) {
        try {
            const {
                quality = 80,
                format = 'jpeg',
                maxWidth = 1920,
                maxHeight = 1080
            } = options;

            const metadata = await this.getMetadata(input);
            let pipeline = sharp(input);

            // Resize if image is larger than max dimensions
            if (metadata.width > maxWidth || metadata.height > maxHeight) {
                pipeline = pipeline.resize(maxWidth, maxHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }

            // Convert and optimize
            switch (format) {
                case 'jpeg':
                    return await pipeline.jpeg({ quality }).toBuffer();
                case 'png':
                    return await pipeline.png({ quality }).toBuffer();
                case 'webp':
                    return await pipeline.webp({ quality }).toBuffer();
                default:
                    throw new Error('Unsupported format');
            }
        } catch (error) {
            logger.error('Error optimizing image:', error);
            throw error;
        }
    }
}

module.exports = new ImageProcessor();
