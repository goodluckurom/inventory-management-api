const express = require('express');
const { generateSalesReport, generateInventoryReport } = require('../controllers/reportingController');
const router = express.Router();

// Route for generating sales report
router.route('/sales').post(generateSalesReport);

// Route for generating inventory report
router.route('/inventory').post(generateInventoryReport);

module.exports = router;
