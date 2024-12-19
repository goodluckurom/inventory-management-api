# Inventory Management API Documentation

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
All API endpoints except for authentication endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Rate Limiting
API requests are limited to 100 requests per 15 minutes per IP address.

## Common HTTP Status Codes
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Too Many Requests
- 500: Internal Server Error

## Endpoints

### Authentication

#### Register New User
```http
POST /auth/register
```
Request Body:
```json
{
  "email": "user@example.com",
  "password": "StrongPass123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "USER"
}
```
Response:
```json
{
  "success": true,
  "token": "jwt_token_here",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER"
  }
}
```

#### Login
```http
POST /auth/login
```
Request Body:
```json
{
  "email": "user@example.com",
  "password": "StrongPass123!"
}
```
Response:
```json
{
  "success": true,
  "token": "jwt_token_here",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "USER"
  }
}
```

### Products

#### List Products
```http
GET /products
```
Query Parameters:
- page (optional): Page number for pagination (default: 1)
- limit (optional): Items per page (default: 10)
- search (optional): Search term for product name or SKU
- category (optional): Filter by category ID
- inStock (optional): Filter by stock status (true/false)

Response:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "sku": "PRD001",
        "name": "Product Name",
        "description": "Product description",
        "category": {
          "id": "uuid",
          "name": "Category Name"
        },
        "price": 99.99,
        "quantity": 100,
        "unit": "PIECES",
        "location": {
          "warehouse": "Main Warehouse",
          "zone": "A",
          "shelf": "A1"
        },
        "supplier": {
          "id": "uuid",
          "name": "Supplier Name"
        },
        "status": "ACTIVE",
        "createdAt": "2023-01-01T00:00:00Z",
        "updatedAt": "2023-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

