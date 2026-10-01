// server.js
// Kwaja Uganda Node.js / Express web application
// Serves static website, EJS pages, SQLite blog, media uploads, and admin panel.

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieSession = require('cookie-session');
const multer = require('multer');
const { marked } = require('marked');

const db = require('./src/db');
const { checkCredentials, requireAuth } = require('./src/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const GOFUNDME_URL = 'https://gofund.me/e6ba4562';

if (!process.env.SESSION_SECRET) {
  console.error('Missing SESSION_SECRET in environment. See .env.example. Exiting.');
  process.exit(1);
}
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH) {
  console.error('Missing ADMIN_USERNAME / ADMIN_PASSWORD_HASH in environment. See .env.example. Exiting.');
  process.exit(1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(
  cookieSession({
    name: 'session',
    secret: process.env.SESSION_SECRET,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
  })
);

// ---- Upload Setup ----
const BLOG_UPLOAD_DIR = path.join(__dirname, 'uploads', 'blog');
const GALLERY_UPLOAD_DIR = path.join(__dirname, 'uploads', 'gallery');
if (!fs.existsSync(BLOG_UPLOAD_DIR)) fs.mkdirSync(BLOG_UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(GALLERY_UPLOAD_DIR)) fs.mkdirSync(GALLERY_UPLOAD_DIR, { recursive: true });

const blogStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BLOG_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${safeExt}`);
  },
});
const galleryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, GALLERY_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `gallery-${Date.now()}-${Math.round(Math.random() * 1e6)}${safeExt}`);
  },
});

const uploadBlog = multer({
  storage: blogStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
    cb(ok ? null : new Error('Only JPG, PNG, WEBP, or GIF images are allowed'), ok);
  },
});

const uploadGallery = multer({
  storage: galleryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  },
});

// =========================================================
// API ENDPOINTS FOR FRONTEND DYNAMIC HYDRATION
// =========================================================

app.get('/api/gallery', (req, res) => {
  res.json(db.listGallery());
});

app.get('/api/videos', (req, res) => {
  res.json(db.listVideos());
});

app.get('/api/posts/recent', (req, res) => {
  const list = db.listPublished().slice(0, 3).map((p) => ({
    ...p,
    excerpt: markdownExcerpt(p.body_markdown),
  }));
  res.json(list);
});

// =========================================================
// MEMBERS / TEAM ROUTE
// =========================================================

app.get('/members', (req, res) => {
  res.render('members', {
    members: db.listMembers(),
    pageTitle: 'Team & Members | Kwaja Uganda',
    pageDescription: 'Meet Orphanage Director Tenywa Fatiik and the dedicated team behind Kwaja Uganda orphanage.',
  });
});

// =========================================================
// PUBLIC BLOG ROUTES
// =========================================================

app.get('/blog', (req, res) => {
  const list = db.listPublished().map((p) => ({
    ...p,
    excerpt: markdownExcerpt(p.body_markdown),
  }));
  res.render('blog-list', {
    posts: list,
    pageTitle: 'Blog & News | Kwaja Uganda',
    pageDescription: 'Stories of hope, rescue, and transformation from Kwaja Uganda orphanage.',
  });
});

app.get('/blog/:slug', (req, res) => {
  const post = db.getBySlug(req.params.slug);
  if (!post || post.status !== 'published') {
    return res.status(404).render('blog-post', {
      post: null,
      pageTitle: 'Post Not Found | Kwaja Uganda',
      pageDescription: '',
    });
  }
  res.render('blog-post', {
    post,
    bodyHtml: marked.parse(post.body_markdown),
    pageTitle: `${post.title} | Kwaja Uganda`,
    pageDescription: post.subtitle || '',
  });
});

function markdownExcerpt(md, maxLen = 160) {
  const text = md.replace(/[#*_>`\-\[\]()!]/g, '').replace(/\s+/g, ' ').trim();
  return text.length > maxLen ? text.slice(0, maxLen).trim() + '…' : text;
}

// =========================================================
// DONATION ROUTE (Direct GoFundMe Redirection)
// =========================================================

app.get('/donate', (req, res) => {
  res.redirect(302, GOFUNDME_URL);
});

app.post('/donate/start', (req, res) => {
  res.redirect(302, GOFUNDME_URL);
});

// =========================================================
// ADMIN ROUTES
// =========================================================

app.get('/admin/login', (req, res) => {
  res.render('admin-login', { error: null, pageTitle: 'Admin Login | Kwaja Uganda' });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (checkCredentials(username, password)) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.status(401).render('admin-login', {
    error: 'Incorrect username or password.',
    pageTitle: 'Admin Login | Kwaja Uganda',
  });
});

app.post('/admin/logout', (req, res) => {
  req.session = null;
  res.redirect('/admin/login');
});

// Admin Dashboard - Posts, Gallery, Videos, Members
app.get('/admin', requireAuth, (req, res) => {
  res.render('admin-dashboard', {
    posts: db.listAll(),
    gallery: db.listGallery(),
    videos: db.listVideos(),
    members: db.listMembers(),
    pageTitle: 'Admin Dashboard | Kwaja Uganda',
  });
});

// Posts Management
app.get('/admin/posts/new', requireAuth, (req, res) => {
  res.render('admin-post-form', { post: null, error: null, pageTitle: 'New Post | Kwaja Uganda Admin' });
});

