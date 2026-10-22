const express = require('express');
const path = require('path');
const crypto = require('crypto');
const methodOverride = require('method-override');
const session = require('express-session');
const db = require('./src/db');
const { attachUser } = require('./src/auth');
const { validateCsrfToken } = require('./src/csrf');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the first proxy hop so secure session cookies work behind HTTPS proxies
app.set('trust proxy', process.env.TRUST_PROXY === '1');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Security headers: prevent MIME sniffing on served assets (incl. user uploads)
// and keep same-origin URLs (which may carry a CSRF token) out of referers.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

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

// CSRF protection (synchronizer token pattern using session storage).
// Tokens are only minted for the dashboard, which is the only part of the app
// that renders forms. Public GET routes therefore never start a session, so the
// in-memory session store stays small under public traffic.
// shortcut: sessions still live in process memory; fine for a few dashboard
// users, move to a persistent session store if dashboard users grow or you run
// more than one process.
app.use((req, res, next) => {
  if (req.path.startsWith('/dashboard')) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    // Make CSRF token available in all dashboard EJS templates
    res.locals.csrfToken = req.session.csrfToken;
  }

  // Only validate unsafe methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Multer parses multipart bodies inside route handlers. Those handlers
  // validate the body token after parsing, so tokens never enter URLs.
  if (req.is('multipart/form-data')) return next();

  if (!validateCsrfToken(req)) {
    const err = new Error('Invalid or missing CSRF token.');
    err.code = 'EBADCSRFTOKEN';
    return next(err);
  }

  return next();
});

// Attach user (if logged in) for templates and downstream handlers
app.use(attachUser);

app.use('/', require('./src/routes/index'));
app.use('/tour', require('./src/routes/tours'));
app.use('/api', require('./src/routes/api'));
app.use('/dashboard', require('./src/routes/dashboard'));

app.use((req, res) => {
  res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Page not found' });
});

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    if (!res.locals.csrfToken) {
      res.locals.csrfToken = req.session.csrfToken;
    }
    return res.status(403).render('error', { title: 'Forbidden', status: 403, message: 'Invalid or missing CSRF token.' });
  }
  console.error(err.stack);
  if (!res.locals.csrfToken) res.locals.csrfToken = '';
  res.status(500).render('error', { title: 'Error', status: 500, message: 'Internal Server Error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Tourbine running at http://localhost:${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  });
}

module.exports = app;
