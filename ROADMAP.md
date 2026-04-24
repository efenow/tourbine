# Tourbine Roadmap

Planned features for upcoming releases.

---

## 🔐 Security

### ✅ Dashboard password protection
**Status: Completed**

Protect the `/dashboard` from unauthorized access when the instance is exposed to the internet.

**Implemented:**
- On first run, if no password is set, redirect to a one-time setup screen (`/dashboard/setup`) to create a password
- Password is hashed with **bcrypt** (cost factor 12) — never stored in plaintext
- Session-based authentication using **express-session** with:
  - A randomly generated secret stored in the database (not in code or env files)
  - `httpOnly: true`, `sameSite: 'strict'`, `secure` flag automatically enabled behind HTTPS proxies
  - 24-hour session TTL
- Brute-force protection: rate-limit login attempts (10 tries per 15 min per IP)
- Login page at `/dashboard/login`, logout at `POST /dashboard/logout`

### ✅ CLI password reset tool (`reset-password.js`)
**Status: Completed**

**Implemented:**
- Run with `node reset-password.js`
- Interactive prompts with hidden input: enter new password → confirm → bcrypt hash → write to DB
- Works even when the server is not running (direct SQLite access)
- Refuses to run if no password has been set yet (use setup flow instead)

---

## 🌐 Exposing to the Internet

### ✅ Cloudflare Tunnel (cloudflared)
**Status: Completed**

**Implemented:**
- Added a dedicated **"Expose to Internet"** section to the README with step-by-step instructions
- `secure: true` on session cookies is handled automatically via Express `trust proxy` setting
- Provided `cloudflared-config.example.yml` pointing to `localhost:3000`

---

## 🐳 Docker

### ✅ Docker support
**Status: Completed**

**Implemented:**
- `Dockerfile` using `node:20-alpine` with a non-root user and native addon build tools
- `docker-compose.yml` with named volumes for persistent data (`tourbine_data`) and uploads (`tourbine_uploads`)
- `.dockerignore` to keep the image lean
- Docker quickstart section added to README

---

## 🐛 Bug Fixes

### ✅ CSRF token not validated for multipart room forms
**Status: Completed**

Rooms use `enctype="multipart/form-data"` for image uploads. At the time the global CSRF middleware runs, `express.urlencoded` has not parsed the body (multer handles multipart bodies at the route level later). This meant the CSRF token in the form body was invisible to the CSRF check, causing all room-creation and room-edit submissions to fail with a 403.

**Fix:** Pass `_csrf` as a query-string parameter on the form action URL for multipart room forms, and update `getTokenFromRequest` to check `req.query._csrf` as a fallback to `req.body._csrf`.

### ✅ Session `returnTo` lost after `session.regenerate()`
**Status: Completed**

The login handler called `req.session.regenerate()` to prevent session-fixation attacks, but then tried to read `req.session.returnTo` from the new (empty) session. `returnTo` was always `undefined`, so users were always redirected to `/dashboard` regardless of the URL they tried to access before logging in.

**Fix:** Capture `returnTo` from the old session before calling `regenerate()`.

### ✅ Multer upload errors show generic 500 page
**Status: Completed**

When multer rejected a file (wrong MIME type or file too large), the error propagated to the global error handler, showing a generic error page instead of the room form with a helpful message.

**Fix:** Wrap the room create/edit routes to call `upload.single()` with an explicit callback, catch errors, and re-render the form with a user-friendly error message.