app.post('/admin/posts', requireAuth, uploadBlog.single('cover_image'), (req, res) => {
  try {
    const { title, subtitle, body_markdown, status } = req.body;
    if (!title || !title.trim() || !body_markdown || !body_markdown.trim()) {
      return res.status(400).render('admin-post-form', {
        post: req.body,
        error: 'Title and body are required.',
        pageTitle: 'New Post | Kwaja Uganda Admin',
      });
    }
    const created = db.createPost({
      title: title.trim(),
      subtitle: (subtitle || '').trim(),
      body_markdown,
      cover_image: req.file ? `/uploads/blog/${req.file.filename}` : null,
      status: status === 'published' ? 'published' : 'draft',
    });
    res.redirect(`/admin/posts/${created.id}/edit`);
  } catch (err) {
    console.error(err);
    res.status(500).render('admin-post-form', {
      post: req.body,
      error: 'Something went wrong saving the post.',
      pageTitle: 'New Post | Kwaja Uganda Admin',
    });
  }
});

app.get('/admin/posts/:id/edit', requireAuth, (req, res) => {
  const post = db.getById(req.params.id);
  if (!post) return res.redirect('/admin');
  res.render('admin-post-form', { post, error: null, pageTitle: 'Edit Post | Kwaja Uganda Admin' });
});

app.post('/admin/posts/:id', requireAuth, uploadBlog.single('cover_image'), (req, res) => {
  try {
    const { title, subtitle, body_markdown, status } = req.body;
    if (!title || !title.trim() || !body_markdown || !body_markdown.trim()) {
      return res.status(400).render('admin-post-form', {
        post: { ...req.body, id: req.params.id },
        error: 'Title and body are required.',
        pageTitle: 'Edit Post | Kwaja Uganda Admin',
      });
    }
    db.updatePost(req.params.id, {
      title: title.trim(),
      subtitle: (subtitle || '').trim(),
      body_markdown,
      cover_image: req.file ? `/uploads/blog/${req.file.filename}` : null,
      status: status === 'published' ? 'published' : 'draft',
    });
    res.redirect(`/admin/posts/${req.params.id}/edit`);
  } catch (err) {
    console.error(err);
    res.status(500).render('admin-post-form', {
      post: { ...req.body, id: req.params.id },
      error: 'Something went wrong saving the post.',
      pageTitle: 'Edit Post | Kwaja Uganda Admin',
    });
  }
});

app.post('/admin/posts/:id/delete', requireAuth, (req, res) => {
  db.deletePost(req.params.id);
  res.redirect('/admin');
});

// Gallery Management
app.post('/admin/gallery', requireAuth, uploadGallery.single('gallery_image'), (req, res) => {
  try {
    const title = (req.body.title || '').trim() || 'Kwaja Photo';
    const category = (req.body.category || 'general').trim();
    let imageUrl = '';

    if (req.file) {
      imageUrl = `/uploads/gallery/${req.file.filename}`;
    } else if (req.body.image_url && req.body.image_url.trim()) {
      imageUrl = req.body.image_url.trim();
    } else {
      return res.redirect('/admin#gallery-section');
    }

    db.addGalleryItem({ title, image_url: imageUrl, category });
    res.redirect('/admin#gallery-section');
  } catch (err) {
    console.error('Failed to add gallery item:', err);
    res.redirect('/admin#gallery-section');
  }
});

app.post('/admin/gallery/:id/delete', requireAuth, (req, res) => {
  db.deleteGalleryItem(req.params.id);
  res.redirect('/admin#gallery-section');
});

// TikTok Spotlight Videos Management
app.post('/admin/videos', requireAuth, (req, res) => {
  try {
    const title = (req.body.title || '').trim() || 'Kwaja Video';
    const rawUrl = (req.body.tiktok_url || '').trim();
    const caption = (req.body.caption || '').trim();

    if (!rawUrl) {
      return res.redirect('/admin#videos-section');
    }

    let videoId = '';
    const match = rawUrl.match(/\/video\/(\d+)/);
    if (match && match[1]) {
      videoId = match[1];
    } else if (/^\d+$/.test(rawUrl)) {
      videoId = rawUrl;
    } else {
      videoId = Date.now().toString();
    }

    db.addVideoItem({
      title,
      tiktok_url: rawUrl,
      video_id: videoId,
      caption,
    });

    res.redirect('/admin#videos-section');
  } catch (err) {
    console.error('Failed to add video:', err);
    res.redirect('/admin#videos-section');
  }
});

app.post('/admin/videos/:id/delete', requireAuth, (req, res) => {
  db.deleteVideoItem(req.params.id);
  res.redirect('/admin#videos-section');
});

// Members Management
app.post('/admin/members', requireAuth, (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const role = (req.body.role || '').trim();
    const bio = (req.body.bio || '').trim();
    const photoUrl = (req.body.photo_url || '').trim();

    if (!name || !role) {
      return res.redirect('/admin#members-section');
    }

    db.addMemberItem({ name, role, bio, photo_url: photoUrl });
    res.redirect('/admin#members-section');
  } catch (err) {
    console.error('Failed to add member:', err);
    res.redirect('/admin#members-section');
  }
});

app.post('/admin/members/:id/delete', requireAuth, (req, res) => {
  db.deleteMemberItem(req.params.id);
  res.redirect('/admin#members-section');
});

app.listen(PORT, () => {
  console.log(`Kwaja Uganda website running at http://localhost:${PORT}`);
});
