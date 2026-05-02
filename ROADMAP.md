# Tourbine Roadmap

Planned features for upcoming releases.

---

## ✨ Experience Improvements

### ✅ Hotspot editing (update existing hotspots)
**Status: Completed**

Hotspots can now be updated (destination room, pitch/yaw, and label) directly from the room editor.

### ✅ Tour-level thumbnail / cover image
**Status: Completed**

Tours now support a dedicated cover image that overrides the default room thumbnail on the public tours list.

---

## 📊 Analytics

### ✅ Visitor stats dashboard
**Status: Completed**

Tour views are recorded and summarized in a dashboard analytics page (all-time, last 7 days, last 24 hours).

---

## 👥 Multi-User Access

### ✅ Role-based dashboard access
**Status: Completed**

Multiple users are supported with Admin, Editor, and Viewer roles, plus user management in the dashboard.

---

## 🔌 API

### ✅ REST/JSON API for headless use
**Status: Completed**

Read-only API endpoints are available at `/api/tours` and `/api/tours/:slug`.

---

## 🔐 Security

### ✅ Dashboard authentication
**Status: Completed**

Protect the `/dashboard` from unauthorized access when the instance is exposed to the internet.

**Implemented:**
- On first run, if no user exists, redirect to a one-time setup screen (`/dashboard/setup`) to create the first admin account
- Passwords are hashed with **bcrypt** (cost factor 12) — never stored in plaintext
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
- Interactive prompts with hidden input: select username → enter new password → confirm → bcrypt hash → write to DB
- Works even when the server is not running (direct SQLite access)
- Refuses to run if no users exist yet (use setup flow first)

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

### ✅ `unlinkFile` deletes files from wrong directory
**Status: Completed**

`dashboard.js` lives in `src/routes/`. The `unlinkFile` helper resolved the uploads directory with one `..` (→ `src/public/uploads/`) instead of two (→ `public/uploads/`), so image files were never deleted from disk when rooms or tours were removed.

**Fix:** Changed both path.join calls to use `'..', '..', 'public', 'uploads'`.

---

## 🔀 Room Reordering

### ✅ Manual room order in tours
**Status: Completed**

**Implemented:**
- Added `sort_order INTEGER DEFAULT 0` column to the `rooms` table with a safe `ALTER TABLE` migration in `db.js`
- Existing rows are backfilled with their rowid so the initial order is stable
- New rooms are inserted with `sort_order = MAX(sort_order) + 1` so they always go to the end
- Room list in tour viewer (`/tour/:slug`) now uses `ORDER BY sort_order ASC`
- Dashboard rooms list uses `ORDER BY sort_order ASC`
- Added `POST /dashboard/tours/:tourId/rooms/:roomId/move-up` and `move-down` routes that swap `sort_order` values with the adjacent room
- Dashboard rooms table has an **Order** column with up/down arrow buttons

---

## 📋 Embed Code

### ✅ Embeddable tour view + embed code snippet
**Status: Completed**

**Implemented:**
- Added `/tour/:slug/embed` route — renders the tour in an iframe-friendly stripped view (no back button, no share button, no "manage in dashboard" link)
- Dashboard rooms page has an **Embed Code** button that opens a modal with a pre-filled `<iframe>` snippet (URL built from `window.location.origin` so it always reflects the correct host)
- Copy-to-clipboard button in the modal

---

## 🔒 "Manage in Dashboard" button visibility

### ✅ Dashboard button hidden from public visitors
**Status: Completed**

The tour viewer (`/tour/:slug`) showed a "Manage in Dashboard" toolbar button (⚙ sliders icon) to all visitors, including unauthenticated public users.

**Fix:** Pass `isAuthenticated` from the tour route to the template. The button is now only rendered when `!embedMode && isAuthenticated`.

---

## 🖱️ Visual Hotspot Placement

### ✅ Click-to-pick pitch/yaw in room editor
**Status: Completed**

Previously, users had to manually type numerical pitch/yaw values to place hotspots — impossible without trial and error.

**Implemented:**
- Room edit form now embeds a pannellum 360° mini-viewer when the room has an image
- **"Set initial view from panorama"** button — opens the viewer with a crosshair overlay; user navigates the panorama and clicks "Use this view" to auto-fill `initial_pitch` / `initial_yaw`
- **"Pick position from panorama"** button in the Add Hotspot section — same crosshair approach, fills the hotspot pitch/yaw fields
- Viewers are loaded lazily (only when the toggle button is clicked)
- Pannellum CSS/JS loaded via CDN only on pages where a room image exists

---

## 🗂️ Tour Duplication

### ✅ Duplicate a tour with one click
**Status: Completed**

**Implemented:**
- **Duplicate** button on every tour row in the Dashboard
- `POST /dashboard/tours/:id/duplicate` creates a new tour named "Copy of …" with a unique slug
- All rooms are copied (name, slug, pitch/yaw, default flag, sort order) — images are **not** copied (user re-uploads); image_path is set to NULL so room cards clearly show "No image"
- All hotspots that link two rooms within the same tour are duplicated with mapped room IDs
- After duplication, the browser is redirected to the new tour's rooms page
