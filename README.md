# Kwaja Uganda — Orphanage Site + Blog

“Love heals broken worlds. We nurture forgotten souls with safety.”

Kwaja Uganda (`https://kwajaug.org`) is the home page of the Kwaja Uganda
orphanage, directed by Tenywa Fatiik. The static landing page (`public/`)
covers mission, programs, photo gallery, a TikTok spotlight card, updates
preview, and a GoFundMe donate section. On top of it sits a small blog: a
public `/blog`, a `/members` team page, and a password-protected `/admin`
where the owner publishes posts and manages the gallery, spotlight videos,
and team members. Donations go directly to the official GoFundMe campaign —
no payment keys live anywhere in this codebase.

## Why SQLite

One admin writes occasionally; anyone can read. That's exactly the shape
SQLite is built for. It's a single file (`data/blog.db`) — no separate
database server to install, configure, back up, or secure. Backing up the
site content is `cp data/blog.db somewhere-safe.db` plus a copy of
`uploads/`. Restoring is copying them back. There's no `users` table
either — just one admin account, defined by two environment variables
(see below), because there's only ever one person logging in.

## Architecture, in one paragraph

`server.js` is the entire app: it serves the static site from `public/`,
the blog/team pages, JSON APIs (`/api/gallery`, `/api/videos`,
`/api/posts/recent`) that hydrate the homepage dynamically, and the admin
panel — all in the same process. One `node server.js` is the whole
deployment — no separate frontend build, no second service to run. Posts
are written as Markdown in a plain textarea and rendered to HTML on the
way out. Cover images and gallery uploads are saved to `uploads/` on disk
(not in the database). TikTok spotlight entries are admin-pasted video
links, normalized server-side to TikTok embed URLs — no video IDs or URLs
are hardcoded into page builds.

**Trade-off worth knowing:** the site needs a Node process running
continuously (PM2, in this setup) because logins, publishing, and uploads
all require a backend. That's the unavoidable cost of "log in and hit
Publish".

## Donations (GoFundMe)

Every donate button and the `/donate` route redirect to the official
GoFundMe fundraiser (`GOFUNDME_URL` in `server.js`). GoFundMe handles
cards, Apple Pay, Google Pay, and PayPal — this server never sees payment
details.

## Local setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```bash
# random session-signing secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# bcrypt hash of the real admin password
node -e "console.log(require('bcryptjs').hashSync('your-real-password', 10))"
```

Paste those into `SESSION_SECRET` and `ADMIN_PASSWORD_HASH` in `.env`, and
set `ADMIN_USERNAME` (e.g. `support@kwajaug.org`).

```bash
npm start
```

Visit `http://localhost:3000` for the site, `http://localhost:3000/blog`
for updates, `http://localhost:3000/members` for the team, and
`http://localhost:3000/admin` to log in and manage content.

## Running with PM2

```bash
npm install -g pm2   # if not already installed
npm install
cp .env.example .env # fill it in as described above
npm run pm2:start
pm2 save             # so it comes back after a reboot
```

`ecosystem.config.js` is the whole PM2 config — one process, named
`kwajaug`, running `server.js`. Useful commands:

```bash
npm run pm2:logs       # tail logs
npm run pm2:restart    # after pulling code changes
pm2 status              # see it's running
```

If you want it to survive a server reboot, run `pm2 startup` once (it
prints a command to copy-paste) and then `pm2 save`.

**Going to a real VPS?** See `DEPLOY.md` for the full walkthrough —
domain, HTTPS, nginx, firewall.

## Day-to-day: managing content

1. Go to `/admin`, log in.
2. **Blog:** "New Article" → title, optional subtitle, optional cover
   image, body (plain text or light Markdown). Leave "Published"
   unchecked for a draft, or check it to go live on `/blog`.
3. **Gallery:** add a photo via upload or image URL with a caption and
   category — it appears in the homepage grid automatically.
4. **Spotlight:** paste a TikTok video's Share → Copy link URL with a
   title — it renders in the centered homepage spotlight card. The admin
   list shows "Embed ✓" when the link resolves to a playable embed.
5. **Team:** add caregivers/board members with name, role, bio, photo —
   they appear on `/members`.

## Images

`public/images/kwajaug-images/` holds the curated site photos with stable
filenames (`kwaja-hero.jpg` and `kwaja-about.jpg` are sensitive medical
photos, kept off the homepage — see code comments before reusing them).
`public/images/README.md` documents every slot.

## Folder structure

```
server.js            entry point — all routes
src/db.js             SQLite schema + queries (posts, gallery, videos, members)
src/auth.js           single-admin login check
views/                 EJS templates (blog, members, admin)
public/                static site (index.html, style.css, script.js, images)
uploads/blog/          uploaded cover images (persist on disk, not in git)
uploads/gallery/       uploaded gallery images (persist on disk, not in git)
data/blog.db            the database — posts, gallery, videos, members
ecosystem.config.js      PM2 process config
DEPLOY.md               step-by-step VPS deployment guide
```

## Security notes

- Change `ADMIN_USERNAME`/password before going live.
- Once the site is served over HTTPS, set `secure: true` in the
  cookie-session config in `server.js` so the session cookie is
  HTTPS-only.
- The admin body editor trusts the logged-in admin's Markdown/HTML input —
  there's exactly one admin account, so this is intentional. Don't share
  admin credentials with anyone you wouldn't trust to edit the site directly.
- Never commit `.env` — it holds the session secret and password hash.
