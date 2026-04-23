# tourbine

Self-hosted Open Source 360° web tour software with:

- support for multiple rooms
- support for uploading and viewing Google Camera app Photo Spheres
- an admin dashboard at `/dashboard`
- full tour views available at room URLs

---

## Getting Started

```bash
npm install
npm start
```

Open `http://localhost:3000` in your browser. On first visit to `/dashboard`, you will be prompted to create a password.

---

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
   Or [install it as a system service](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/run-tunnel/as-a-service/).

> **Note:** Tourbine sets `trust proxy` automatically, so session cookies gain the `Secure` flag when requests arrive over HTTPS via the tunnel.

---

## 🔐 Security

### Password Reset

If you lose access to the dashboard, use the included CLI tool (works while the server is offline):

```bash
node reset-password.js
```

