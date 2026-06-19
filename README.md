# Tourbine

Tourbine is a self-hosted virtual tour app built with Express, EJS, SQLite, and Pannellum.

It provides:
- public tour pages
- embed mode for tours
- an authenticated dashboard
- multi-user role-based access
- tour/room/hotspot/info-point management
- media support for 360 images, still images, local video, YouTube, and Vimeo
- analytics tracking
- tour import/export
- Cloudflared configuration UI

## Requirements

- Node.js + npm

## Run locally

```bash
npm install
npm start
```

Server default: `http://localhost:3000`

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

## First-time setup

1. Open `/dashboard`
2. Create the system admin account on `/dashboard/setup`
3. Log in at `/dashboard/login` on later visits

## Dashboard features

- **Tours**
  - create/edit/delete tours
  - optional cover image upload
  - duplicate tours (structure data)
  - import full tour from export JSON
  - export full tour from room list page
- **Rooms**
  - create/edit/delete rooms
  - reorder rooms
  - set default room
  - media type selection:
    - `360_image`
    - `still_image`
    - `local_video`
    - `youtube_video`
    - `vimeo_video`
  - optional privacy editor for image blur/mosaic before upload
- **Hotspots**
  - link room-to-room with pitch/yaw
- **Info points**
  - 360 pitch/yaw and still-image x/y placement support
  - title/text metadata
- **Users** (admin/system_admin)
  - create users
  - change roles
  - reset user passwords
  - delete users (with role restrictions)
- **Analytics**
  - all-time views
  - 24-hour and 7-day totals
  - per-tour aggregates
- **Cloudflared**
  - dashboard form at `/dashboard/cloudflared`
  - stores tunnel fields in `settings`
  - shows generated config preview

## Public routes

- `/` — tour list
- `/tour/:tourSlug` — full tour page
- `/tour/:tourSlug/embed` — embed view

## JSON API routes

- `GET /api/tours` — list tours with counts and cover
- `GET /api/tours/:slug` — full tour data, rooms, hotspots, scenes

## Authentication and security (implemented behavior)

- session auth via `express-session`
- CSRF token checks on POST/PUT/PATCH/DELETE
- dashboard/login route rate limiting
- dashboard, public tour, and API route-level rate limiting
- cookie config:
  - `httpOnly: true`
  - `sameSite: 'strict'`
  - `secure` enabled when `NODE_ENV=production`
- `app.set('trust proxy', 1)` is enabled

## Password recovery CLI

If dashboard access is lost:

```bash
node reset-password.js
```

This script updates a selected user directly in the SQLite database.

## Data and storage

- SQLite DB: `data/tourbine.db` (or `DB_PATH` if provided)
- uploaded media: `public/uploads`

## Cloudflare Tunnel notes

This repository includes `cloudflared-config.example.yml` with an example tunnel config structure.

The dashboard Cloudflared page stores:
- tunnel name
- tunnel UUID
- credentials file path
- hostname
- service URL

## License

MIT (see `LICENSE`)
