const express = require('express');
const path = require('path');
const crypto = require('crypto');
const methodOverride = require('method-override');
const session = require('express-session');
const db = require('./src/db');
const { attachUser } = require('./src/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the first proxy hop so secure session cookies work behind HTTPS proxies
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure a random session secret is persisted in the DB
function getOrCreateSessionSecret() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'session_secret'").get();
  if (row) return row.value;
  const secret = crypto.randomBytes(48).toString('hex');
  db.prepare("INSERT INTO settings (key, value) VALUES ('session_secret', ?)").run(secret);
  return secret;
}

app.use(session({
  secret: getOrCreateSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// CSRF protection (synchronizer token pattern using session storage)
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // Make CSRF token available in all EJS templates
  res.locals.csrfToken = req.session.csrfToken;

  // Only validate unsafe methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Check body (URL-encoded forms), query string (multipart/form-data flows), and header (AJAX)
  const requestToken = (req.body && req.body._csrf)
    || (req.query && req.query._csrf)
    || req.get('x-csrf-token');

  if (!requestToken || requestToken !== req.session.csrfToken) {
    const err = new Error('Invalid or missing CSRF token.');
    err.code = 'EBADCSRFTOKEN';
    return next(err);
  }

  return next();
});

// Attach user (if logged in) for templates and downstream handlers
app.use(attachUser);

// Ensure templates always have csrfToken available
app.use((req, res, next) => {
  if (!res.locals.csrfToken) res.locals.csrfToken = '';
  next();
});

app.use('/', require('./src/routes/index'));
app.use('/tour', require('./src/routes/tours'));
app.use('/api', require('./src/routes/api'));
app.use('/dashboard', require('./src/routes/dashboard'));

app.use((req, res) => {
  res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Page not found' });
});

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    if (!res.locals.csrfToken && req.session && req.session.csrfToken) res.locals.csrfToken = req.session.csrfToken;
    return res.status(403).render('error', { title: 'Forbidden', status: 403, message: 'Invalid or missing CSRF token.' });
  }
  console.error(err.stack);
  if (!res.locals.csrfToken) res.locals.csrfToken = '';
  res.status(500).render('error', { title: 'Error', status: 500, message: err.message || 'Internal Server Error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Tourbine running at http://localhost:${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  });
}

module.exports = app;
