const zlib = require('zlib');
const tar = require('tar');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const logger = require('./logger');

// Promisify zlib methods
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);
const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

/**
 * Compression Helper Utility
 */
class CompressionHelper {
    constructor() {
        this.outputDir = path.join(process.cwd(), 'storage', 'archives');
        this.defaultOptions = {
            gzip: {
                level: zlib.constants.Z_BEST_COMPRESSION
            },
            brotli: {
                params: {
                    [zlib.constants.BROTLI_PARAM_QUALITY]: 11
                }
            },
            tar: {
                gzip: true,
                portable: true,
                preservePaths: true
            }
        };
    }

    /**
     * Compress data using gzip
     * @param {Buffer|string} data - Data to compress
     * @param {Object} options - Compression options
     * @returns {Promise<Buffer>} Compressed data
     */
    async compressGzip(data, options = {}) {
        try {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            return await gzip(buffer, {
                ...this.defaultOptions.gzip,
                ...options
            });
        } catch (error) {
            logger.error('Error compressing data with gzip:', error);
            throw error;
        }
    }

    /**
     * Decompress gzip data
     * @param {Buffer} data - Data to decompress
     * @returns {Promise<Buffer>} Decompressed data
     */
    async decompressGzip(data) {
        try {
            return await gunzip(data);
        } catch (error) {
            logger.error('Error decompressing gzip data:', error);
            throw error;
        }
    }

    /**
     * Compress data using Brotli
     * @param {Buffer|string} data - Data to compress
     * @param {Object} options - Compression options
     * @returns {Promise<Buffer>} Compressed data
     */
    async compressBrotli(data, options = {}) {
        try {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            return await brotliCompress(buffer, {
                ...this.defaultOptions.brotli,
                ...options
            });
        } catch (error) {
            logger.error('Error compressing data with Brotli:', error);
            throw error;
        }
    }

    /**
     * Decompress Brotli data
     * @param {Buffer} data - Data to decompress
     * @returns {Promise<Buffer>} Decompressed data
     */
    async decompressBrotli(data) {
        try {
            return await brotliDecompress(data);
        } catch (error) {
            logger.error('Error decompressing Brotli data:', error);
            throw error;
        }
    }

    /**
     * Create tar archive
     * @param {string|Array} source - Source path(s)
     * @param {string} outputName - Output file name
     * @param {Object} options - Archive options
     * @returns {Promise<string>} Archive path
     */
    async createArchive(source, outputName, options = {}) {
        try {
            await this._ensureOutputDir();

            const outputPath = path.join(this.outputDir, outputName);
            const sources = Array.isArray(source) ? source : [source];

            await tar.create(
                {
                    ...this.defaultOptions.tar,
                    ...options,
                    file: outputPath
                },
                sources
            );

            return outputPath;
        } catch (error) {
            logger.error('Error creating archive:', error);
            throw error;
        }
    }

    /**
     * Extract tar archive
     * @param {string} archivePath - Archive path
     * @param {string} outputDir - Output directory
     * @param {Object} options - Extraction options
     * @returns {Promise<string>} Extraction path
     */
    async extractArchive(archivePath, outputDir, options = {}) {
        try {
            await fs.mkdir(outputDir, { recursive: true });

            await tar.extract({
                file: archivePath,
                cwd: outputDir,
                ...options
            });

            return outputDir;
        } catch (error) {
            logger.error('Error extracting archive:', error);
            throw error;
        }
    }

    /**
     * Create backup archive
     * @param {Object} options - Backup options
     * @returns {Promise<string>} Backup path
     */
    async createBackup(options = {}) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `backup_${timestamp}.tar.gz`;
            const backupPath = path.join(this.outputDir, 'backups', backupName);

            // Ensure backup directory exists
            await fs.mkdir(path.dirname(backupPath), { recursive: true });

            // Define paths to backup
            const paths = [
                'public/uploads',
                'storage/documents',
                ...options.additionalPaths || []
            ].filter(async p => {
                try {
                    await fs.access(p);
                    return true;
                } catch {
                    return false;
                }
            });

            // Create archive
            await this.createArchive(paths, backupPath, {
                gzip: true,
                ...options
            });

            return backupPath;
        } catch (error) {
            logger.error('Error creating backup:', error);
            throw error;
        }
    }

    /**
     * Restore from backup
     * @param {string} backupPath - Backup path
     * @param {Object} options - Restore options
     * @returns {Promise<void>}
     */
    async restoreFromBackup(backupPath, options = {}) {
        try {
            const restoreDir = path.join(this.outputDir, 'restore');
            await this.extractArchive(backupPath, restoreDir, options);

            // Move restored files to their original locations
            const entries = await fs.readdir(restoreDir, { withFileTypes: true });
            for (const entry of entries) {
                const sourcePath = path.join(restoreDir, entry.name);
                const targetPath = path.join(process.cwd(), entry.name);

                if (entry.isDirectory()) {
                    await fs.mkdir(targetPath, { recursive: true });
                    await this._copyDir(sourcePath, targetPath);
                } else {
                    await fs.copyFile(sourcePath, targetPath);
                }
            }

            // Clean up restore directory
            await this._removeDir(restoreDir);
        } catch (error) {
            logger.error('Error restoring from backup:', error);
            throw error;
        }
    }

    /**
     * Compress file
     * @param {string} filePath - File path
     * @param {string} algorithm - Compression algorithm
     * @returns {Promise<string>} Compressed file path
     */
    async compressFile(filePath, algorithm = 'gzip') {
        try {
            const content = await fs.readFile(filePath);
            let compressed;

            switch (algorithm) {
                case 'gzip':
                    compressed = await this.compressGzip(content);
                    break;
                case 'brotli':
                    compressed = await this.compressBrotli(content);
                    break;
                default:
                    throw new Error('Unsupported compression algorithm');
            }

            const outputPath = `${filePath}.${algorithm}`;
            await fs.writeFile(outputPath, compressed);
            return outputPath;
        } catch (error) {
            logger.error('Error compressing file:', error);
            throw error;
        }
    }

    /**
     * Decompress file
     * @param {string} filePath - File path
     * @param {string} algorithm - Compression algorithm
     * @returns {Promise<string>} Decompressed file path
     */
    async decompressFile(filePath, algorithm = 'gzip') {
        try {
            const content = await fs.readFile(filePath);
            let decompressed;

            switch (algorithm) {
                case 'gzip':
                    decompressed = await this.decompressGzip(content);
                    break;
                case 'brotli':
                    decompressed = await this.decompressBrotli(content);
                    break;
                default:
                    throw new Error('Unsupported compression algorithm');
            }

            const outputPath = filePath.replace(new RegExp(`\\.${algorithm}$`), '');
            await fs.writeFile(outputPath, decompressed);
            return outputPath;
        } catch (error) {
            logger.error('Error decompressing file:', error);
            throw error;
        }
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
     * Copy directory recursively
     * @param {string} src - Source path
     * @param {string} dest - Destination path
     * @returns {Promise<void>}
     * @private
     */
    async _copyDir(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                await this._copyDir(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    /**
     * Remove directory recursively
     * @param {string} dir - Directory path
     * @returns {Promise<void>}
     * @private
     */
    async _removeDir(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await this._removeDir(fullPath);
            } else {
                await fs.unlink(fullPath);
            }
        }

        await fs.rmdir(dir);
    }
}

module.exports = new CompressionHelper();
