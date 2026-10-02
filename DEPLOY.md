# Deploying kwajaug.org to your VPS

Everything needed to take this from "runs on my machine" to the live site
at `https://kwajaug.org`. Roughly in order.

## 1. Server prerequisites

- A VPS with a public IP (any provider is fine)
- The domain `kwajaug.org`, with **A records pointing at that IP**
  (apex `kwajaug.org` → `your.vps.ip.address`, plus `www` if you want it)
- Node.js 18+ installed (`node --version` to check)
- `git` (or another way to get the code onto the server)
- PM2 installed globally: `npm install -g pm2`
- `nginx` (or another reverse proxy) — the Node app listens on a plain HTTP
  port; nginx sits in front of it and handles HTTPS
- `certbot` for a free TLS certificate (Let's Encrypt)

## 2. Why HTTPS matters here

The admin login session cookie should be HTTPS-only in production (set
`secure: true` in the cookie-session config in `server.js` once TLS is
live), and browsers will warn visitors on plain HTTP. So get the domain
and TLS working as part of going live.

## 3. Get the code onto the server

```bash
git clone https://github.com/iamqareem/kwaja-uganda.git kwaja-uganda
cd kwaja-uganda
npm install
cp .env.example .env
```

Fill in `.env` (see the main README for how to generate `SESSION_SECRET`
and `ADMIN_PASSWORD_HASH`). Use the real admin email:

```
ADMIN_USERNAME=support@kwajaug.org
```

No payment keys are needed — donations redirect to GoFundMe.

## 4. Start it with PM2

```bash
npm run pm2:start
pm2 save
pm2 startup   # prints a command — copy-paste and run it once,
              # so PM2 restarts the app automatically after a server reboot
```

The app listens on `PORT` from `.env` (default `3000`) — not exposed to the
internet directly, nginx will proxy to it.

## 5. nginx reverse proxy

Create `/etc/nginx/sites-available/kwajaug.org`:

```nginx
server {
    listen 80;
    server_name kwajaug.org www.kwajaug.org;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/kwajaug.org /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 6. TLS certificate

```bash
sudo certbot --nginx -d kwajaug.org -d www.kwajaug.org
```

Certbot edits the nginx config to add the HTTPS block and sets up
auto-renewal. Confirm `https://kwajaug.org` loads, then set
`secure: true` in the cookie-session config and restart.

## 7. Firewall

Only nginx (80/443) needs to be open to the world — the Node app itself
(port 3000) should not be:

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

## 8. First content on production

The production database starts with seeded gallery/team content, but blog
posts do **not** seed — log in at `https://kwajaug.org/admin` and
re-create the welcome post, paste the real TikTok spotlight links, and
review the gallery. (Or copy `data/blog.db` + `uploads/` from your local
machine to migrate everything at once.)

## 9. Ongoing maintenance

- **Backups:** `data/blog.db` is the entire database (posts, gallery,
  videos, members). Back it up regularly along with uploads:
  ```bash
  cp data/blog.db backups/blog-$(date +%F).db
  rsync -a uploads/ backups/uploads-$(date +%F)/
  ```
- **Deploying updates:**
  ```bash
  git pull
  npm install   # only needed if package.json changed
  npm run pm2:restart
  ```
- **Logs:** `npm run pm2:logs`, or `pm2 logs kwajaug --lines 200`
- **Renewing TLS:** certbot sets up auto-renewal via a systemd timer or cron
  job — check it's active with `sudo certbot renew --dry-run`.
