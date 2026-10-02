// src/db.js
// Data layer for Kwaja Uganda — posts, gallery, and TikTok spotlight videos.
// Backed by SQLite (data/blog.db).

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'blog.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    subtitle      TEXT,
    slug          TEXT NOT NULL UNIQUE,
    cover_image   TEXT,
    body_markdown TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'draft',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    published_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS gallery (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    image_url     TEXT NOT NULL,
    category      TEXT DEFAULT 'general',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS videos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    tiktok_url    TEXT NOT NULL,
    video_id      TEXT NOT NULL,
    caption       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS members (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL,
    bio           TEXT,
    photo_url     TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Lightweight migration: older databases lack videos.embed_url.
try {
  const cols = db.prepare('PRAGMA table_info(videos)').all();
  if (cols.length && !cols.some((c) => c.name === 'embed_url')) {
    db.exec('ALTER TABLE videos ADD COLUMN embed_url TEXT');
  }
  // Backfill: numeric TikTok IDs saved before embed_url existed.
  try {
    db.exec(`UPDATE videos SET embed_url = 'https://www.tiktok.com/embed/v2/' || video_id
             WHERE (embed_url IS NULL OR embed_url = '') AND video_id GLOB '[0-9]*'`);
  } catch (e) {
    console.error('videos.embed_url backfill failed:', e.message);
  }
} catch (e) {
  console.error('videos.embed_url migration failed:', e.message);
}

// Seed default gallery images if empty
const countGallery = db.prepare('SELECT COUNT(*) as count FROM gallery').get();
if (countGallery.count === 0) {
  const defaultImages = [
    { title: 'Joyful Smiles', image_url: '/images/kwajaug-images/kwaja-children-1.jpg', category: 'Children' },
    { title: 'Daily Meals & Care', image_url: '/images/kwajaug-images/kwaja-children-2.jpg', category: 'Nutrition' },
    { title: 'Nutritious Food for All', image_url: '/images/kwajaug-images/kwaja-children-4.jpg', category: 'Nutrition' },
    { title: 'Sharing with Love', image_url: '/images/kwajaug-images/kwaja-children-5.jpg', category: 'Children' },
    { title: 'Breakfast Together', image_url: '/images/kwajaug-images/kwaja-children-6.jpg', category: 'Nutrition' },
    { title: 'Laughter & Healing', image_url: '/images/kwajaug-images/kwaja-children-3.jpg', category: 'Community' },
    { title: 'Together as Family', image_url: '/images/kwajaug-images/kwaja-children-7.jpg', category: 'Community' },
    { title: 'Community & Belonging', image_url: '/images/kwajaug-images/kwaja-program-1.jpg', category: 'Community' },
    { title: 'Food Security Harvest', image_url: '/images/kwajaug-images/kwaja-children-8.jpg', category: 'Nutrition' },
    { title: 'Director with Community Partner', image_url: '/images/kwajaug-images/kwaja-program-2.jpg', category: 'Community' },
  ];
  const insertGal = db.prepare('INSERT INTO gallery (title, image_url, category) VALUES (@title, @image_url, @category)');
  for (const img of defaultImages) {
    insertGal.run(img);
  }
}

// Spotlight videos are intentionally NOT seeded: the admin pastes real
// TikTok Share-link URLs via /admin, which are normalized to embed URLs.
// An empty table keeps the homepage's static fallback card until then.

// Seed Director into members table if empty
const countMembers = db.prepare('SELECT COUNT(*) as count FROM members').get();
if (countMembers.count === 0) {
  const insertMember = db.prepare('INSERT INTO members (name, role, bio, photo_url) VALUES (@name, @role, @bio, @photo_url)');
  insertMember.run({
    name: 'Tenywa Fatiik',
    role: 'Orphanage Director',
    bio: 'Director and visionary leader of Kwaja Uganda. Dedicated to rescuing, sheltering, and nurturing vulnerable children with safety, education, and love.',
    photo_url: '/images/kwajaug-images/kwaja-program-2.jpg'
  });
}

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'post';
}

function uniqueSlug(title, ignoreId = null) {
  const base = slugify(title);
  let slug = base;
  let n = 2;
  const existsStmt = ignoreId
    ? db.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?')
    : db.prepare('SELECT id FROM posts WHERE slug = ?');
  while (ignoreId ? existsStmt.get(slug, ignoreId) : existsStmt.get(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

const queries = {
  listPublished: db.prepare(`SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC`),
  listAll: db.prepare(`SELECT * FROM posts ORDER BY created_at DESC`),
  getBySlug: db.prepare('SELECT * FROM posts WHERE slug = ?'),
  getById: db.prepare('SELECT * FROM posts WHERE id = ?'),
  insert: db.prepare(`
    INSERT INTO posts (title, subtitle, slug, cover_image, body_markdown, status, published_at)
    VALUES (@title, @subtitle, @slug, @cover_image, @body_markdown, @status, @published_at)
  `),
  update: db.prepare(`
    UPDATE posts SET
      title = @title,
      subtitle = @subtitle,
      slug = @slug,
      cover_image = COALESCE(@cover_image, cover_image),
      body_markdown = @body_markdown,
      status = @status,
      published_at = @published_at,
      updated_at = datetime('now')
    WHERE id = @id
  `),
  delete: db.prepare('DELETE FROM posts WHERE id = ?'),

  // Gallery
  listGallery: db.prepare('SELECT * FROM gallery ORDER BY id DESC'),
  insertGallery: db.prepare('INSERT INTO gallery (title, image_url, category) VALUES (@title, @image_url, @category)'),
  deleteGallery: db.prepare('DELETE FROM gallery WHERE id = ?'),

  // Videos
  listVideos: db.prepare('SELECT * FROM videos ORDER BY id DESC'),
  insertVideo: db.prepare('INSERT INTO videos (title, tiktok_url, video_id, caption, embed_url) VALUES (@title, @tiktok_url, @video_id, @caption, @embed_url)'),
  deleteVideo: db.prepare('DELETE FROM videos WHERE id = ?'),

  // Members
  listMembers: db.prepare('SELECT * FROM members ORDER BY id ASC'),
  insertMember: db.prepare('INSERT INTO members (name, role, bio, photo_url) VALUES (@name, @role, @bio, @photo_url)'),
  deleteMember: db.prepare('DELETE FROM members WHERE id = ?'),
};

const settingsQueries = {
  get: db.prepare('SELECT value FROM settings WHERE key = ?'),
  set: db.prepare(`
    INSERT INTO settings (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = @value
  `),
};

module.exports = {
  db,
  uniqueSlug,
  listPublished: () => queries.listPublished.all(),
  listAll: () => queries.listAll.all(),
  getBySlug: (slug) => queries.getBySlug.get(slug),
  getById: (id) => queries.getById.get(id),

  // Gallery
  listGallery: () => queries.listGallery.all(),
  addGalleryItem: ({ title, image_url, category }) => queries.insertGallery.run({ title: title || 'Kwaja Photo', image_url, category: category || 'general' }),
  deleteGalleryItem: (id) => queries.deleteGallery.run(id),

  // Videos
  listVideos: () => queries.listVideos.all(),
  addVideoItem: ({ title, tiktok_url, video_id, caption, embed_url }) => queries.insertVideo.run({ title: title || 'Kwaja Video', tiktok_url, video_id, caption: caption || '', embed_url: embed_url || null }),
  deleteVideoItem: (id) => queries.deleteVideo.run(id),

  // Members
  listMembers: () => queries.listMembers.all(),
  addMemberItem: ({ name, role, bio, photo_url }) => queries.insertMember.run({ name, role, bio: bio || '', photo_url: photo_url || null }),
  deleteMemberItem: (id) => queries.deleteMember.run(id),

  getSetting: (key) => settingsQueries.get.get(key)?.value ?? null,
  setSetting: (key, value) => settingsQueries.set.run({ key, value }),

  createPost({ title, subtitle, body_markdown, cover_image, status }) {
    const slug = uniqueSlug(title);
    const published_at = status === 'published' ? new Date().toISOString() : null;
    const info = queries.insert.run({
      title, subtitle: subtitle || '', slug,
      cover_image: cover_image || null,
      body_markdown, status, published_at,
    });
    return queries.getById.get(info.lastInsertRowid);
  },

  updatePost(id, { title, subtitle, body_markdown, cover_image, status }) {
    const existing = queries.getById.get(id);
    if (!existing) return null;
    const slug = title !== existing.title ? uniqueSlug(title, id) : existing.slug;
    const published_at =
      status === 'published'
        ? (existing.published_at || new Date().toISOString())
        : null;
    queries.update.run({
      id, title, subtitle: subtitle || '', slug,
      cover_image: cover_image || null,
      body_markdown, status, published_at,
    });
    return queries.getById.get(id);
  },

  deletePost(id) {
    return queries.delete.run(id);
  },
};
