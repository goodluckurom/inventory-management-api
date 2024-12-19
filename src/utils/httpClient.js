const axios = require('axios');
const logger = require('./logger');
const { ResponseHandler } = require('./responseHandler');

/**
 * HTTP Client Utility
 */
class HttpClient {
    constructor(baseURL = '', options = {}) {
        this.client = axios.create({
            baseURL,
            timeout: options.timeout || 30000,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        // Add request interceptor
        this.client.interceptors.request.use(
            (config) => {
                // Log request
                logger.debug({
                    type: 'http_request',
                    method: config.method.toUpperCase(),
                    url: config.url,
                    headers: this._sanitizeHeaders(config.headers),
                    data: config.data
                });

                return config;
            },
            (error) => {
                logger.error('Request error:', error);
                return Promise.reject(error);
            }
        );

        // Add response interceptor
        this.client.interceptors.response.use(
            (response) => {
                // Log response
                logger.debug({
                    type: 'http_response',
                    status: response.status,
                    url: response.config.url,
                    data: response.data
                });

                return response;
            },
            (error) => {
                this._handleError(error);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Make GET request
     * @param {string} url - Request URL
     * @param {Object} config - Additional config
     * @returns {Promise} Request promise
     */
    async get(url, config = {}) {
        try {
            const response = await this.client.get(url, config);
            return response.data;
        } catch (error) {
            throw this._formatError(error);
        }
    }

    /**
     * Make POST request
     * @param {string} url - Request URL
     * @param {Object} data - Request data
     * @param {Object} config - Additional config
     * @returns {Promise} Request promise
     */
    async post(url, data = {}, config = {}) {
        try {
            const response = await this.client.post(url, data, config);
            return response.data;
        } catch (error) {
            throw this._formatError(error);
        }
    }

    /**
     * Make PUT request
     * @param {string} url - Request URL
     * @param {Object} data - Request data
     * @param {Object} config - Additional config
     * @returns {Promise} Request promise
     */
    async put(url, data = {}, config = {}) {
        try {
            const response = await this.client.put(url, data, config);
            return response.data;
        } catch (error) {
            throw this._formatError(error);
        }
    }

    /**
     * Make PATCH request
     * @param {string} url - Request URL
     * @param {Object} data - Request data
     * @param {Object} config - Additional config
     * @returns {Promise} Request promise
     */
    async patch(url, data = {}, config = {}) {
        try {
            const response = await this.client.patch(url, data, config);
            return response.data;
        } catch (error) {
            throw this._formatError(error);
        }
    }

    /**
     * Make DELETE request
     * @param {string} url - Request URL
     * @param {Object} config - Additional config
     * @returns {Promise} Request promise
     */
    async delete(url, config = {}) {
        try {
            const response = await this.client.delete(url, config);
            return response.data;
        } catch (error) {
            throw this._formatError(error);
        }
    }

    /**
     * Upload file
     * @param {string} url - Upload URL
     * @param {FormData} formData - Form data with file
     * @param {Object} config - Additional config
     * @returns {Promise} Upload promise
     */
    async uploadFile(url, formData, config = {}) {
        try {
            const response = await this.client.post(url, formData, {
                ...config,
                headers: {
                    'Content-Type': 'multipart/form-data',
                    ...config.headers
                }
            });
            return response.data;
        } catch (error) {
            throw this._formatError(error);
        }
    }

    /**
     * Download file
     * @param {string} url - Download URL
     * @param {Object} config - Additional config
     * @returns {Promise} Download promise
     */
    async downloadFile(url, config = {}) {
        try {
            const response = await this.client.get(url, {
                ...config,
                responseType: 'blob'
            });
            return response.data;
        } catch (error) {
            throw this._formatError(error);
        }
    }

    /**
     * Make multiple requests concurrently
     * @param {Array} requests - Array of request configs
     * @returns {Promise} Promise resolving to array of responses
     */
    async all(requests) {
        try {
            const promises = requests.map(request => {
                const { method = 'get', url, data, ...config } = request;
                return this.client[method.toLowerCase()](url, data, config);
            });

            const responses = await Promise.all(promises);
            return responses.map(response => response.data);
        } catch (error) {
            throw this._formatError(error);
        }
    }

    /**
     * Set authorization header
     * @param {string} token - Authorization token
     */
    setAuthToken(token) {
        this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    /**
     * Clear authorization header
     */
    clearAuthToken() {
        delete this.client.defaults.headers.common['Authorization'];
    }

    /**
     * Handle error response
     * @param {Error} error - Error object
     * @private
     */
    _handleError(error) {
        if (error.response) {
            // Log error response
            logger.error({
                type: 'http_error',
                status: error.response.status,
                url: error.config.url,
                data: error.response.data
            });
        } else if (error.request) {
            // Log request error
            logger.error({
                type: 'http_request_error',
                url: error.config.url,
                message: error.message
            });
        } else {
            // Log general error
            logger.error({
                type: 'http_error',
                message: error.message
            });
        }
    }

    /**
     * Format error for consistent error handling
     * @param {Error} error - Error object
     * @returns {Error} Formatted error
     * @private
     */
    _formatError(error) {
        if (error.response) {
            return {
                status: error.response.status,
                data: error.response.data,
                message: error.response.data?.message || error.message,
                code: error.response.data?.code
            };
        }
        return {
            status: 500,
            message: error.message,
            code: 'NETWORK_ERROR'
        };
    }

    /**
     * Sanitize headers for logging
     * @param {Object} headers - Headers object
     * @returns {Object} Sanitized headers
     * @private
     */
    _sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
        
        sensitiveHeaders.forEach(header => {
            if (sanitized[header]) {
                sanitized[header] = '********';
            }
        });

        return sanitized;
    }
}

// Create instances for common external services
const httpClient = new HttpClient();

// Example service-specific clients
const externalServiceClient = new HttpClient(process.env.EXTERNAL_SERVICE_URL, {
    timeout: 5000,
    headers: {
        'x-api-key': process.env.EXTERNAL_SERVICE_API_KEY
    }
});

module.exports = {
    HttpClient,
    httpClient,
    externalServiceClient
};