#### Get Product Details
```http
GET /products/:id
```
Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sku": "PRD001",
    "name": "Product Name",
    "description": "Product description",
    "category": {
      "id": "uuid",
      "name": "Category Name"
    },
    "price": 99.99,
    "costPrice": 75.00,
    "quantity": 100,
    "unit": "PIECES",
    "reorderPoint": 10,
    "location": {
      "warehouse": "Main Warehouse",
      "zone": "A",
      "shelf": "A1"
    },
    "supplier": {
      "id": "uuid",
      "name": "Supplier Name",
      "contact": {
        "email": "supplier@example.com",
        "phone": "1234567890"
      }
    },
    "status": "ACTIVE",
    "images": [
      {
        "id": "uuid",
        "url": "https://example.com/image.jpg",
        "isPrimary": true
      }
    ],
    "stockMovements": [
      {
        "id": "uuid",
        "type": "PURCHASE",
        "quantity": 50,
        "date": "2023-01-01T00:00:00Z"
      }
    ],
    "metadata": {
      "dimensions": {
        "length": 10,
        "width": 5,
        "height": 2,
        "unit": "cm"
      },
      "weight": {
        "value": 0.5,
        "unit": "kg"
      }
    },
    "createdAt": "2023-01-01T00:00:00Z",
    "updatedAt": "2023-01-01T00:00:00Z"
  }
}
```

#### Create Product
```http
POST /products
```
Request Body:
```json
{
  "sku": "PRD001",
  "name": "Product Name",
  "description": "Product description",
  "categoryId": "uuid",
  "price": 99.99,
  "costPrice": 75.00,
  "quantity": 100,
  "unit": "PIECES",
  "reorderPoint": 10,
  "warehouseId": "uuid",
  "location": {
    "zone": "A",
    "shelf": "A1"
  },
  "supplierId": "uuid",
  "metadata": {
    "dimensions": {
      "length": 10,
      "width": 5,
      "height": 2,
      "unit": "cm"
    },
    "weight": {
      "value": 0.5,
      "unit": "kg"
    }
  }
}
```

#### Update Product
```http
PUT /products/:id
```
Request Body: Same as Create Product

#### Delete Product
```http
DELETE /products/:id
```

#### Update Product Stock
```http
POST /products/:id/stock
```
Request Body:
```json
{
  "type": "PURCHASE",
  "quantity": 50,
  "reason": "Stock replenishment"
}
```

### Orders

#### List Orders
```http
GET /orders
```
Query Parameters:
- page (optional): Page number for pagination (default: 1)
- limit (optional): Items per page (default: 10)
- status (optional): Filter by order status
- startDate (optional): Filter by start date
- endDate (optional): Filter by end date

Response:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "orderNumber": "ORD001",
        "type": "PURCHASE",
        "status": "PENDING",
        "items": [
          {
            "product": {
              "id": "uuid",
              "name": "Product Name",
              "sku": "PRD001"
            },
            "quantity": 5,
            "unitPrice": 99.99,
            "total": 499.95
          }
        ],
        "supplier": {
          "id": "uuid",
          "name": "Supplier Name"
        },
        "totalAmount": 499.95,
        "createdAt": "2023-01-01T00:00:00Z",
        "updatedAt": "2023-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

#### Create Order
```http
POST /orders
```
Request Body:
```json
{
  "type": "PURCHASE",
  "supplierId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "quantity": 5,
      "unitPrice": 99.99
    }
  ],
  "notes": "Urgent order"
}
```

#### Update Order Status
```http
PUT /orders/:id/status
```
Request Body:
```json
{
  "status": "PROCESSING",
  "notes": "Order is being processed"
}
```

### Suppliers

#### List Suppliers
```http
GET /suppliers
```
Query Parameters:
- page (optional): Page number for pagination (default: 1)
- limit (optional): Items per page (default: 10)
- search (optional): Search term for supplier name or code

Response:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "code": "SUP001",
        "name": "Supplier Name",
        "type": "MANUFACTURER",
        "contact": {
          "email": "supplier@example.com",
          "phone": "1234567890",
          "person": "John Doe"
        },
        "address": {
          "street": "123 Main St",
          "city": "Example City",
          "state": "Example State",
          "country": "Example Country",
          "postalCode": "12345"
        },
        "status": "ACTIVE",
        "createdAt": "2023-01-01T00:00:00Z",
        "updatedAt": "2023-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

#### Create Supplier
```http
POST /suppliers
```
Request Body:
```json
{
  "code": "SUP001",
  "name": "Supplier Name",
  "type": "MANUFACTURER",
  "contact": {
    "email": "supplier@example.com",
    "phone": "1234567890",
    "person": "John Doe"
  },
  "address": {
    "street": "123 Main St",
    "city": "Example City",
    "state": "Example State",
    "country": "Example Country",
    "postalCode": "12345"
  }
}
```

### Reports

#### Generate Inventory Report
```http
GET /reports/inventory
```
Query Parameters:
- format: Report format (pdf, excel, csv)
- category (optional): Filter by category
- warehouse (optional): Filter by warehouse
- lowStock (optional): Filter low stock items only

#### Generate Sales Report
```http
GET /reports/sales
```
Query Parameters:
- format: Report format (pdf, excel, csv)
- startDate: Start date for report period
- endDate: End date for report period
- groupBy (optional): Group results by (day, week, month)

## Error Responses
All error responses follow this format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message here",
    "details": {} // Optional additional error details
  }
}
```

Common Error Codes:
- VALIDATION_ERROR: Invalid input data
- AUTHENTICATION_ERROR: Authentication failed
- AUTHORIZATION_ERROR: Insufficient permissions
- RESOURCE_NOT_FOUND: Requested resource not found
- RESOURCE_CONFLICT: Resource already exists
- INTERNAL_ERROR: Internal server error

## Webhooks
The API can send webhook notifications for various events. Configure webhook endpoints in your account settings.

Event Types:
- inventory.low_stock
- inventory.out_of_stock
- order.created
- order.status_changed
- product.created
- product.updated

Webhook Payload Format:
```json
{
  "event": "event.type",
  "timestamp": "2023-01-01T00:00:00Z",
  "data": {
    // Event-specific data
  }
}
```

## Rate Limits
- Authentication endpoints: 5 requests per minute
- API endpoints: 100 requests per 15 minutes
- Report generation: 10 requests per hour

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

## Pagination
All list endpoints support pagination using the following query parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 10, max: 100)

Response includes pagination metadata:
```json
{
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

## Filtering and Sorting
List endpoints support various filtering options through query parameters:
- search: Search term
- sortBy: Field to sort by
- order: Sort order (asc/desc)
- startDate/endDate: Date range filters
- status: Status filters
- category: Category filters

Example:
```
GET /api/v1/products?search=laptop&sortBy=price&order=desc&category=electronics
```

## Versioning
The API uses URL versioning. The current version is v1:
```
/api/v1/
```

## Security
- All endpoints use HTTPS
- JWT tokens expire after 24 hours
- Password requirements:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
