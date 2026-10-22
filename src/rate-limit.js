const rateLimit = require('express-rate-limit');

// Shared limiter for public routes (tours list, tour pages, JSON API).
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { publicLimiter };
