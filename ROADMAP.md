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

