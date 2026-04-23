# Tourbine Roadmap

Planned features for upcoming releases.

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
