# tourbine

Self-hosted Open Source 360° web tour software with:

- support for multiple rooms
- support for uploading and viewing Google Camera app Photo Spheres
- an admin dashboard at `/dashboard`
- full tour views available at room URLs
- tour cover images, analytics, and role-based dashboard access

---

## Getting Started

### Option A — Node.js directly

```bash
npm install
npm start
```

### Option B — Docker (recommended for production)

```bash
docker compose up -d
```

Open `http://localhost:3000` in your browser. On first visit to `/dashboard`, you will be prompted to create the system admin account.

After setup, you can add additional users and roles from **Dashboard → Users**.

---

## 🐳 Docker

The easiest way to run Tourbine in production is with Docker.

### Requirements
- [Docker](https://docs.docker.com/get-docker/) with Docker Compose

### Quickstart

```bash
# Build and start in the background
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

Data (SQLite database and uploaded images) is automatically persisted in Docker named volumes (`tourbine_data` and `tourbine_uploads`), surviving container restarts and upgrades.

### Upgrading

```bash
docker compose pull   # if using a registry image
docker compose up -d --build
```

## 🌐 Exposing to the Internet via Cloudflare Tunnel

[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) lets you securely expose your Tourbine instance to the internet without opening firewall ports or owning a public IP.

### Steps

1. **Install cloudflared** on your host machine:
   - [Download & install](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)

2. **Authenticate** with your Cloudflare account:
   ```bash
   cloudflared tunnel login
   ```

3. **Create a tunnel** named `tourbine`:
   ```bash
   cloudflared tunnel create tourbine
   ```

4. **Configure the tunnel** — copy and edit the example config:
   ```bash
   cp cloudflared-config.example.yml ~/.cloudflared/config.yml
   ```
   Edit the file to set your tunnel UUID and your (sub)domain.

5. **Route your domain** to the tunnel:
   ```bash
   cloudflared tunnel route dns tourbine your-subdomain.example.com
   ```

6. **Run the tunnel**:
   ```bash
   cloudflared tunnel run tourbine
   ```
   Or [install it as a system service](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/as-a-service/).

> **Note:** Tourbine sets `trust proxy` automatically, so session cookies gain the `Secure` flag when requests arrive over HTTPS via the tunnel.

---

## 🔐 Security

### Password Reset

If you lose access to the dashboard, use the included CLI tool (works while the server is offline):

```bash
node reset-password.js
```

You'll be prompted to choose which username to reset.

### User Roles

Tourbine supports multiple users with roles:

- **System Admin** — full access, including user management and admin promotion
- **Admin** — full access, including user management (cannot promote users to admin)
- **User** — read-only dashboard access

Manage roles at **Dashboard → Users**.

---

## 📊 Analytics

Tourbine tracks tour visits and shows totals over the last 24 hours and 7 days. View the dashboard analytics at **Dashboard → Analytics**.

---

## 🔌 REST/JSON API

Tourbine exposes a read-only API for headless use:

- `GET /api/tours` — list tours
- `GET /api/tours/:slug` — tour details, rooms, hotspots, and scene data
