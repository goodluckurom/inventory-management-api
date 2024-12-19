const analyticsTracker = require('../utils/analyticsTracker');

/**
 * Middleware to track user activity
 */
const userActivityTracker = async (req, res, next) => {
    const start = Date.now();

    // Call the next middleware or route handler
    await next();

    const duration = Date.now() - start;

    // Track the API request
    await analyticsTracker.trackApiRequest(req, res, duration);
};

module.exports = userActivityTracker;
