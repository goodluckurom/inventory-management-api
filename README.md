# Inventory Management API

## Description
The Inventory Management API provides a set of endpoints for managing inventory, orders, suppliers, and more. It is designed to facilitate the tracking and management of products in a warehouse environment.

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
  - [Authentication](#authentication)
  - [Endpoints](#endpoints)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/inventory-management-api.git
   cd inventory-management-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the necessary configuration variables.

## Usage
To start the server, run:
```bash
npm start
```
The API will be available at `http://localhost:3000`.

## API Documentation

### Authentication
The API uses JWT (JSON Web Tokens) for authentication. You must include the token in the `Authorization` header of your requests.

Example:
```
Authorization: Bearer <your_token>
```

### Endpoints

#### 1. User Authentication
- **POST /api/v1/auth/login**
  - Request Body:
    ```json
    {
      "email": "user@example.com",
      "password": "yourpassword"
    }
    ```
  - Response:
    ```json
    {
      "token": "your_jwt_token"
    }
    ```

#### 2. Products
- **GET /api/v1/products**
  - Response:
    ```json
    [
      {
        "id": 1,
        "sku": "PRD001",
        "name": "Product Name",
        "quantity": 100,
        "price": 99.99
      }
    ]
    ```

- **POST /api/v1/products**
  - Request Body:
    ```json
    {
      "sku": "PRD001",
      "name": "Product Name",
      "quantity": 100,
      "price": 99.99
    }
    ```
  - Response:
    ```json
    {
      "id": 1,
      "sku": "PRD001",
      "name": "Product Name",
      "quantity": 100,
      "price": 99.99
    }
    ```

#### 3. Orders
- **GET /api/v1/orders**
  - Response:
    ```json
    [
      {
        "id": 1,
        "orderNumber": "ORD001",
        "status": "PENDING",
        "totalAmount": 199.99
      }
    ]
    ```

- **POST /api/v1/orders**
  - Request Body:
    ```json
    {
      "items": [
        {
          "productId": 1,
          "quantity": 2
        }
      ]
    }
    ```
  - Response:
    ```json
    {
      "id": 1,
      "orderNumber": "ORD001",
      "status": "PENDING",
      "totalAmount": 199.99
    }
    ```

#### 4. Suppliers
- **GET /api/v1/suppliers**
  - Response:
    ```json
    [
      {
        "id": 1,
        "name": "Supplier Name",
        "contact": {
          "email": "supplier@example.com",
          "phone": "1234567890"
        }
      }
    ]
    ```

- **POST /api/v1/suppliers**
  - Request Body:
    ```json
    {
      "name": "Supplier Name",
      "contact": {
        "email": "supplier@example.com",
        "phone": "1234567890"
      }
    }
    ```
  - Response:
    ```json
    {
      "id": 1,
      "name": "Supplier Name",
      "contact": {
        "email": "supplier@example.com",
        "phone": "1234567890"
      }
    }
    ```

## Error Handling
The API returns standard HTTP status codes along with error messages in the response body. For example:
- **400 Bad Request**: Invalid input data.
- **401 Unauthorized**: Authentication failed.
- **404 Not Found**: Resource not found.
- **500 Internal Server Error**: Unexpected server error.

## Testing
To run tests, use the following command:
```bash
npm test
```

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for discussion.

## License
This project is licensed under the MIT License.

## Contact
For inquiries, please contact [yourname@example.com].
