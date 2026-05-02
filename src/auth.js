const db = require('./db');

function isUserSetup() {
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM users').get();
  return row && row.cnt > 0;
}

function loadUser(userId) {
  if (!userId) return null;
  return db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(userId);
}

function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    const user = loadUser(req.session.userId);
    if (user) {
      req.user = user;
      res.locals.currentUser = user;
    } else {
      delete req.session.userId;
    }
  }
  next();
}

function requireSetup(req, res, next) {
  if (!isUserSetup()) {
    return res.redirect('/dashboard/setup');
  }
  next();
}

function requireAuth(req, res, next) {
  if (!isUserSetup()) {
    return res.redirect('/dashboard/setup');
  }
  if (req.session && req.session.userId) {
    const user = loadUser(req.session.userId);
    if (user) {
      req.user = user;
      res.locals.currentUser = user;
      return next();
    }
    delete req.session.userId;
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/dashboard/login');
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).render('error', { title: 'Unauthorized', status: 401, message: 'Login required' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).render('error', { title: 'Forbidden', status: 403, message: 'You do not have access to this action.' });
    }
    next();
  };
}

module.exports = { isUserSetup, requireSetup, requireAuth, requireRole, attachUser };
