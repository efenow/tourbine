const db = require('./db');

function isPasswordSet() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'password_hash'").get();
  return !!(row && row.value);
}

function requireSetup(req, res, next) {
  if (!isPasswordSet()) {
    return res.redirect('/dashboard/setup');
  }
  next();
}

function requireAuth(req, res, next) {
  if (!isPasswordSet()) {
    return res.redirect('/dashboard/setup');
  }
  if (req.session && req.session.authenticated) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/dashboard/login');
}

module.exports = { isPasswordSet, requireSetup, requireAuth };
