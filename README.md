<p align="center">
  <img src="markdownuploads/tourbinereadme.png" alt="Tourbine Logo with Text Reading 'tourbine'" width="500">
</p>

# Tourbine

Tourbine is a self-hosted virtual tour app built with Express, EJS, SQLite, and Pannellum.

It provides:

- public tour pages
- embed mode for tours with a copyable iframe embed code
- an authenticated dashboard
- multi-user role-based access (system_admin, admin, user)
- tour/room/hotspot/info-point management
- media support for 360° images, still images, local video, YouTube, Vimeo, and embed (iframe) URLs
- privacy editor (blur/mosaic) for images before upload
- analytics tracking
- tour import/export (ZIP)
- Cloudflared tunnel configuration UI
- password reset CLI

<img src=".github/codeflow-card.svg" alt="CodeFlow card" />

## Requirements

- Node.js (LTS recommended) and npm
- `better-sqlite3` is a native addon. Installing from source requires build tools (python3, make, g++); the Docker image installs them automatically.

## Install scripts

Official cross-platform installer scripts are maintained in the [`efenow/get-tourbine`](https://github.com/efenow/get-tourbine) repository.

### Linux and macOS

```bash
curl -fsSL https://get.tourbine.efenow.xyz/install.sh | bash
```

### Windows PowerShell

```powershell
irm https://get.tourbine.efenow.xyz/install.ps1 | iex
```

Both installers ask you to choose an installation method:

1. **Docker** — recommended for servers and production. Docker handles native dependencies and keeps the app isolated.
2. **npm** — recommended for local development. Requires Node.js, npm, and native build tools for `better-sqlite3`.

The Docker option is recommended on Windows production systems. It requires Docker Desktop or another Docker-compatible engine. The npm option is useful on macOS, Linux development machines, and WSL.

Installers preserve Docker volumes containing the database and uploaded files. Failed dependency builds can download the selected source again and retry without the Docker build cache.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port the server listens on |
| `NODE_ENV` | `development` | Set to `production` to enable secure session cookies |
| `DB_PATH` | `data/tourbine.db` | Path to the SQLite database file |
| `UPLOADS_DIR` | `public/uploads` | Directory uploaded media is written to |
| `TRUST_PROXY` | `0` | Set to `1` only when a trusted reverse proxy is the only path to the app |

## Run locally

```bash
npm install
npm start
```

Server default: `http://localhost:3000`

For development with auto-restart:

```bash
npm run dev
```

## Run tests

```bash
npm test
```

## Docker

```bash
docker compose up -d --build
```

`docker-compose.yml` maps:

- `3000:3000`
- `tourbine_data` volume to `/app/data`
- `tourbine_uploads` volume to `/app/public/uploads`

and sets `NODE_ENV=production` and `PORT=3000`.

## First-time setup

1. Open `http://localhost:3000/dashboard` — you are redirected to `/dashboard/setup`
2. Create the system admin account on `/dashboard/setup` (username ≥ 3 characters, password ≥ 8 characters)
3. Log in at `/dashboard/login` on later visits

## Dashboard features

### Tours

- create/edit/delete tours
- optional cover image upload (max 100 MB)
- duplicate tours (structure data; images are not copied)
- export full tour as a ZIP from the room list page
- import full tour from an export ZIP (v2) or legacy JSON (v1)

### Rooms

- create/edit/delete rooms
- reorder rooms (move up/down)
- set default room
- media type selection:
  - `360_image`
  - `still_image`
  - `local_video`
  - `youtube_video`
  - `vimeo_video`
  - `embed` (iframe URL)
- optional privacy editor for image blur/mosaic before upload
- auto-rotate and default HFOV settings

### Hotspots

- link room-to-room with pitch/yaw and label
- external URL hotspots
- add/edit/delete hotspots

### Info points

- 360° pitch/yaw and still-image x/y placement support
- title/text metadata
- add/edit/delete info points

### Users (system_admin, admin, user)

- create users
- change roles (system_admin role is assigned at setup only)
- reset user passwords
- delete users (with role restrictions; users cannot delete themselves, and the system admin account is protected)

### Analytics

- all-time views
- 24-hour and 7-day totals
- per-tour aggregates

### Cloudflared

- dashboard form at `/dashboard/cloudflared`
- stores tunnel fields in `settings`
- shows generated config preview

## Public routes

- `/` — tour list
- `/tour/:tourSlug` — full tour page
- `/tour/:tourSlug/embed` — embed view

## JSON API routes

- `GET /api/tours` — list tours with counts and cover image
- `GET /api/tours/:slug` — full tour data: tour, rooms, hotspots, scenes, firstScene

## Authentication and security (implemented behavior)

- session auth via `express-session`
  - random session secret generated and stored in the SQLite database
  - `httpOnly: true`, `sameSite: 'strict'`
  - `secure` enabled when `NODE_ENV=production` (and behind HTTPS proxies via `trust proxy`)
  - session TTL: 24 hours
- `app.set('trust proxy', 1)` is enabled
- CSRF token checks on POST/PUT/PATCH/DELETE (synchronizer token pattern, session-backed)
- passwords hashed with **bcrypt** (cost factor 12) — never stored in plaintext
- rate limiting:
  - dashboard/login: 10 attempts per 15 minutes per IP
  - dashboard, public tour, and API routes: 300 requests per minute

## Password recovery CLI

If dashboard access is lost:

```bash
node reset-password.js
```

This script opens the SQLite database directly (so it works even when the server is not running), lets you select a user and set a new password, and writes the bcrypt hash to the database. It refuses to run if no users exist yet — use the `/dashboard/setup` flow first.

## Data and storage

- SQLite DB: `data/tourbine.db` (or `DB_PATH` if provided)
- uploaded media: `public/uploads`

## Exposing to the internet (Cloudflare Tunnel)

This repository includes `cloudflared-config.example.yml` with an example tunnel config structure.

Quick steps:

1. Install `cloudflared`: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/
2. Authenticate: `cloudflared tunnel login`
3. Create a tunnel: `cloudflared tunnel create tourbine`
4. Copy the example config: `cp cloudflared-config.example.yml ~/.cloudflared/config.yml`
5. Edit the tunnel UUID and hostname in `~/.cloudflared/config.yml`
6. Route traffic to the tunnel:
   `cloudflared tunnel route dns tourbine tourbine.example.com`
7. Run the tunnel: `cloudflared tunnel run tourbine`
   (or set it up as a system service — see the cloudflared docs)

The dashboard Cloudflared page (`/dashboard/cloudflared`) stores:

- tunnel name
- tunnel UUID
- credentials file path
- hostname
- service URL

The default Docker Compose binding is loopback-only. Keep it that way when Cloudflare Tunnel or another trusted proxy is the only ingress. Set `TRUST_PROXY=1` only when direct access is blocked and exactly one trusted proxy sits in front of the app.

## Project structure

- `server.js` — Express app entry point
- `src/db.js` — SQLite connection and schema/migrations
- `src/auth.js` — session auth and access-control helpers
- `src/upload.js` — multer upload configuration
- `src/tour-data.js` — tour data assembly for viewer and API
- `src/routes/` — public, dashboard, tour, and API routes
- `views/` — EJS templates
- `public/` — static assets (CSS and user uploads)
- `data/` — SQLite database (created on first run)
- `reset-password.js` — password recovery CLI

## License

GPL-3.0 (see `LICENSE`)

## Security

Please see [`SECURITY.md`](SECURITY.md) for how to report vulnerabilities.
