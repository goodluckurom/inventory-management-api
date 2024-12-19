const logger = require('./logger');
const StringHelper = require('./stringHelper');
const DateHelper = require('./dateHelper');
const CurrencyHelper = require('./currencyHelper');

/**
 * Data Transformer Utility
 */
class DataTransformer {
    /**
     * Transform database model to API response
     * @param {Object} model - Database model
     * @param {string} type - Model type
     * @returns {Object} Transformed data
     */
    transformModelToResponse(model, type) {
        try {
            switch (type) {
                case 'product':
                    return this._transformProduct(model);
                case 'supplier':
                    return this._transformSupplier(model);
                case 'order':
                    return this._transformOrder(model);
                case 'warehouse':
                    return this._transformWarehouse(model);
                default:
                    return model;
            }
        } catch (error) {
            logger.error('Error transforming model to response:', error);
            throw error;
        }
    }

    /**
     * Transform API request to database model
     * @param {Object} data - Request data
     * @param {string} type - Model type
     * @returns {Object} Transformed data
     */
    transformRequestToModel(data, type) {
        try {
            switch (type) {
                case 'product':
                    return this._transformProductRequest(data);
                case 'supplier':
                    return this._transformSupplierRequest(data);
                case 'order':
                    return this._transformOrderRequest(data);
                case 'warehouse':
                    return this._transformWarehouseRequest(data);
                default:
                    return data;
            }
        } catch (error) {
            logger.error('Error transforming request to model:', error);
            throw error;
        }
    }

    /**
     * Transform product model
     * @param {Object} product - Product model
     * @returns {Object} Transformed product
     * @private
     */
    _transformProduct(product) {
        return {
            id: product.id,
            sku: product.sku,
            name: product.name,
            description: product.description,
            category: {
                id: product.category?.id,
                name: product.category?.name
            },
            brand: {
                id: product.brand?.id,
                name: product.brand?.name
            },
            price: CurrencyHelper.formatPrice(product.price),
            costPrice: CurrencyHelper.formatPrice(product.costPrice),
            quantity: product.quantity,
            unit: product.unit,
            location: {
                warehouse: product.warehouse?.name,
                zone: product.zone?.name,
                position: product.location
            },
            suppliers: product.suppliers?.map(supplier => ({
                id: supplier.supplier.id,
                name: supplier.supplier.name,
                price: CurrencyHelper.formatPrice(supplier.price),
                leadTime: supplier.leadTime
            })),
            status: product.status,
            metadata: {
                createdAt: DateHelper.formatDate(product.createdAt),
                updatedAt: DateHelper.formatDate(product.updatedAt)
            }
        };
    }

    /**
     * Transform supplier model
     * @param {Object} supplier - Supplier model
     * @returns {Object} Transformed supplier
     * @private
     */
    _transformSupplier(supplier) {
        return {
            id: supplier.id,
            code: supplier.code,
            name: supplier.name,
            type: supplier.type,
            contact: {
                email: supplier.email,
                phone: supplier.phone,
                person: supplier.contactPerson
            },
            address: supplier.address && {
                street: supplier.address.street,
                city: supplier.address.city,
                state: supplier.address.state,
                country: supplier.address.country,
                postalCode: supplier.address.postalCode
            },
            products: supplier.products?.map(product => ({
                id: product.product.id,
                name: product.product.name,
                sku: product.product.sku,
                price: CurrencyHelper.formatPrice(product.price)
            })),
            metadata: {
                createdAt: DateHelper.formatDate(supplier.createdAt),
                updatedAt: DateHelper.formatDate(supplier.updatedAt)
            }
        };
    }

    /**
     * Transform order model
     * @param {Object} order - Order model
     * @returns {Object} Transformed order
     * @private
     */
    _transformOrder(order) {
        return {
            id: order.id,
            orderNumber: order.orderNumber,
            type: order.type,
            status: order.status,
            items: order.items?.map(item => ({
                product: {
                    id: item.product.id,
                    name: item.product.name,
                    sku: item.product.sku
                },
                quantity: item.quantity,
                unitPrice: CurrencyHelper.formatPrice(item.unitPrice),
                total: CurrencyHelper.formatPrice(item.totalPrice)
            })),
            totals: {
                subtotal: CurrencyHelper.formatPrice(order.totalAmount),
                tax: CurrencyHelper.formatPrice(order.tax),
                shipping: CurrencyHelper.formatPrice(order.shippingCost),
                total: CurrencyHelper.formatPrice(
                    order.totalAmount + order.tax + order.shippingCost
                )
            },
            dates: {
                created: DateHelper.formatDate(order.createdAt),
                updated: DateHelper.formatDate(order.updatedAt),
                expected: order.expectedDate && DateHelper.formatDate(order.expectedDate),
                delivered: order.deliveryDate && DateHelper.formatDate(order.deliveryDate)
            }
        };
    }

