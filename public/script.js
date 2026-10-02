// script.js — Kwaja Uganda frontend logic

(function () {
  'use strict';

  // =============================================
  // 1. DARK / LIGHT MODE TOGGLE
  // =============================================
  const html = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle') || document.getElementById('theme-toggle-btn');
  const THEME_KEY = 'kwaja-theme';

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    if (themeToggle) themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  // Restore saved preference or respect OS setting
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    applyTheme(saved);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const current = html.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // =============================================
  // 2. MOBILE NAV TOGGLE
  // =============================================
  const navToggle = document.getElementById('nav-toggle') || document.getElementById('mobile-nav-toggle');
  const siteNav   = document.getElementById('site-nav') || document.querySelector('.site-nav');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function () {
      const open = siteNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open);
    });
    // Close nav on link click
    siteNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        siteNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // =============================================
  // 3. FOOTER YEAR
  // =============================================
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // =============================================
  // 4. DONATE — custom amount field
  // =============================================
  const customRadio = document.getElementById('amount-custom-radio');
  const customRow   = document.getElementById('donate-custom-row');
  if (customRadio && customRow) {
    document.querySelectorAll('input[name="amount"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        customRow.hidden = radio.value !== 'custom';
      });
    });
  }

  // =============================================
  // 5. GALLERY — fetch & render
  // =============================================
  const galleryGrid  = document.getElementById('gallery-grid');
  const galleryEmpty = document.getElementById('gallery-empty');
  const lightbox     = document.getElementById('lightbox');
  const lightboxImg  = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');

  function openLightbox(src, alt) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    lightboxImg.src = '';
    document.body.style.overflow = '';
  }
  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  if (galleryGrid) {
    fetch('/api/gallery')
      .then(function (r) { return r.json(); })
      .then(function (images) {
        if (!images || images.length === 0) {
          if (galleryEmpty) galleryEmpty.style.display = '';
          return;
        }
        galleryGrid.innerHTML = ''; // clear initial placeholders if dynamic available
        images.slice(0, 12).forEach(function (img) {
          var item = document.createElement('div');
          item.className = 'gallery-item';
          item.setAttribute('tabindex', '0');
          item.setAttribute('role', 'button');
          item.setAttribute('aria-label', img.title || 'View photo');
          
          var imgSrc = img.image_url || img.filepath;
          var el = document.createElement('img');
          el.src = imgSrc;
          el.alt = img.title || 'Kwaja Uganda photo';
          el.loading = 'lazy';
          item.appendChild(el);

          var overlay = document.createElement('div');
          overlay.className = 'gallery-overlay';
          overlay.innerHTML = '<span>' + (img.title || 'Kwaja Uganda') + '</span>';
          item.appendChild(overlay);

          item.addEventListener('click', function () { openLightbox(imgSrc, el.alt); });
          item.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') openLightbox(imgSrc, el.alt); });
          galleryGrid.appendChild(item);
        });
      })
      .catch(function (err) {
        console.log('Gallery fetch fallback:', err);
      });
  }

  // =============================================
  // 6. TIKTOK SPOTLIGHT — one centered card, embed URLs only
  // =============================================
  var spotlightVideos = [];
  var spotlightIndex  = 0;

  var spotlightCard      = document.getElementById('spotlight-card');
  var spotlightEmbed     = document.getElementById('tiktok-embed-container');
  var spotlightTitle     = document.getElementById('spotlight-title');
  var spotlightCount     = document.getElementById('spotlight-count');
  var spotlightDots      = document.getElementById('spotlight-dots');
  var spotlightPrev      = document.getElementById('spotlight-prev');
  var spotlightNext      = document.getElementById('spotlight-next');

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Server sends a normalized embed_url; fall back to parsing a watch URL.
  function tiktokEmbedSrc(v) {
    if (v.embed_url) return v.embed_url;
    var url = v.tiktok_url || '';
    var match = url.match(/(?:video|embed\/v2)\/(\d+)/);
    if (match) return 'https://www.tiktok.com/embed/v2/' + match[1];
    if (v.video_id && /^\d+$/.test(v.video_id)) {
      return 'https://www.tiktok.com/embed/v2/' + v.video_id;
    }
    return null;
  }

  function renderSpotlight(index) {
    if (!spotlightVideos.length) return;
    var v = spotlightVideos[index];
    if (!v) return;

    if (spotlightEmbed) {
      spotlightEmbed.innerHTML = '';
      var embedSrc = tiktokEmbedSrc(v);
      if (embedSrc) {
        var iframe = document.createElement('iframe');
        iframe.src = embedSrc;
        iframe.setAttribute('loading', 'lazy');
        iframe.setAttribute('allow', 'encrypted-media; picture-in-picture; fullscreen');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('scrolling', 'no');
        iframe.title = v.title || 'Kwaja Uganda TikTok video';
        spotlightEmbed.appendChild(iframe);
      } else {
        var safeUrl = /^https?:\/\//.test(v.tiktok_url || '') ? v.tiktok_url : 'https://www.tiktok.com/@kwajaug';
        spotlightEmbed.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:420px;color:#fff;padding:24px;text-align:center;">' +
          '<p style="margin-bottom:12px;">' + escapeHtml(v.caption || v.title || 'Kwaja Uganda') + '</p>' +
          '<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener" class="btn btn-gold" style="font-size:0.85rem;padding:8px 16px;">Watch on TikTok &rarr;</a>' +
          '</div>';
      }
    }

    if (spotlightTitle) spotlightTitle.textContent = v.title || 'Kwaja Uganda Video';
    if (spotlightCount) spotlightCount.textContent = spotlightVideos.length > 1
      ? ('Video ' + (index + 1) + ' of ' + spotlightVideos.length)
      : 'Featured video';

    if (spotlightDots) {
      Array.from(spotlightDots.children).forEach(function (dot, i) {
        dot.classList.toggle('active', i === index);
        dot.setAttribute('aria-current', i === index ? 'true' : 'false');
      });
    }
  }

  function goToSlide(index) {
    if (!spotlightVideos.length) return;
    spotlightIndex = ((index % spotlightVideos.length) + spotlightVideos.length) % spotlightVideos.length;
    renderSpotlight(spotlightIndex);
  }

  if (spotlightPrev) spotlightPrev.addEventListener('click', function () { goToSlide(spotlightIndex - 1); });
  if (spotlightNext) spotlightNext.addEventListener('click', function () { goToSlide(spotlightIndex + 1); });
  document.addEventListener('keydown', function (e) {
    if (!spotlightVideos.length) return;
    if (e.key === 'ArrowLeft' && document.activeElement &&
        spotlightCard && spotlightCard.contains(document.activeElement)) goToSlide(spotlightIndex - 1);
    if (e.key === 'ArrowRight' && document.activeElement &&
        spotlightCard && spotlightCard.contains(document.activeElement)) goToSlide(spotlightIndex + 1);
  });

  // Touch swipe on the card
  if (spotlightCard) {
    var touchX = null;
    spotlightCard.addEventListener('touchstart', function (e) {
      touchX = e.changedTouches[0].clientX;
    }, { passive: true });
    spotlightCard.addEventListener('touchend', function (e) {
      if (touchX == null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) < 40) return;
      goToSlide(spotlightIndex + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  if (spotlightCard && spotlightEmbed) {
    fetch('/api/videos')
      .then(function (r) { return r.json(); })
      .then(function (videos) {
        if (!videos || videos.length === 0) return; // keep static fallback
        spotlightVideos = videos;

        if (spotlightDots) {
          spotlightDots.innerHTML = '';
          videos.forEach(function (_, i) {
            var dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'spotlight-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', 'Go to video ' + (i + 1));
            dot.addEventListener('click', function () { goToSlide(i); });
            spotlightDots.appendChild(dot);
          });
          spotlightDots.style.display = videos.length > 1 ? '' : 'none';
        }

        var showNav = videos.length > 1;
        if (spotlightPrev) spotlightPrev.style.display = showNav ? '' : 'none';
        if (spotlightNext) spotlightNext.style.display = showNav ? '' : 'none';

        renderSpotlight(0);
      })
      .catch(function () { /* keep static fallback content */ });
  }

  // =============================================
  // 7. BLOG PREVIEW — fetch & render
  // =============================================
  var blogGrid  = document.getElementById('blog-grid');
  var blogEmpty = document.getElementById('blog-empty');

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  if (blogGrid) {
    fetch('/api/posts/recent')
      .then(function (r) { return r.json(); })
      .then(function (posts) {
        if (!posts || posts.length === 0) {
          if (blogEmpty) blogEmpty.style.display = '';
          return;
        }
        blogGrid.innerHTML = '';
        posts.forEach(function (post) {
          var card = document.createElement('article');
          card.className = 'blog-card';

          var coverHtml = '';
          if (post.cover_image) {
            coverHtml = '<div class="blog-card-cover"><img src="' + post.cover_image + '" alt="' + (post.title || '') + '" loading="lazy"></div>';
          }

          card.innerHTML = coverHtml +
            '<div class="blog-card-body">' +
              '<p class="blog-card-date">' + formatDate(post.published_at || post.created_at) + '</p>' +
              '<h3>' + (post.title || '') + '</h3>' +
              '<p>' + (post.excerpt || '') + '</p>' +
              '<a href="/blog/' + post.slug + '" class="blog-card-link">Read story &rarr;</a>' +
            '</div>';

          blogGrid.appendChild(card);
        });
      })
      .catch(function () {
        if (blogEmpty) blogEmpty.style.display = '';
      });
  }

})();
