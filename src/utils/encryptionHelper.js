const crypto = require('crypto');
const logger = require('./logger');
const config = require('./config');

/**
 * Encryption Helper Utility
 */
class EncryptionHelper {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16; // 128 bits
        this.saltLength = 64;
        this.tagLength = 16;
        this.encoding = 'hex';
        
        // Get encryption key from config or generate one
        this.key = this._getEncryptionKey();
    }

    /**
     * Encrypt data
     * @param {string|Object} data - Data to encrypt
     * @returns {string} Encrypted data
     */
    encrypt(data) {
        try {
            // Convert objects to JSON string
            const stringData = typeof data === 'object' ? JSON.stringify(data) : String(data);

            // Generate salt and IV
            const salt = crypto.randomBytes(this.saltLength);
            const iv = crypto.randomBytes(this.ivLength);

            // Create key with salt
            const key = this._deriveKey(this.key, salt);

            // Create cipher
            const cipher = crypto.createCipheriv(this.algorithm, key, iv);

            // Encrypt data
            let encrypted = cipher.update(stringData, 'utf8', this.encoding);
            encrypted += cipher.final(this.encoding);

            // Get auth tag
            const tag = cipher.getAuthTag();

            // Combine all components
            const result = Buffer.concat([
                salt,
                iv,
                tag,
                Buffer.from(encrypted, this.encoding)
            ]);

            return result.toString(this.encoding);
        } catch (error) {
            logger.error('Error encrypting data:', error);
            throw new Error('Encryption failed');
        }
    }

    /**
     * Decrypt data
     * @param {string} encryptedData - Data to decrypt
     * @returns {string|Object} Decrypted data
     */
    decrypt(encryptedData) {
        try {
            // Convert from hex to buffer
            const buffer = Buffer.from(encryptedData, this.encoding);

            // Extract components
            const salt = buffer.slice(0, this.saltLength);
            const iv = buffer.slice(this.saltLength, this.saltLength + this.ivLength);
            const tag = buffer.slice(
                this.saltLength + this.ivLength,
                this.saltLength + this.ivLength + this.tagLength
            );
            const encrypted = buffer.slice(this.saltLength + this.ivLength + this.tagLength);

            // Derive key with salt
            const key = this._deriveKey(this.key, salt);

            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
            decipher.setAuthTag(tag);

            // Decrypt data
            let decrypted = decipher.update(encrypted, this.encoding, 'utf8');
            decrypted += decipher.final('utf8');

            // Try to parse JSON if possible
            try {
                return JSON.parse(decrypted);
            } catch {
                return decrypted;
            }
        } catch (error) {
            logger.error('Error decrypting data:', error);
            throw new Error('Decryption failed');
        }
    }

    /**
     * Hash data
     * @param {string} data - Data to hash
     * @param {string} salt - Optional salt
     * @returns {string} Hashed data
     */
    hash(data, salt = null) {
        try {
            const useSalt = salt || crypto.randomBytes(16).toString('hex');
            const hash = crypto.pbkdf2Sync(
                data,
                useSalt,
                10000,
                64,
                'sha512'
            ).toString('hex');

            return `${useSalt}:${hash}`;
        } catch (error) {
            logger.error('Error hashing data:', error);
            throw new Error('Hashing failed');
        }
    }

    /**
     * Verify hash
     * @param {string} data - Data to verify
     * @param {string} hashedData - Hashed data to compare against
     * @returns {boolean} Whether hash matches
     */
    verifyHash(data, hashedData) {
        try {
            const [salt, originalHash] = hashedData.split(':');
            const hash = crypto.pbkdf2Sync(
                data,
                salt,
                10000,
                64,
                'sha512'
            ).toString('hex');

            return hash === originalHash;
        } catch (error) {
            logger.error('Error verifying hash:', error);
            throw new Error('Hash verification failed');
        }
    }

    /**
     * Generate random token
     * @param {number} length - Token length
     * @returns {string} Random token
     */
    generateToken(length = 32) {
        try {
            return crypto.randomBytes(length).toString('hex');
        } catch (error) {
            logger.error('Error generating token:', error);
            throw new Error('Token generation failed');
        }
    }

    /**
     * Encrypt sensitive fields in object
     * @param {Object} data - Object containing data
     * @param {Array} fields - Fields to encrypt
     * @returns {Object} Object with encrypted fields
     */
    encryptFields(data, fields) {
        try {
            const encrypted = { ...data };
            fields.forEach(field => {
                if (encrypted[field]) {
                    encrypted[field] = this.encrypt(encrypted[field]);
                }
            });
            return encrypted;
        } catch (error) {
            logger.error('Error encrypting fields:', error);
            throw new Error('Field encryption failed');
        }
    }

    /**
     * Decrypt sensitive fields in object
     * @param {Object} data - Object containing data
     * @param {Array} fields - Fields to decrypt
     * @returns {Object} Object with decrypted fields
     */
    decryptFields(data, fields) {
        try {
            const decrypted = { ...data };
            fields.forEach(field => {
                if (decrypted[field]) {
                    decrypted[field] = this.decrypt(decrypted[field]);
                }
            });
            return decrypted;
        } catch (error) {
            logger.error('Error decrypting fields:', error);
            throw new Error('Field decryption failed');
        }
    }

    /**
     * Get encryption key
     * @returns {Buffer} Encryption key
     * @private
     */
    _getEncryptionKey() {
        const configKey = config.get('encryption.key');
        if (configKey) {
            return Buffer.from(configKey, 'hex');
        }

        // Generate new key if not configured
        const key = crypto.randomBytes(this.keyLength);
        logger.warn('Using generated encryption key. Consider setting a permanent key in configuration.');
        return key;
    }

    /**
     * Derive key from password and salt
     * @param {Buffer} password - Password buffer
     * @param {Buffer} salt - Salt buffer
     * @returns {Buffer} Derived key
     * @private
     */
    _deriveKey(password, salt) {
        return crypto.pbkdf2Sync(
            password,
            salt,
            100000,
            this.keyLength,
            'sha512'
        );
    }

    /**
     * Generate secure random string
     * @param {number} length - String length
     * @param {string} charset - Character set to use
     * @returns {string} Random string
     */
    generateSecureString(length = 16, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
        try {
            const randomBytes = crypto.randomBytes(length);
            const result = new Array(length);
            const charsetLength = charset.length;

            for (let i = 0; i < length; i++) {
                result[i] = charset[randomBytes[i] % charsetLength];
            }

            return result.join('');
        } catch (error) {
            logger.error('Error generating secure string:', error);
            throw new Error('Secure string generation failed');
        }
    }

    /**
     * Generate key pair
     * @returns {Object} Key pair
     */
    generateKeyPair() {
        try {
            const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            });

            return { publicKey, privateKey };
        } catch (error) {
            logger.error('Error generating key pair:', error);
            throw new Error('Key pair generation failed');
        }
    }
}

module.exports = new EncryptionHelper();
