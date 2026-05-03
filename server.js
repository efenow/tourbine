const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const session = require('express-session');
const { csrfSync } = require('csrf-sync');
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
  const crypto = require('crypto');
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

// CSRF protection (synchroniser token pattern — stores token in session)
// getTokenFromRequest checks both body (URL-encoded forms) and query string
// (multipart/form-data forms, where req.body is not yet parsed by multer at middleware time)
const { generateToken, csrfSynchronisedProtection } = csrfSync({
  getTokenFromRequest: (req) =>
    (req.body && req.body._csrf) || (req.query && req.query._csrf),
});

app.use(csrfSynchronisedProtection);

// Attach user (if logged in) for templates and downstream handlers
app.use(attachUser);

// Make CSRF token available in all EJS templates
app.use((req, res, next) => {
  try { res.locals.csrfToken = generateToken(req); } catch (e) { res.locals.csrfToken = ''; }
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
    if (!res.locals.csrfToken) {
      try { res.locals.csrfToken = generateToken(req); } catch (e) { res.locals.csrfToken = ''; }
    }
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

