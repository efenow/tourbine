# Tourbine Roadmap

This document tracks planned features and improvements for Tourbine. Items are grouped by theme and roughly ordered by priority within each section.

---

## ✅ Done

- **Core application** — Express/Node.js server, SQLite database, EJS templating
- **Tour management** — Create, edit, and delete tours with slugged URLs
- **Room management** — Upload Photo Sphere images (JPEG/PNG/WebP, up to 100 MB), set default room, reorder
- **Hotspot linking** — Connect rooms with pitch/yaw hotspots so viewers can navigate between spaces
- **Admin dashboard** — Full CRUD UI at `/dashboard` for tours, rooms, and hotspots
- **Matterport-inspired viewer UI** — Full-screen Pannellum 360° viewer with:
  - Dark glassy top-left pill showing tour name + location pin
  - Bottom toolbar (collapse, auto-rotate, fullscreen, share/copy-link, dashboard shortcut)
  - Horizontal room filmstrip with thumbnail cards, active highlight, and 360° badge

---

## 🔐 Security

### Dashboard password protection
Protect the `/dashboard` from unauthorized access when the instance is exposed to the internet.

**Planned approach:**
- On first run, if no password is set, redirect to a one-time setup screen (`/dashboard/setup`) to create a password
- Password is hashed with **bcrypt** (cost factor ≥ 12) — never stored in plaintext
- Session-based authentication using **express-session** with:
  - A randomly generated secret stored in the database (not in code or env files)
  - `httpOnly: true`, `sameSite: 'strict'`, `secure` flag automatically enabled behind HTTPS proxies
  - 24-hour session TTL
- Brute-force protection: rate-limit login attempts (e.g. 10 tries per 15 min per IP)
- Login page at `/dashboard/login`, logout at `POST /dashboard/logout`

### CLI password reset tool (`reset-password.js`)
Inspired by [Uptime Kuma's password reset script](https://github.com/louislam/uptime-kuma/blob/master/extra/reset-password.js) — lets self-hosters recover access without a GUI.

**Planned approach:**
- Run with `node reset-password.js`
- Interactive readline prompts: enter new password → confirm → bcrypt hash → write to DB
- Works even when the server is not running (direct SQLite access)
- Refuses to run if no password has been set yet (use setup flow instead)
- Example flow:
  ```
  $ node reset-password.js

  ┌─────────────────────────────────┐
  │   Tourbine — Password Reset     │
  └─────────────────────────────────┘

  Enter new password: ••••••••••••
  Confirm new password: ••••••••••••

  ✔ Password updated successfully. You can now log in at /dashboard/login.
  ```

---

## 🌐 Exposing to the Internet

### Cloudflare Tunnel (cloudflared)
Allow self-hosters to securely expose their Tourbine instance to the internet without opening firewall ports or owning a domain — similar to how Uptime Kuma recommends Cloudflare Tunnel.

**Planned approach:**
- Add a dedicated **"Expose to Internet"** section to the README with step-by-step instructions:
  1. Install `cloudflared` on the host machine
  2. Authenticate: `cloudflared tunnel login`
  3. Create a tunnel: `cloudflared tunnel create tourbine`
  4. Route a (sub)domain to the tunnel
  5. Run `cloudflared tunnel run tourbine` or set up as a system service
- Document that `secure: true` on the session cookie is handled automatically when `X-Forwarded-Proto: https` is present (Express `trust proxy` setting)
- Provide a sample `cloudflared` config file (`cloudflared-config.example.yml`) that points to `localhost:3000`

---

## 🗺️ Viewer Enhancements

- **Floor plan / map overlay** — optional mini-map showing room layout with current position marker
- **Info hotspots** — hotspots that open an info card (text + optional image) instead of navigating to another room
- **Gyroscope / device-orientation mode** — on mobile, tilt device to look around
- **Embed code generator** — one-click `<iframe>` snippet for embedding a tour on an external website
- **Tour password protection** — optional per-tour passcode for private tours (separate from the dashboard password)

---

## 🛠️ Dashboard & Management

- **Drag-and-drop room reordering** — reorder rooms in the filmstrip via drag-and-drop in the dashboard
- **Bulk image upload** — upload all room images at once; auto-create rooms from filenames
- **Tour duplication** — clone an existing tour with all rooms and hotspot relationships
- **EXIF-based initial pitch/yaw** — auto-detect camera orientation from photo sphere metadata
- **Storage stats** — show disk usage per tour in the dashboard

---

## ⚙️ Operations & Deployment

- **Docker image** — official `Dockerfile` and `docker-compose.yml` for one-command deployment
- **Backup / restore CLI** — `backup.js` script that exports the DB + uploads to a `.tar.gz` archive
- **Health check endpoint** — `GET /health` returning `{ status: "ok", version, uptime }` for use with uptime monitors
- **Reverse proxy guide** — documented Nginx and Caddy configuration examples with HTTPS

---

*This roadmap reflects current intentions and is subject to change. Contributions and feature requests are welcome via GitHub Issues.*
