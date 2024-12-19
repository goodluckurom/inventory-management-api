const express = require('express');
const { getInventoryData, getSalesData } = require('../controllers/dataVisualizationController');
const reportingRoutes = require('./reportingRoutes');
const router = express.Router();

// Route for getting inventory data
router.route('/inventory').get(getInventoryData);

// Route for getting sales data
router.route('/sales').get(getSalesData);

// Use reporting routes
router.use('/reports', reportingRoutes);

module.exports = router;
