const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');
const config = require('./config');
const StringHelper = require('./stringHelper');

/**
 * Documentation Generator Utility
 */
class DocGenerator {
    constructor() {
        this.baseDir = process.cwd();
        this.docsDir = path.join(this.baseDir, 'docs');
        this.swaggerOptions = {
            definition: {
                openapi: '3.0.0',
                info: {
                    title: 'Inventory Management System API',
                    version: '1.0.0',
                    description: 'API documentation for the Inventory Management System',
                    contact: {
                        name: 'API Support',
                        email: 'support@example.com'
                    },
                    license: {
                        name: 'MIT',
                        url: 'https://opensource.org/licenses/MIT'
                    }
                },
                servers: [
                    {
                        url: `http://localhost:${config.get('server.port')}`,
                        description: 'Development server'
                    }
                ],
                components: {
                    securitySchemes: {
                        bearerAuth: {
                            type: 'http',
                            scheme: 'bearer',
                            bearerFormat: 'JWT'
                        }
                    }
                },
                security: [{
                    bearerAuth: []
                }]
            },
            apis: [
                './src/routes/*.js',
                './src/models/*.js',
                './src/controllers/*.js'
            ]
        };
    }

    /**
     * Generate OpenAPI specification
     * @returns {Object} OpenAPI specification
     */
    generateOpenApiSpec() {
        try {
            const spec = swaggerJsdoc(this.swaggerOptions);
            return spec;
        } catch (error) {
            logger.error('Error generating OpenAPI spec:', error);
            throw error;
        }
    }

    /**
     * Generate API documentation
     * @returns {Promise<void>}
     */
    async generateApiDocs() {
        try {
            // Ensure docs directory exists
            await fs.mkdir(this.docsDir, { recursive: true });

            // Generate OpenAPI spec
            const spec = this.generateOpenApiSpec();
            await fs.writeFile(
                path.join(this.docsDir, 'openapi.json'),
                JSON.stringify(spec, null, 2)
            );

            // Generate markdown documentation
            const markdown = await this.generateMarkdownDocs(spec);
            await fs.writeFile(
                path.join(this.docsDir, 'api.md'),
                markdown
            );

            logger.info('Generated API documentation');
        } catch (error) {
            logger.error('Error generating API docs:', error);
            throw error;
        }
    }

    /**
     * Generate markdown documentation from OpenAPI spec
     * @param {Object} spec - OpenAPI specification
     * @returns {Promise<string>} Markdown documentation
     */
    async generateMarkdownDocs(spec) {
        const sections = [];

        // Add header
        sections.push(`# ${spec.info.title}\n`);
        sections.push(`${spec.info.description}\n`);
        sections.push(`Version: ${spec.info.version}\n`);

        // Add table of contents
        sections.push('## Table of Contents\n');
        sections.push('- [Authentication](#authentication)');
        sections.push('- [Endpoints](#endpoints)\n');

        // Add authentication section
        sections.push('## Authentication\n');
        sections.push('This API uses Bearer token authentication. Include the JWT token in the Authorization header:\n');
        sections.push('```\nAuthorization: Bearer <token>\n```\n');

        // Add endpoints section
        sections.push('## Endpoints\n');
        
        // Group endpoints by tag
        const endpointsByTag = {};
        Object.entries(spec.paths).forEach(([path, methods]) => {
            Object.entries(methods).forEach(([method, endpoint]) => {
                const tag = endpoint.tags?.[0] || 'Other';
                if (!endpointsByTag[tag]) {
                    endpointsByTag[tag] = [];
                }
                endpointsByTag[tag].push({
                    path,
                    method: method.toUpperCase(),
                    ...endpoint
                });
            });
        });

        // Add endpoints documentation
        Object.entries(endpointsByTag).forEach(([tag, endpoints]) => {
            sections.push(`### ${tag}\n`);
            
            endpoints.forEach(endpoint => {
                sections.push(`#### ${endpoint.summary || endpoint.path}\n`);
                sections.push(`\`${endpoint.method} ${endpoint.path}\`\n`);
                
                if (endpoint.description) {
                    sections.push(`${endpoint.description}\n`);
                }

                // Add parameters
                if (endpoint.parameters?.length > 0) {
                    sections.push('**Parameters:**\n');
                    sections.push('| Name | In | Type | Required | Description |');
                    sections.push('|------|----|----|----------|-------------|');
                    endpoint.parameters.forEach(param => {
                        sections.push(
                            `| ${param.name} | ${param.in} | ${param.schema?.type || 'any'} | ${
                                param.required ? 'Yes' : 'No'
                            } | ${param.description || '-'} |`
                        );
                    });
                    sections.push('');
                }

                // Add request body
                if (endpoint.requestBody) {
                    sections.push('**Request Body:**\n');
                    const content = endpoint.requestBody.content['application/json'];
                    if (content?.schema) {
                        sections.push('```json');
                        sections.push(JSON.stringify(this._generateExample(content.schema), null, 2));
                        sections.push('```\n');
                    }
                }

                // Add responses
                sections.push('**Responses:**\n');
                Object.entries(endpoint.responses).forEach(([code, response]) => {
                    sections.push(`- \`${code}\`: ${response.description}`);
                });
                sections.push('');
            });
        });

        return sections.join('\n');
    }

    /**
     * Generate example value from schema
     * @param {Object} schema - JSON schema
     * @returns {any} Example value
     * @private
     */
    _generateExample(schema) {
        if (schema.example) {
            return schema.example;
        }

        switch (schema.type) {
            case 'object':
                const obj = {};
                if (schema.properties) {
                    Object.entries(schema.properties).forEach(([key, prop]) => {
                        obj[key] = this._generateExample(prop);
                    });
                }
                return obj;

            case 'array':
                return [this._generateExample(schema.items)];

            case 'string':
                switch (schema.format) {
                    case 'date-time':
                        return new Date().toISOString();
                    case 'email':
                        return 'user@example.com';
                    case 'uuid':
                        return '00000000-0000-0000-0000-000000000000';
                    default:
                        return 'string';
                }

            case 'number':
            case 'integer':
                return 0;

            case 'boolean':
                return false;

            default:
                return null;
        }
    }

    /**
     * Generate route documentation
     * @param {Object} route - Express route object
     * @returns {Object} Route documentation
     */
    generateRouteDoc(route) {
        const doc = {
            path: route.path,
            methods: Object.keys(route.methods),
            middleware: [],
            params: [],
            query: [],
            body: {}
        };

        // Extract middleware documentation
        route.stack.forEach(layer => {
            if (layer.name !== '<anonymous>') {
                doc.middleware.push(layer.name);
            }
        });

        return doc;
    }

    /**
     * Generate model documentation
     * @param {Object} model - Prisma model
     * @returns {Object} Model documentation
     */
    generateModelDoc(model) {
        const doc = {
            name: model.name,
            fields: {},
            relations: {}
        };

        // Document fields
        Object.entries(model.fields).forEach(([name, field]) => {
            doc.fields[name] = {
                type: field.type,
                required: !field.isNullable,
                default: field.default,
                unique: field.isUnique || false
            };
        });

        // Document relations
        Object.entries(model.fields).forEach(([name, field]) => {
            if (field.relationName) {
                doc.relations[name] = {
                    type: field.type,
                    model: field.type,
                    relation: field.relationName
                };
            }
        });

        return doc;
    }
}

module.exports = new DocGenerator();
