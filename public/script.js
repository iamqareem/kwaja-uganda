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
  // 6. TIKTOK SPOTLIGHT SLIDESHOW
  // =============================================
  var spotlightVideos = [];
  var spotlightIndex  = 0;
  var spotlightTimer  = null;

  var spotlightStage     = document.getElementById('spotlight-stage');
  var spotlightEmpty     = document.getElementById('spotlight-empty');
  var spotlightCard      = document.getElementById('spotlight-card');
  var spotlightEmbed     = document.getElementById('tiktok-embed-container');
  var spotlightTitle     = document.getElementById('spotlight-title');
  var spotlightCount     = document.getElementById('spotlight-count');
  var spotlightDots      = document.getElementById('spotlight-dots');
  var spotlightPrev      = document.getElementById('spotlight-prev');
  var spotlightNext      = document.getElementById('spotlight-next');

  function tiktokEmbedSrc(url, videoId) {
    if (videoId && /^\d+$/.test(videoId)) {
      return 'https://www.tiktok.com/embed/v2/' + videoId;
    }
    var match = (url || '').match(/video\/(\d+)/);
    if (match) {
      return 'https://www.tiktok.com/embed/v2/' + match[1];
    }
    return null;
  }

  function renderSpotlight(index) {
    if (!spotlightVideos.length) return;
    var v = spotlightVideos[index];
    if (!v) return;

    if (spotlightEmbed) {
      spotlightEmbed.innerHTML = '';
      var embedSrc = tiktokEmbedSrc(v.tiktok_url, v.video_id);
      if (embedSrc) {
        var iframe = document.createElement('iframe');
        iframe.src = embedSrc;
        iframe.allow = 'autoplay; clipboard-write; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.title = v.title || 'Kwaja Uganda TikTok video';
        spotlightEmbed.appendChild(iframe);
      } else {
        spotlightEmbed.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#fff;padding:24px;text-align:center;">' +
          '<p style="margin-bottom:12px;">' + (v.caption || v.title) + '</p>' +
          '<a href="' + (v.tiktok_url || 'https://www.tiktok.com/@kwajaug') + '" target="_blank" rel="noopener" class="btn btn-gold" style="font-size:0.85rem;padding:8px 16px;">Watch on TikTok &rarr;</a>' +
          '</div>';
      }
    }

    if (spotlightTitle) spotlightTitle.textContent = v.title || 'Kwaja Uganda Video';
    if (spotlightCount) spotlightCount.textContent = (index + 1) + ' of ' + spotlightVideos.length;

    if (spotlightDots) {
      Array.from(spotlightDots.children).forEach(function (dot, i) {
        dot.classList.toggle('active', i === index);
      });
    }
  }

  function goToSlide(index) {
    spotlightIndex = (index + spotlightVideos.length) % spotlightVideos.length;
    renderSpotlight(spotlightIndex);
    resetTimer();
  }

  function resetTimer() {
    clearInterval(spotlightTimer);
    if (spotlightVideos.length > 1) {
      spotlightTimer = setInterval(function () { goToSlide(spotlightIndex + 1); }, 8000);
    }
  }

  if (spotlightCard) {
    spotlightCard.addEventListener('mouseenter', function () { clearInterval(spotlightTimer); });
    spotlightCard.addEventListener('mouseleave', resetTimer);
  }
  if (spotlightPrev) spotlightPrev.addEventListener('click', function () { goToSlide(spotlightIndex - 1); });
  if (spotlightNext) spotlightNext.addEventListener('click', function () { goToSlide(spotlightIndex + 1); });

  if (spotlightStage) {
    fetch('/api/videos')
      .then(function (r) { return r.json(); })
      .then(function (videos) {
        if (!videos || videos.length === 0) {
          if (spotlightEmpty) spotlightEmpty.style.display = '';
          return;
        }
        spotlightVideos = videos;
        spotlightStage.style.display = 'flex';

        if (spotlightDots) {
          spotlightDots.innerHTML = '';
          videos.forEach(function (_, i) {
            var dot = document.createElement('button');
            dot.className = 'spotlight-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', 'Go to video ' + (i + 1));
            dot.addEventListener('click', function () { goToSlide(i); });
            spotlightDots.appendChild(dot);
          });
        }

        if (videos.length <= 1) {
          if (spotlightPrev) spotlightPrev.style.display = 'none';
          if (spotlightNext) spotlightNext.style.display = 'none';
        }

        renderSpotlight(0);
        resetTimer();
      })
      .catch(function () {
        if (spotlightEmpty) spotlightEmpty.style.display = '';
      });
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