    /**
     * Transform warehouse model
     * @param {Object} warehouse - Warehouse model
     * @returns {Object} Transformed warehouse
     * @private
     */
    _transformWarehouse(warehouse) {
        return {
            id: warehouse.id,
            code: warehouse.code,
            name: warehouse.name,
            type: warehouse.type,
            address: warehouse.address && {
                street: warehouse.address.street,
                city: warehouse.address.city,
                state: warehouse.address.state,
                country: warehouse.address.country,
                postalCode: warehouse.address.postalCode
            },
            zones: warehouse.zones?.map(zone => ({
                id: zone.id,
                name: zone.name,
                code: zone.code
            })),
            capacity: warehouse.capacity,
            staff: warehouse.staff?.map(user => ({
                id: user.id,
                name: `${user.firstName} ${user.lastName}`,
                role: user.role
            })),
            metadata: {
                createdAt: DateHelper.formatDate(warehouse.createdAt),
                updatedAt: DateHelper.formatDate(warehouse.updatedAt)
            }
        };
    }

    /**
     * Transform product request
     * @param {Object} data - Request data
     * @returns {Object} Transformed data
     * @private
     */
    _transformProductRequest(data) {
        return {
            sku: data.sku,
            name: data.name,
            description: data.description,
            categoryId: data.category?.id || data.categoryId,
            brandId: data.brand?.id || data.brandId,
            price: parseFloat(data.price),
            costPrice: parseFloat(data.costPrice),
            quantity: parseInt(data.quantity),
            unit: data.unit,
            warehouseId: data.location?.warehouseId || data.warehouseId,
            location: data.location?.position || data.location,
            suppliers: data.suppliers?.map(supplier => ({
                supplierId: supplier.id,
                price: parseFloat(supplier.price),
                leadTime: parseInt(supplier.leadTime)
            }))
        };
    }

    /**
     * Transform supplier request
     * @param {Object} data - Request data
     * @returns {Object} Transformed data
     * @private
     */
    _transformSupplierRequest(data) {
        return {
            code: data.code,
            name: data.name,
            type: data.type,
            email: data.contact?.email || data.email,
            phone: data.contact?.phone || data.phone,
            contactPerson: data.contact?.person || data.contactPerson,
            address: data.address && {
                create: {
                    street: data.address.street,
                    city: data.address.city,
                    state: data.address.state,
                    country: data.address.country,
                    postalCode: data.address.postalCode
                }
            }
        };
    }

    /**
     * Transform order request
     * @param {Object} data - Request data
     * @returns {Object} Transformed data
     * @private
     */
    _transformOrderRequest(data) {
        return {
            type: data.type,
            status: data.status || 'PENDING',
            items: {
                create: data.items?.map(item => ({
                    productId: item.product.id || item.productId,
                    quantity: parseInt(item.quantity),
                    unitPrice: parseFloat(item.unitPrice),
                    totalPrice: parseFloat(item.quantity) * parseFloat(item.unitPrice)
                }))
            },
            totalAmount: data.items?.reduce(
                (sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice)),
                0
            ),
            tax: parseFloat(data.tax || 0),
            shippingCost: parseFloat(data.shippingCost || 0),
            expectedDate: data.expectedDate ? new Date(data.expectedDate) : null
        };
    }

    /**
     * Transform warehouse request
     * @param {Object} data - Request data
     * @returns {Object} Transformed data
     * @private
     */
    _transformWarehouseRequest(data) {
        return {
            code: data.code,
            name: data.name,
            type: data.type,
            capacity: parseInt(data.capacity),
            address: data.address && {
                create: {
                    street: data.address.street,
                    city: data.address.city,
                    state: data.address.state,
                    country: data.address.country,
                    postalCode: data.address.postalCode
                }
            },
            zones: data.zones && {
                create: data.zones.map(zone => ({
                    name: zone.name,
                    code: zone.code
                }))
            },
            staff: data.staff && {
                connect: data.staff.map(user => ({
                    id: user.id
                }))
            }
        };
    }
}

module.exports = new DataTransformer();
