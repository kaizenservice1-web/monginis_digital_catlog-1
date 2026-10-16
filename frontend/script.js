/* ==========================================================================
   Monginis Digital Catalog — Vanilla JS Core Application
   ========================================================================== */
(() => {
  'use strict';

  // API Base URL - Default to production Render deployment
  const DEFAULT_API_URL = 'https://monginis-digital-catlog-1.onrender.com';
  
  // Dynamic API URL with local fallback capability
  const getApiBaseUrl = () => {
    if (window.API_BASE_URL) return window.API_BASE_URL;
    return DEFAULT_API_URL;
  };

  const API_BASE_URL = getApiBaseUrl();

  // DOM Query Helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Global State
  const state = {
    shopInfo: null,
    categories: [],
    adminCakes: [],
    catalogPage: 1,
    catalogLimit: 12,
    catalogTotalPages: 1,
    catalogCategory: 'all',
    catalogSearch: '',
    catalogLoading: false,
    activeCatalogController: null,
  };

  const DEFAULT_SHOP_INFO = {
    address: 'Monginis Cake Shop, Beed Bypass, Near Nishant Park Hotel, CSN',
    phone: '9613661155',
    email: 'kaizenservice1@gmail.com',
    openingHours: 'Daily 10:00 AM – 9:00 PM',
    whatsappNumber: '919613661155',
    instagramUrl: '',
    facebookUrl: '',
    googleMapsUrl: 'https://maps.app.goo.gl/WbYHNrevSWsr88Fx5?g_st=ac',
    googleMapsEmbedUrl: '',
    googleReviewsUrl: '',
  };

  // Utilities
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[c]));
  
  const escapeAttr = (s) => escapeHtml(s);

  const slugifyStr = (str) => String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cake';

  const safeUrl = (maybeUrl) => {
    if (!maybeUrl || typeof maybeUrl !== 'string') return null;
    try {
      const url = new URL(maybeUrl);
      return url.toString();
    } catch {
      return null;
    }
  };

  // Cloudinary image transformation optimizer
  const optimizeCloudinaryUrl = (url, opts = {}) => {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
      return url;
    }
    const width = opts.width || 600;
    const crop = opts.crop || 'limit';
    // Insert auto-format, auto-quality, and responsive width
    const transform = `f_auto,q_auto,w_${width},c_${crop}`;
    return url.replace('/image/upload/', `/image/upload/${transform}/`);
  };

  // Network Fetch Wrapper with Signal & Error Handling
  const jsonFetch = async (path, opts = {}) => {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    let res;
    try {
      res = await fetch(url, {
        ...opts,
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          ...(opts.headers || {}),
        },
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw err;
      }
      throw new Error(`Network error while calling ${path}. Please check your connection.`);
    }

    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
      const message = (data && data.message) ? data.message : `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  };

  const authedFetch = (path, opts = {}) => {
    const token = localStorage.getItem('monginis_admin_token');
    return jsonFetch(path, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
  };

  const setYear = () => {
    $$('#year, .year-now').forEach(el => {
      el.textContent = new Date().getFullYear();
    });
  };

  const setBottomNavActive = () => {
    const page = document.body.dataset.page;
    const map = {
      home: 'home',
      catalog: 'catalog',
      contact: 'contact',
      about: 'about',
      details: 'catalog',
      'admin-login': 'admin',
      'admin-dashboard': 'admin',
    };
    const active = map[page] ?? null;
    if (!active) return;
    $$('.bottom-nav .bn').forEach(a => {
      a.classList.toggle('is-active', a.dataset.nav === active);
    });
  };

  // Mobile Navigation Drawer
  const initBurgerMenu = () => {
    const btn = $('.burger');
    const menu = $('#mobileMenu');
    if (!btn || !menu) return;

    const isMobile = () => window.matchMedia('(max-width: 980px)').matches;

    const openMenu = () => {
      menu.hidden = false;
      requestAnimationFrame(() => {
        menu.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      });
    };

    const closeMenu = () => {
      menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<i class="fa-solid fa-bars"></i>';

      const onEnd = () => {
        if (!menu.classList.contains('is-open')) menu.hidden = true;
      };
      menu.addEventListener('transitionend', onEnd, { once: true });
      setTimeout(onEnd, 320);
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.hidden || !menu.classList.contains('is-open');
      if (open) openMenu();
      else closeMenu();
    });

    document.addEventListener('click', (e) => {
      if (menu.hidden) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest('#mobileMenu') || target.closest('.burger')) return;
      closeMenu();
    });
  };

  const getCakePrimaryImageUrl = (cake) => {
    if (!cake) return null;
    const first = Array.isArray(cake.images) ? cake.images[0] : null;
    if (first) {
      if (typeof first === 'string') return safeUrl(first);
      if (typeof first === 'object') {
        return safeUrl(first.url) || safeUrl(first.secure_url) || safeUrl(first.secureUrl);
      }
    }
    return safeUrl(cake.imageUrl) || safeUrl(cake.thumbnailUrl) || safeUrl(cake.image);
  };

  const normalizePaged = (data) => {
    if (Array.isArray(data)) {
      return { items: data, page: 1, limit: data.length, total: data.length, totalPages: 1 };
    }
    return data || { items: [], page: 1, limit: 12, total: 0, totalPages: 1 };
  };

  const matchCategorySlug = (value) => {
    const raw = String(value || '').trim();
    if (!raw || raw.toLowerCase() === 'all') return 'all';
    const direct = state.categories.find((c) => c.slug === raw);
    if (direct) return direct.slug;
    const byName = state.categories.find((c) => c.name.toLowerCase() === raw.toLowerCase());
    return byName ? byName.slug : raw;
  };

  const compressImageFile = (file, opts = {}) => new Promise((resolve) => {
    const maxSize = Number(opts.maxSize || 1600);
    const quality = Number(opts.quality || 0.82);
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return resolve(file);
      }
      ctx.drawImage(img, 0, 0, width, height);

      const finish = (blob, mime, ext) => {
        URL.revokeObjectURL(url);
        if (!blob) return resolve(file);
        const name = file.name.replace(/\.[^/.]+$/, `.${ext}`);
        resolve(new File([blob], name, { type: mime }));
      };

      canvas.toBlob((blob) => {
        if (blob) return finish(blob, 'image/webp', 'webp');
        canvas.toBlob((fallback) => finish(fallback, 'image/jpeg', 'jpg'), 'image/jpeg', quality);
      }, 'image/webp', quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });

  const getShopLink = (info, type) => {
    if (!info) return '#';
    if (type === 'phone') return `tel:${String(info.phone || DEFAULT_SHOP_INFO.phone).replace(/\s+/g, '')}`;
    if (type === 'email') return `mailto:${String(info.email || DEFAULT_SHOP_INFO.email)}`;
    if (type === 'maps') return safeUrl(info.googleMapsUrl) || safeUrl(info.googleMapsEmbedUrl) || DEFAULT_SHOP_INFO.googleMapsUrl;
    return '#';
  };

  const makeWhatsAppLink = ({ whatsappNumber, message }) => {
    const digits = String(whatsappNumber || DEFAULT_SHOP_INFO.whatsappNumber).replace(/\D/g, '');
    const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/919613661155';
    const text = message ? `?text=${encodeURIComponent(message)}` : '';
    return `${base}${text}`;
  };

  const loadShopInfo = async () => {
    if (state.shopInfo) return state.shopInfo;
    try {
      const info = await jsonFetch('/api/shop-info');
      state.shopInfo = { ...DEFAULT_SHOP_INFO, ...(info || {}) };
      return state.shopInfo;
    } catch {
      state.shopInfo = { ...DEFAULT_SHOP_INFO };
      return state.shopInfo;
    }
  };

  const applyShopInfoToCommonUI = async () => {
    const info = await loadShopInfo();

    const footerAddr = $('#footerAddress');
    if (footerAddr) footerAddr.textContent = info.address || DEFAULT_SHOP_INFO.address;

    $$('[data-field="phone"]').forEach(el => el.textContent = info.phone || DEFAULT_SHOP_INFO.phone);
    $$('[data-field="email"]').forEach(el => el.textContent = info.email || DEFAULT_SHOP_INFO.email);
    $$('[data-field="address"]').forEach(el => el.textContent = info.address || DEFAULT_SHOP_INFO.address);
    $$('[data-field="openingHours"]').forEach(el => el.textContent = info.openingHours || DEFAULT_SHOP_INFO.openingHours);

    const phoneA = $('#contactPhone') || $('#quickPhone');
    if (phoneA) phoneA.setAttribute('href', getShopLink(info, 'phone'));

    const emailA = $('#contactEmail') || $('#quickEmail');
    if (emailA) emailA.setAttribute('href', getShopLink(info, 'email'));

    const contactMaps = $('#contactMaps');
    if (contactMaps) contactMaps.setAttribute('href', getShopLink(info, 'maps'));

    $$('[data-social="ig"]').forEach(el => el.setAttribute('href', safeUrl(info.instagramUrl) || '#'));
    $$('[data-social="fb"]').forEach(el => el.setAttribute('href', safeUrl(info.facebookUrl) || '#'));
    $$('[data-social="wa"]').forEach(el => el.setAttribute('href', makeWhatsAppLink({ whatsappNumber: info.whatsappNumber, message: 'Hello Monginis! I would like to inquire about your cakes.' })));

    const waFloat = $('#waFloat');
    if (waFloat) {
      waFloat.setAttribute('href', makeWhatsAppLink({ whatsappNumber: info.whatsappNumber, message: 'Hello Monginis! I would like to inquire about your cakes.' }));
      waFloat.setAttribute('target', '_blank');
      waFloat.setAttribute('rel', 'noopener noreferrer');
    }
  };

  // ==========================================================================
  // Phase Three: Cake Card Component (9:16 Portrait Image Container)
  // ==========================================================================
  const cakeCard = (cake) => {
    const img = getCakePrimaryImageUrl(cake);
    const optimizedImg = optimizeCloudinaryUrl(img, { width: 600, height: 1067, crop: 'limit' });
    const title = cake.name || 'Cake';
    const desc = cake.description || '';
    const category = cake.categoryName || (typeof cake.category === 'object' ? cake.category?.name : '') || '';
    const cakeId = String(cake._id || '');

    const el = document.createElement('article');
    el.className = 'cake-card';
    el.setAttribute('data-cake-id', cakeId);
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'article');
    el.setAttribute('aria-label', title);

    el.innerHTML = `
      <div class="cake-card__image">
        ${category ? `<span class="cake-card__badge">${escapeHtml(category)}</span>` : ''}
        ${img ? `
          <img src="${escapeAttr(optimizedImg)}" alt="${escapeAttr(title)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.onerror=null;this.style.opacity='1';this.parentElement.innerHTML='<div class=\\'empty\\'><i class=\\'fa-solid fa-cake-candles icon-pink\\'></i></div>';" />
        ` : `
          <div class="empty" style="border:none;box-shadow:none;background:transparent;height:100%;justify-content:center;" aria-hidden="true">
            <i class="fa-solid fa-cake-candles icon-pink" style="font-size:32px;"></i>
          </div>
        `}
      </div>
      <div class="cake-card__content">
        <h3 class="cake-card__title">${escapeHtml(title)}</h3>
        ${desc ? `<p class="cake-card__desc">${escapeHtml(desc)}</p>` : `<p class="cake-card__desc muted tiny">Freshly baked Monginis celebration design</p>`}
        <div class="cake-card__actions">
          <button class="reaction-btn like-btn" type="button" aria-label="Like ${escapeAttr(title)}" aria-pressed="false">
            <i class="fa-regular fa-heart"></i>
            <span class="count" data-count-like>${Number(cake.likes) || 0}</span>
          </button>
          <button class="reaction-btn dislike-btn" type="button" aria-label="Dislike ${escapeAttr(title)}" aria-pressed="false">
            <i class="fa-regular fa-thumbs-down"></i>
            <span class="count" data-count-dislike>${Number(cake.dislikes) || 0}</span>
          </button>
          ${img ? `
            <a class="card-action-icon download-btn" href="${escapeAttr(img)}" download="${escapeAttr(slugifyStr(title))}.jpg" target="_blank" rel="noopener noreferrer" aria-label="Download image of ${escapeAttr(title)}" title="Download cake image">
              <i class="fa-solid fa-download"></i>
            </a>
          ` : ''}
          <span class="cake-card__detail-link" aria-hidden="true">Details <i class="fa-solid fa-arrow-right"></i></span>
        </div>
      </div>
    `;

    // Navigate to details on click or Enter/Space key, preserving buttons
    const navigateToDetails = () => {
      if (cakeId) {
        location.href = `cake-details.html?id=${encodeURIComponent(cakeId)}`;
      }
    };

    el.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.cake-card__actions') || target.closest('button') || target.closest('a')) {
        return;
      }
      navigateToDetails();
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const target = e.target;
        if (target === el) {
          e.preventDefault();
          navigateToDetails();
        }
      }
    });

    return el;
  };

  // ==========================================================================
  // Phase Four: Skeleton Loaders (9:16 Portrait Image Container)
  // ==========================================================================
  const renderSkeletonGrid = (grid, count = 12) => {
    if (!grid) return;
    const cards = [];
    for (let i = 0; i < count; i += 1) {
      cards.push(`
        <div class="cake-card skeleton-card" aria-hidden="true">
          <div class="cake-card__image skeleton-shimmer"></div>
          <div class="cake-card__content">
            <div class="skeleton-pill skeleton-shimmer"></div>
            <div class="skeleton-title skeleton-shimmer"></div>
            <div class="skeleton-sub skeleton-shimmer"></div>
            <div class="cake-card__actions">
              <div class="skeleton-btn skeleton-shimmer"></div>
              <div class="skeleton-btn skeleton-shimmer"></div>
              <div class="skeleton-btn round skeleton-shimmer"></div>
            </div>
          </div>
        </div>
      `);
    }
    grid.innerHTML = cards.join('');
  };

  // Reaction Reactions Animation and Delegation
  const bumpCount = (el) => {
    if (!el) return;
    el.classList.remove('count-bump');
    void el.offsetWidth;
    el.classList.add('count-bump');
  };

  const triggerPulse = (btn) => {
    if (!btn) return;
    btn.classList.remove('is-pulse');
    void btn.offsetWidth;
    btn.classList.add('is-pulse');
  };

  const setReactionActive = (wrap, activeType) => {
    if (!wrap) return;
    const likeBtn = wrap.querySelector('.like-btn');
    const dislikeBtn = wrap.querySelector('.dislike-btn');
    if (likeBtn) {
      likeBtn.classList.toggle('is-active', activeType === 'like');
      likeBtn.setAttribute('aria-pressed', activeType === 'like' ? 'true' : 'false');
    }
    if (dislikeBtn) {
      dislikeBtn.classList.toggle('is-active', activeType === 'dislike');
      dislikeBtn.setAttribute('aria-pressed', activeType === 'dislike' ? 'true' : 'false');
    }
  };

  const wireCakeActionDelegation = (root) => {
    root.addEventListener('click', async (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const card = target.closest('.cake-card');
      if (!card) return;
      const cakeId = card.getAttribute('data-cake-id');
      if (!cakeId) return;

      const likeBtn = target.closest('button.like-btn');
      const dislikeBtn = target.closest('button.dislike-btn');
      if (!likeBtn && !dislikeBtn) return;

      e.stopPropagation();

      const action = likeBtn ? 'like' : 'dislike';
      setReactionActive(card, action);
      triggerPulse(likeBtn || dislikeBtn);

      const countEl = card.querySelector(`[data-count-${action}]`);
      const prevCount = countEl ? Number(countEl.textContent) || 0 : null;
      if (countEl) {
        countEl.textContent = String(prevCount + 1);
        bumpCount(countEl);
      }

      try {
        await jsonFetch(`/api/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cakeId }),
        });
      } catch (err) {
        if (countEl && prevCount !== null) {
          countEl.textContent = String(prevCount);
        }
        console.warn(`Could not save ${action}:`, err.message);
      }
    });
  };

  const loadCategories = async () => {
    if (state.categories.length) return state.categories;
    try {
      const cats = await jsonFetch('/api/categories');
      state.categories = Array.isArray(cats) ? cats : [];
      return state.categories;
    } catch {
      state.categories = [];
      return state.categories;
    }
  };

  // ==========================================================================
  // Page Initializer: Home
  // ==========================================================================
  const initHome = async () => {
    await applyShopInfoToCommonUI();

    const homeInput = $('#homeCategoryInput');
    const homeList = $('#homeCategoryList');
    const homeClear = $('#homeClearFilter');
    const homeCats = await loadCategories();

    if (homeList) {
      homeList.innerHTML = '<option value="All">All Categories</option>';
      homeCats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        homeList.appendChild(opt);
      });
    }

    const slider = $('#featuredSlider');
    const lovedRoot = $('#homeLoved');
    const catsRoot = $('#homeCategories');

    // Wire up delegation
    if (slider) wireCakeActionDelegation(slider);
    if (lovedRoot) wireCakeActionDelegation(lovedRoot);

    const loadFeatured = async (categorySlug) => {
      if (slider) renderSkeletonGrid(slider, 6);
      try {
        const query = categorySlug && categorySlug !== 'all'
          ? `?category=${encodeURIComponent(categorySlug)}&limit=10`
          : '?limit=10';
        const cakes = await jsonFetch(`/api/cakes${query}`);
        if (!slider) return;
        slider.innerHTML = '';
        const list = Array.isArray(cakes) ? cakes : (cakes.items || []);
        if (!list.length) {
          slider.innerHTML = '<div class="empty" style="grid-column:1/-1"><p class="muted">No cakes found in this category.</p></div>';
          return;
        }
        list.forEach(c => slider.appendChild(cakeCard(c)));
      } catch (err) {
        if (slider) slider.innerHTML = '<div class="empty" style="grid-column:1/-1"><p class="muted">Could not load cakes.</p></div>';
      }
    };

    // Load initial featured
    await loadFeatured('all');

    if (homeInput) {
      homeInput.addEventListener('change', () => {
        const slug = matchCategorySlug(homeInput.value);
        loadFeatured(slug);
      });
    }

    if (homeClear) {
      homeClear.addEventListener('click', () => {
        if (homeInput) homeInput.value = '';
        loadFeatured('all');
      });
    }

    // Render Categories Preview
    if (catsRoot) {
      catsRoot.innerHTML = '';
      const top = homeCats.slice(0, 6);
      if (!top.length) {
        catsRoot.innerHTML = `<div class="chip-tile" style="grid-column:1/-1"><span>Categories will appear here</span></div>`;
      } else {
        top.forEach(cat => {
          const a = document.createElement('a');
          a.className = 'chip-tile';
          a.href = `catalog.html?category=${encodeURIComponent(cat.slug)}`;
          a.innerHTML = `<span>${escapeHtml(cat.name)}</span><i class="fa-solid fa-arrow-right" style="color:var(--pink)"></i>`;
          catsRoot.appendChild(a);
        });
      }
    }

    // Render Most Loved
    if (lovedRoot) {
      renderSkeletonGrid(lovedRoot, 4);
      try {
        const cakes = await jsonFetch('/api/cakes?sort=mostLoved&limit=4');
        lovedRoot.innerHTML = '';
        const list = Array.isArray(cakes) ? cakes : (cakes.items || []);
        list.forEach(c => lovedRoot.appendChild(cakeCard(c)));
      } catch {
        lovedRoot.innerHTML = '<div class="empty" style="grid-column:1/-1"><p class="muted">Could not load most loved cakes.</p></div>';
      }
    }
  };

  // ==========================================================================
  // Page Initializer: Catalog with 4-Col Grid, Skeletons, AbortController
  // ==========================================================================
  const initCatalog = async () => {
    await applyShopInfoToCommonUI();

    const chips = $('#categoryChips');
    const grid = $('#catalogGrid');
    const empty = $('#catalogEmpty');
    const catInput = $('#catalogCategoryInput');
    const catList = $('#catalogCategoryList');
    const clearBtn = $('#catalogClearFilter');
    const pagination = $('#catalogPagination');
    const prevBtn = $('#catalogPrev');
    const nextBtn = $('#catalogNext');
    const pageInfo = $('#catalogPageInfo');

    if (!grid) return;

    wireCakeActionDelegation(grid);

    const url = new URL(location.href);
    const initialCategory = url.searchParams.get('category') || 'all';

    const setActiveChip = (slug) => {
      if (!chips) return;
      $$('.chip', chips).forEach(b => {
        b.classList.toggle('active', b.dataset.category === slug);
      });
    };

    const renderCakes = (cakes) => {
      grid.innerHTML = '';
      const items = Array.isArray(cakes) ? cakes : [];
      if (!items.length) {
        if (empty) {
          empty.hidden = false;
          empty.innerHTML = `
            <i class="fa-solid fa-cake-candles empty-icon"></i>
            <h2 class="h2">No cakes found</h2>
            <p class="muted">No designs available in this category. Explore other categories or reset filters.</p>
            <button class="btn primary btn-sm mt-14" type="button" id="emptyResetBtn"><i class="fa-solid fa-rotate"></i> Show All Cakes</button>
          `;
          const rBtn = $('#emptyResetBtn', empty);
          if (rBtn) {
            rBtn.addEventListener('click', () => {
              if (catInput) catInput.value = '';
              setActiveChip('all');
              loadCatalogPage('all', 1);
            });
          }
        }
        if (pagination) pagination.hidden = true;
        return;
      }

      if (empty) empty.hidden = true;
      items.forEach(c => grid.appendChild(cakeCard(c)));
    };

    const updatePagination = (page, totalPages, limit, total) => {
      if (!pagination || !pageInfo || !prevBtn || !nextBtn) return;
      pagination.hidden = totalPages <= 1;
      state.catalogPage = page;
      state.catalogTotalPages = totalPages;
      const totalCount = total ? ` (${total} cakes)` : '';
      pageInfo.textContent = `Page ${page} of ${totalPages}${totalCount}`;
      prevBtn.disabled = page <= 1;
      nextBtn.disabled = page >= totalPages;
    };

    const loadCatalogPage = async (categorySlug, page = 1) => {
      // Cancel any ongoing search/pagination request
      if (state.activeCatalogController) {
        state.activeCatalogController.abort();
      }
      state.activeCatalogController = new AbortController();
      const signal = state.activeCatalogController.signal;

      state.catalogLoading = true;
      state.catalogCategory = categorySlug || 'all';
      state.catalogPage = page;

      // Show 12 skeleton cards matching the 4-column 9:16 layout
      renderSkeletonGrid(grid, 12);
      if (empty) empty.hidden = true;

      try {
        const query = new URLSearchParams();
        if (categorySlug && categorySlug !== 'all') {
          query.set('category', categorySlug);
        }
        query.set('page', String(page));
        query.set('limit', String(state.catalogLimit));
        query.set('paginate', '1');

        const out = normalizePaged(await jsonFetch(`/api/cakes?${query.toString()}`, { signal }));
        renderCakes(out.items || []);
        updatePagination(out.page || 1, out.totalPages || 1, out.limit || 12, out.total);
      } catch (err) {
        if (err.name === 'AbortError') return; // Superseded by a newer query

        grid.innerHTML = `
          <div class="empty" style="grid-column: 1 / -1;">
            <i class="fa-solid fa-circle-exclamation empty-icon" style="color:var(--dislike)"></i>
            <h2 class="h2">Unable to load cakes</h2>
            <p class="muted">${escapeHtml(err.message || 'Please check your connection and try again.')}</p>
            <button class="btn primary btn-sm mt-14" type="button" id="catalogRetryBtn"><i class="fa-solid fa-arrow-rotate-right"></i> Retry</button>
          </div>
        `;
        const retryBtn = $('#catalogRetryBtn', grid);
        if (retryBtn) {
          retryBtn.addEventListener('click', () => loadCatalogPage(categorySlug, page));
        }
        if (pagination) pagination.hidden = true;
      } finally {
        state.catalogLoading = false;
      }
    };

    // Initialize Category Chips & Datalist
    const cats = await loadCategories();

    if (chips) {
      chips.innerHTML = '<button class="chip active" type="button" data-category="all"><i class="fa-solid fa-sparkles"></i> All Designs</button>';
      cats.forEach(cat => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.dataset.category = cat.slug;
        b.textContent = cat.name;
        chips.appendChild(b);
      });

      chips.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        const chip = t.closest('button.chip');
        if (!chip) return;
        const slug = chip.dataset.category || 'all';
        setActiveChip(slug);
        if (catInput) {
          const cat = state.categories.find(c => c.slug === slug);
          catInput.value = slug === 'all' ? '' : (cat?.name || slug);
        }
        loadCatalogPage(slug, 1);
      });
    }

    if (catList) {
      catList.innerHTML = '<option value="All">All Categories</option>';
      cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        catList.appendChild(opt);
      });
    }

    if (catInput) {
      let debounceTimer = null;
      catInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const slug = matchCategorySlug(catInput.value);
          setActiveChip(slug);
          loadCatalogPage(slug, 1);
        }, 250);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (catInput) catInput.value = '';
        setActiveChip('all');
        loadCatalogPage('all', 1);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (state.catalogPage <= 1 || state.catalogLoading) return;
        const targetPage = state.catalogPage - 1;
        loadCatalogPage(state.catalogCategory, targetPage);
        grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (state.catalogPage >= state.catalogTotalPages || state.catalogLoading) return;
        const targetPage = state.catalogPage + 1;
        loadCatalogPage(state.catalogCategory, targetPage);
        grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // Load Initial Category
    setActiveChip(initialCategory);
    if (initialCategory !== 'all' && catInput) {
      const cat = cats.find(c => c.slug === initialCategory);
      catInput.value = cat?.name || initialCategory;
    }
    await loadCatalogPage(initialCategory, 1);
  };

  // ==========================================================================
  // Page Initializer: Cake Details & WhatsApp Inquiries
  // ==========================================================================
  const initDetails = async () => {
    await applyShopInfoToCommonUI();

    const root = $('#detailsRoot');
    const similar = $('#similarGrid');
    if (!root) return;

    if (similar) wireCakeActionDelegation(similar);

    const params = new URL(location.href).searchParams;
    const id = params.get('id');
    if (!id) {
      root.innerHTML = `
        <div class="empty">
          <h1 class="h2">Cake not found</h1>
          <p class="muted">Missing cake ID in the URL.</p>
          <a class="btn primary" href="catalog.html"><i class="fa-solid fa-arrow-left"></i> Return to Catalog</a>
        </div>
      `;
      return;
    }

    try {
      const cake = await jsonFetch(`/api/cakes/${encodeURIComponent(id)}`);
      document.title = `${cake.name || 'Cake'} — Monginis`;

      const img = getCakePrimaryImageUrl(cake);
      const optimizedImg = optimizeCloudinaryUrl(img, { width: 900, height: 1600, crop: 'limit' });
      const category = cake.categoryName || (typeof cake.category === 'object' ? cake.category?.name : '') || 'Monginis Collection';

      root.innerHTML = `
        <div class="details">
          <div class="detail-media-wrap">
            <div class="detail-badge-row">
              <span class="detail-badge"><i class="fa-solid fa-sparkles"></i> Signature Creation</span>
              <span class="detail-badge"><i class="fa-solid fa-layer-group"></i> ${escapeHtml(category)}</span>
            </div>
            <div class="detail-media">
              ${img ? `
                <img src="${escapeAttr(optimizedImg)}" alt="${escapeAttr(cake.name || 'Cake')}" loading="eager" onload="this.style.opacity='1'" />
              ` : `
                <div class="empty" style="height:100%;border:none;justify-content:center;" aria-hidden="true">
                  <i class="fa-solid fa-cake-candles icon-pink" style="font-size:48px;"></i>
                </div>
              `}
            </div>
          </div>
          <div class="detail-body">
            <div class="detail-card">
              <div class="detail-kicker">Monginis — The Celebration Bakers</div>
              <h1 class="h1" style="margin-bottom:6px;">${escapeHtml(cake.name || 'Cake')}</h1>
              <p class="sub">${escapeHtml(cake.description || 'Handcrafted fresh to order with premium Monginis bakery ingredients.')}</p>
              
              <div class="detail-actions">
                <button class="reaction-btn like-btn" type="button" data-detail-like aria-label="Like" aria-pressed="false">
                  <i class="fa-regular fa-heart"></i> Like Design
                </button>
                <button class="reaction-btn dislike-btn" type="button" data-detail-dislike aria-label="Dislike" aria-pressed="false">
                  <i class="fa-regular fa-thumbs-down"></i> Dislike
                </button>
                ${img ? `
                  <a class="reaction-btn" href="${escapeAttr(img)}" download="${escapeAttr(slugifyStr(cake.name))}.jpg" target="_blank" rel="noopener noreferrer" aria-label="Download design image">
                    <i class="fa-solid fa-download"></i> Save Image
                  </a>
                ` : ''}
              </div>

              <div class="reaction-counts" aria-live="polite">
                <span class="reaction-count like"><i class="fa-solid fa-heart"></i> <span data-like-count>${Number(cake.likes) || 0}</span> Loved</span>
                <span class="reaction-count dislike"><i class="fa-solid fa-thumbs-down"></i> <span data-dislike-count>${Number(cake.dislikes) || 0}</span></span>
              </div>
            </div>

            <div class="detail-form">
              <div class="detail-kicker"><i class="fa-brands fa-whatsapp"></i> WhatsApp Order Inquiry</div>
              
              <div class="field">
                <label for="weightInput">Select / Enter Cake Weight (Kg)</label>
                <input type="number" id="weightInput" class="input" placeholder="e.g. 1.0" min="0.5" step="0.5" value="1.0" required />
                <div class="weight-presets">
                  <button type="button" class="weight-chip" data-weight="0.5">0.5 Kg</button>
                  <button type="button" class="weight-chip is-active" data-weight="1.0">1.0 Kg</button>
                  <button type="button" class="weight-chip" data-weight="1.5">1.5 Kg</button>
                  <button type="button" class="weight-chip" data-weight="2.0">2.0 Kg</button>
                  <button type="button" class="weight-chip" data-weight="3.0">3.0 Kg</button>
                </div>
              </div>

              <div class="inquiry-note">
                <i class="fa-solid fa-comment-dots"></i>
                <span>Direct WhatsApp inquiry with your chosen weight and cake image. Our bakers will coordinate pricing, pickup, or delivery.</span>
              </div>

              <div class="detail-buttons">
                <a class="btn ghost" href="catalog.html"><i class="fa-solid fa-arrow-left"></i> Catalog</a>
                <button class="btn primary detail-wa-btn" type="button" id="detailWaBtn">
                  <i class="fa-brands fa-whatsapp"></i> Inquire on WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Preset weight chips
      const weightInput = $('#weightInput', root);
      const chips = $$('.weight-chip', root);
      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          chips.forEach(c => c.classList.remove('is-active'));
          chip.classList.add('is-active');
          if (weightInput) weightInput.value = chip.dataset.weight;
        });
      });

      if (weightInput) {
        weightInput.addEventListener('input', () => {
          chips.forEach(c => c.classList.toggle('is-active', c.dataset.weight === weightInput.value));
        });
      }

      // WhatsApp Button Handler
      const waBtn = $('#detailWaBtn', root);
      if (waBtn) {
        waBtn.addEventListener('click', () => {
          const raw = weightInput instanceof HTMLInputElement ? weightInput.value.trim() : '1';
          const entered = Number(raw);
          if (!raw || !Number.isFinite(entered) || entered <= 0) {
            alert('Please enter a valid cake weight in Kg (e.g. 1.0 Kg)');
            if (weightInput) weightInput.focus();
            return;
          }

          const info = state.shopInfo || DEFAULT_SHOP_INFO;
          const phone = info.whatsappNumber || DEFAULT_SHOP_INFO.whatsappNumber;

          const lines = [
            '🎂 *Monginis Cake Inquiry*',
            '',
            `*Cake Name:* ${cake.name || 'Cake'}`,
            `*Category:* ${category}`,
            `*Required Weight:* ${entered} Kg`,
            img ? `*Design Reference:* ${img}` : '',
            '',
            'Please let me know availability and pricing. Thank you!',
          ].filter(Boolean).join('\n');

          const waUrl = makeWhatsAppLink({ whatsappNumber: phone, message: lines });
          window.open(waUrl, '_blank', 'noopener,noreferrer');
        });
      }

      // Like & Dislike Handler
      const likeBtn = $('[data-detail-like]', root);
      const dislikeBtn = $('[data-detail-dislike]', root);

      const handleReaction = async (action, btn) => {
        setReactionActive(root, action);
        triggerPulse(btn);
        const countEl = root.querySelector(`[data-${action}-count]`);
        const prev = countEl ? Number(countEl.textContent) || 0 : null;
        if (countEl) {
          countEl.textContent = String(prev + 1);
          bumpCount(countEl);
        }
        try {
          await jsonFetch(`/api/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cakeId: cake._id }),
          });
        } catch {
          if (countEl && prev !== null) countEl.textContent = String(prev);
        }
      };

      if (likeBtn) likeBtn.addEventListener('click', () => handleReaction('like', likeBtn));
      if (dislikeBtn) dislikeBtn.addEventListener('click', () => handleReaction('dislike', dislikeBtn));

      // Load Similar Cakes
      if (similar) {
        renderSkeletonGrid(similar, 4);
        try {
          const catQuery = cake.categorySlug || (typeof cake.category === 'object' ? cake.category?.slug : '');
          const list = await jsonFetch(`/api/cakes?category=${encodeURIComponent(catQuery)}&limit=5`);
          similar.innerHTML = '';
          const items = (Array.isArray(list) ? list : (list.items || []))
            .filter(c => String(c._id) !== String(cake._id))
            .slice(0, 4);
          
          if (!items.length) {
            similar.innerHTML = '<div class="empty" style="grid-column: 1 / -1;"><p class="muted">Explore more designs in our catalog.</p></div>';
          } else {
            items.forEach(c => similar.appendChild(cakeCard(c)));
          }
        } catch {
          similar.innerHTML = '';
        }
      }
    } catch (err) {
      root.innerHTML = `
        <div class="empty">
          <i class="fa-solid fa-circle-exclamation empty-icon" style="color:var(--dislike)"></i>
          <h2 class="h2">Cake not found</h2>
          <p class="muted">${escapeHtml(err.message || 'The requested cake design could not be found.')}</p>
          <a class="btn primary mt-14" href="catalog.html"><i class="fa-solid fa-arrow-left"></i> Browse All Cakes</a>
        </div>
      `;
    }
  };

  // ==========================================================================
  // Page Initializers: Contact & About
  // ==========================================================================
  const initContact = async () => {
    await applyShopInfoToCommonUI();
    const info = await loadShopInfo();
    const mapWrap = $('#mapWrap');
    if (mapWrap) {
      const embed = safeUrl(info.googleMapsEmbedUrl);
      const canEmbed = Boolean(embed && String(info.googleMapsEmbedUrl || '').includes('/maps/embed'));
      if (canEmbed) {
        mapWrap.innerHTML = `<iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${escapeAttr(embed)}" title="Monginis Cake Shop Location"></iframe>`;
      } else {
        mapWrap.innerHTML = `
          <div class="empty" style="min-height:260px;justify-content:center;">
            <i class="fa-solid fa-map-location-dot empty-icon"></i>
            <h2 class="h2">Find Us in Aurangabad / CSN</h2>
            <p class="muted">${escapeHtml(info.address || DEFAULT_SHOP_INFO.address)}</p>
            <a class="btn primary btn-sm" href="${escapeAttr(getShopLink(info, 'maps'))}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-location-arrow"></i> Open Google Maps</a>
          </div>
        `;
      }
    }
  };

  const initAbout = async () => {
    await applyShopInfoToCommonUI();
  };

  // ==========================================================================
  // Page Initializer: Admin Login
  // ==========================================================================
  const initAdminLogin = async () => {
    setYear();
    const form = $('#adminLoginForm');
    const msg = $('#adminMsg');
    const btn = $('#adminLoginBtn');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = String($('#adminEmail')?.value || '').trim();
      const password = String($('#adminPassword')?.value || '');

      if (!email || !password) {
        if (msg) msg.textContent = 'Please enter both email and password.';
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Signing In…';
      }
      if (msg) msg.textContent = 'Authenticating…';

      try {
        const out = await jsonFetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        localStorage.setItem('monginis_admin_token', out.token);
        location.href = 'admin-dashboard.html';
      } catch (err) {
        if (msg) msg.textContent = err.message || 'Login failed. Please check credentials.';
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-lock"></i> Sign In';
        }
      }
    });
  };

  // ==========================================================================
  // Page Initializer: Admin Dashboard
  // ==========================================================================
  const initAdminDashboard = async () => {
    setYear();

    const token = localStorage.getItem('monginis_admin_token');
    if (!token) {
      location.href = 'admin-login.html';
      return;
    }

    const logoutBtn = $('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('monginis_admin_token');
        location.href = 'admin-login.html';
      });
    }

    const toast = (text) => {
      let el = $('#adminToast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'adminToast';
        el.className = 'admin-toast';
        document.body.appendChild(el);
      }
      el.textContent = text;
      el.hidden = false;
      clearTimeout(el._timer);
      el._timer = setTimeout(() => { el.hidden = true; }, 2400);
    };

    const fetchAllCakes = async () => {
      const items = [];
      let page = 1;
      let totalPages = 1;
      do {
        const out = normalizePaged(await authedFetch(`/api/cakes?limit=100&page=${page}`));
        items.push(...(out.items || []));
        totalPages = Number(out.totalPages || 1);
        page += 1;
      } while (page <= totalPages);
      return items;
    };

    const filterState = { search: '', categoryId: '' };

    const applyCakeFilters = () => {
      const search = filterState.search.trim().toLowerCase();
      const categoryId = filterState.categoryId;
      let list = [...state.adminCakes];
      if (categoryId) {
        list = list.filter(c => String(c.category?._id || c.category || '') === categoryId);
      }
      if (search) {
        list = list.filter(c => String(c.name || '').toLowerCase().includes(search));
      }
      renderAdminCakes(list);
    };

    const refreshAll = async () => {
      try {
        const [cats, cakes, info] = await Promise.all([
          authedFetch('/api/categories'),
          fetchAllCakes(),
          authedFetch('/api/shop-info'),
        ]);
        state.categories = Array.isArray(cats) ? cats : [];
        state.shopInfo = info;
        state.adminCakes = Array.isArray(cakes) ? cakes : [];
        renderCategories();
        renderShopInfo(info);
        renderAnalytics(state.adminCakes);
        fillCategorySelects();
        applyCakeFilters();
      } catch (err) {
        toast('Failed to load dashboard data');
      }
    };

    const catList = $('#catList');
    const cakeList = $('#cakeList');

    const fillCategorySelects = () => {
      const selects = $$('.categorySelect');
      selects.forEach(sel => {
        const current = sel.value;
        const wantsAll = sel.dataset.allOption === '1' || sel.id === 'adminCakeCategory';
        sel.innerHTML = wantsAll
          ? '<option value="">All Categories</option>'
          : '<option value="">Select Category</option>';
        state.categories.forEach(cat => {
          const opt = document.createElement('option');
          opt.value = cat._id;
          opt.textContent = cat.name;
          sel.appendChild(opt);
        });
        if (current) sel.value = current;
      });
    };

    const renderCategories = () => {
      if (!catList) return;
      catList.innerHTML = '';
      if (!state.categories.length) {
        catList.innerHTML = `<div class="row"><div class="row-head"><div class="row-title">No categories yet</div></div><small>Create your first category above.</small></div>`;
        return;
      }

      state.categories.forEach(cat => {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `
          <div class="row-head">
            <div>
              <div class="row-title">${escapeHtml(cat.name)}</div>
              <small class="muted">${escapeHtml(cat.slug)}</small>
            </div>
            <div class="admin-actions">
              <button class="btn ghost btn-sm" type="button" data-cat-edit="${escapeAttr(cat._id)}"><i class="fa-solid fa-pen"></i> Edit</button>
              <button class="btn danger btn-sm" type="button" data-cat-del="${escapeAttr(cat._id)}"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
          </div>
          <div class="details-block" hidden data-cat-form="${escapeAttr(cat._id)}">
            <div class="field"><label>Category Name</label><input class="input" value="${escapeAttr(cat.name)}" data-cat-name /></div>
            <button class="btn primary btn-sm" type="button" data-cat-save="${escapeAttr(cat._id)}"><i class="fa-solid fa-check"></i> Save</button>
          </div>
        `;
        catList.appendChild(row);
      });
    };

    const renderAdminCakes = (cakes) => {
      if (!cakeList) return;
      const list = Array.isArray(cakes) ? cakes : [];
      cakeList.innerHTML = '';
      if (!list.length) {
        cakeList.innerHTML = `<div class="row"><div class="row-head"><div class="row-title">No cakes found</div></div><small>Create cakes or clear search filters.</small></div>`;
        return;
      }

      list.forEach(cake => {
        const row = document.createElement('div');
        row.className = 'row';
        const legacyImg = getCakePrimaryImageUrl(cake);
        const imgCount = Array.isArray(cake.images) ? cake.images.length : (legacyImg ? 1 : 0);
        row.innerHTML = `
          <div class="row-head">
            <div>
              <div class="row-title">${escapeHtml(cake.name || 'Cake')}</div>
              <small class="muted">${escapeHtml(cake.categoryName || 'Category')} • ${imgCount} image(s)</small>
            </div>
            <div class="admin-actions">
              <button class="btn ghost btn-sm" type="button" data-cake-toggle="${escapeAttr(cake._id)}"><i class="fa-solid fa-gear"></i> Manage</button>
              <button class="btn danger btn-sm" type="button" data-cake-del="${escapeAttr(cake._id)}"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
          </div>
          <div class="details-block" hidden data-cake-panel="${escapeAttr(cake._id)}">
            <div class="grid two">
              <div class="field"><label>Cake Name</label><input class="input" value="${escapeAttr(cake.name || '')}" data-cake-name /></div>
              <div class="field"><label>Category</label>
                <select class="input categorySelect" data-cake-cat>
                  <option value="">Select Category</option>
                </select>
              </div>
            </div>
            <div class="field"><label>Description</label><textarea class="input" rows="3" data-cake-desc>${escapeHtml(cake.description || '')}</textarea></div>

            <div>
              <div class="muted tiny" style="font-weight:800;margin-bottom:8px;text-transform:uppercase;">Images</div>
              <div class="img-strip" data-img-strip>
                ${(
                  (Array.isArray(cake.images) && cake.images.length)
                    ? cake.images
                    : (legacyImg ? [{ url: legacyImg, publicId: cake.imagePublicId || 'legacy' }] : [])
                ).map(im => `
                  <div class="img-chip">
                    <img src="${escapeAttr(im.url)}" alt="" loading="lazy" />
                    ${im.publicId && im.publicId !== 'legacy'
                      ? `<button type="button" aria-label="Delete image" data-img-del="${escapeAttr(im.publicId)}"><i class="fa-solid fa-xmark"></i></button>`
                      : ''
                    }
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="grid two">
              <div class="field"><label>Upload More Images</label><input class="input" type="file" accept="image/*" multiple data-cake-files /></div>
              <div class="field"><label>&nbsp;</label><button class="btn primary btn-sm" type="button" data-cake-upload><i class="fa-solid fa-cloud-arrow-up"></i> Upload</button></div>
            </div>

            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <button class="btn primary btn-sm" type="button" data-cake-save><i class="fa-solid fa-check"></i> Save Changes</button>
              <span class="muted tiny" style="font-weight:800;">
                <i class="fa-solid fa-heart" style="color:var(--like)"></i> ${cake.likes ?? 0} &nbsp;
                <i class="fa-solid fa-thumbs-down" style="color:var(--dislike)"></i> ${cake.dislikes ?? 0}
              </span>
            </div>
          </div>
        `;
        cakeList.appendChild(row);

        const sel = $('[data-cake-cat]', row);
        if (sel && cake.category) {
          sel.value = typeof cake.category === 'string' ? cake.category : cake.category._id;
        }
      });

      fillCategorySelects();
    };

    const renderShopInfo = (info) => {
      if ($('#shopAddress')) $('#shopAddress').value = info.address || '';
      if ($('#shopPhone')) $('#shopPhone').value = info.phone || '';
      if ($('#shopEmail')) $('#shopEmail').value = info.email || '';
      if ($('#shopHours')) $('#shopHours').value = info.openingHours || '';
      if ($('#shopWhatsapp')) $('#shopWhatsapp').value = info.whatsappNumber || '';
      if ($('#shopInstagram')) $('#shopInstagram').value = info.instagramUrl || '';
      if ($('#shopFacebook')) $('#shopFacebook').value = info.facebookUrl || '';
      if ($('#shopMaps')) $('#shopMaps').value = info.googleMapsUrl || info.googleMapsEmbedUrl || '';
      if ($('#shopReviews')) $('#shopReviews').value = info.googleReviewsUrl || '';
    };

    const renderAnalytics = (cakes) => {
      const list = Array.isArray(cakes) ? cakes : [];
      const totalLikes = list.reduce((sum, c) => sum + (Number(c.likes) || 0), 0);
      const totalDislikes = list.reduce((sum, c) => sum + (Number(c.dislikes) || 0), 0);
      if ($('#anaLikes')) $('#anaLikes').textContent = String(totalLikes);
      if ($('#anaDislikes')) $('#anaDislikes').textContent = String(totalDislikes);

      const top = [...list].sort((a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0)).slice(0, 5);
      const box = $('#anaTop');
      if (box) {
        box.innerHTML = '';
        top.forEach(c => {
          const div = document.createElement('div');
          div.className = 'row';
          div.innerHTML = `<div class="row-head"><div class="row-title">${escapeHtml(c.name || 'Cake')}</div><small style="color:var(--like);font-weight:800;"><i class="fa-solid fa-heart"></i> ${Number(c.likes) || 0}</small></div>`;
          box.appendChild(div);
        });
        if (!top.length) {
          box.innerHTML = `<div class="row"><div class="row-head"><div class="row-title">No analytics yet</div></div><small class="muted">Likes/dislikes appear once customers interact.</small></div>`;
        }
      }
    };

    // Category Creation
    const catCreateForm = $('#catCreateForm');
    if (catCreateForm) {
      catCreateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = String($('#newCatName')?.value || '').trim();
        if (!name) return;
        try {
          await authedFetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          });
          $('#newCatName').value = '';
          toast('Category created');
          await refreshAll();
        } catch (err) {
          toast(err.message || 'Failed to create category');
        }
      });
    }

    // Cake Creation with Multi-Image Upload
    const cakeCreateForm = $('#cakeCreateForm');
    let pendingUpload = [];

    const uploadImages = async (files, categoryId) => {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('images', f));
      if (categoryId) fd.append('categoryId', categoryId);
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.message || 'Upload failed');
      return out.images;
    };

    if (cakeCreateForm) {
      const uploadBtn = $('#createUploadBtn');
      const filesInput = $('#createCakeFiles');
      const uploadedLabel = $('#createUploadedLabel');

      if (uploadBtn && filesInput) {
        uploadBtn.addEventListener('click', async () => {
          if (!filesInput.files || !filesInput.files.length) {
            toast('Please select image files first');
            return;
          }
          uploadBtn.disabled = true;
          uploadBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Uploading…';
          try {
            const categoryId = String($('#createCakeCategory')?.value || '').trim();
            pendingUpload = await uploadImages(filesInput.files, categoryId);
            if (uploadedLabel) uploadedLabel.textContent = `${pendingUpload.length} image(s) uploaded successfully`;
            toast('Images uploaded');
          } catch (err) {
            toast(err.message || 'Upload failed');
          } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload';
          }
        });
      }

      cakeCreateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = String($('#createCakeName')?.value || '').trim();
        const categoryId = String($('#createCakeCategory')?.value || '').trim();
        const description = String($('#createCakeDesc')?.value || '').trim();

        if (!name || !categoryId) {
          toast('Name and category are required');
          return;
        }

        try {
          await authedFetch('/api/cakes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, categoryId, description, images: pendingUpload }),
          });

          pendingUpload = [];
          if (uploadedLabel) uploadedLabel.textContent = 'No uploads yet';
          $('#createCakeName').value = '';
          $('#createCakeDesc').value = '';
          if (filesInput) filesInput.value = '';

          toast('Cake created successfully');
          await refreshAll();
        } catch (err) {
          toast(err.message || 'Failed to create cake');
        }
      });
    }

    // Search & Filter Listeners in Admin
    const adminSearch = $('#adminCakeSearch');
    const adminCategory = $('#adminCakeCategory');
    if (adminSearch) {
      adminSearch.addEventListener('input', () => {
        filterState.search = String(adminSearch.value || '');
        applyCakeFilters();
      });
    }
    if (adminCategory) {
      adminCategory.addEventListener('change', () => {
        filterState.categoryId = String(adminCategory.value || '');
        applyCakeFilters();
      });
    }

    // ========================================================================
    // Bulk Upload System with Sequential Canvas Compression & Chunked Upload
    // ========================================================================
    const bulkForm = $('#bulkUploadForm');
    if (bulkForm) {
      const bulkCategory = $('#bulkCategory');
      const bulkFiles = $('#bulkFiles');
      const bulkHint = $('#bulkFilesHint');
      const bulkBtn = $('#bulkUploadBtn');
      const bulkProgress = $('#bulkProgress');
      const bulkStatus = $('#bulkStatus');
      const bulkCounts = $('#bulkCounts');
      const bulkPercent = $('#bulkPercent');
      const bulkFailed = $('#bulkFailed');
      const bulkUploaded = $('#bulkUploaded');
      const bulkBarFill = $('#bulkBarFill');
      const bulkResults = $('#bulkResults');
      const bulkGrid = $('#bulkGrid');
      const bulkSummary = $('#bulkSummary');

      const updateBulkUI = (stats) => {
        if (bulkCounts) {
          bulkCounts.textContent = `Processing ${stats.uploaded} / ${stats.total} images…`;
        }
        if (bulkPercent) bulkPercent.textContent = `${Math.round(stats.percent)}%`;
        if (bulkFailed) bulkFailed.textContent = `Failed: ${stats.failed}`;
        if (bulkUploaded) bulkUploaded.textContent = `Uploaded: ${stats.uploaded}`;
        if (bulkBarFill) bulkBarFill.style.width = `${Math.max(0, Math.min(100, stats.percent))}%`;
      };

      const uploadBulkBatch = (files, categoryId, onProgress) => new Promise((resolve, reject) => {
        const fd = new FormData();
        if (categoryId) fd.append('categoryId', categoryId);
        files.forEach((file) => fd.append('images', file));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/api/cakes/bulk`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable || !onProgress) return;
          onProgress((e.loaded / e.total) * 100);
        };

        xhr.onload = () => {
          let out = null;
          try {
            out = JSON.parse(xhr.responseText || '{}');
          } catch {
            return reject(new Error('Batch upload failed'));
          }
          if (xhr.status >= 200 && xhr.status < 300) return resolve(out);
          return reject(new Error(out.message || 'Batch upload failed'));
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(fd);
      });

      if (bulkFiles && bulkHint) {
        bulkFiles.addEventListener('change', () => {
          const count = bulkFiles.files ? bulkFiles.files.length : 0;
          bulkHint.textContent = count ? `${count} image(s) selected` : 'No files selected';
        });
      }

      bulkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const categoryId = String(bulkCategory?.value || '').trim();
        const files = bulkFiles?.files ? Array.from(bulkFiles.files) : [];
        if (!categoryId) {
          toast('Select a category');
          return;
        }
        if (!files.length) {
          toast('Select images first');
          return;
        }
        if (files.length > 30) {
          toast('Select up to 30 images at a time');
          return;
        }

        if (bulkBtn) bulkBtn.disabled = true;
        if (bulkProgress) bulkProgress.hidden = false;
        if (bulkResults) bulkResults.hidden = true;
        if (bulkGrid) bulkGrid.innerHTML = '';
        if (bulkSummary) bulkSummary.textContent = 'Preparing files…';

        const stats = { total: files.length, uploaded: 0, failed: 0, percent: 0 };
        updateBulkUI(stats);

        try {
          if (bulkStatus) bulkStatus.textContent = 'Optimizing images for web…';
          const optimized = [];
          for (let i = 0; i < files.length; i += 1) {
            if (bulkStatus) bulkStatus.textContent = `Optimizing image ${i + 1} of ${files.length}…`;
            const out = await compressImageFile(files[i], { maxSize: 1600, quality: 0.82 });
            optimized.push(out);
          }

          const batchSize = 6;
          const created = [];
          for (let i = 0; i < optimized.length; i += batchSize) {
            const batch = optimized.slice(i, i + batchSize);
            const basePercent = (stats.uploaded / stats.total) * 100;
            const batchWeight = (batch.length / stats.total) * 100;
            if (bulkStatus) bulkStatus.textContent = `Uploading batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(optimized.length / batchSize)}…`;

            const result = await uploadBulkBatch(batch, categoryId, (pct) => {
              stats.percent = basePercent + (pct / 100) * batchWeight;
              updateBulkUI(stats);
            });

            const newCreated = Array.isArray(result.created) ? result.created : [];
            const newFailed = Array.isArray(result.failed) ? result.failed.length : 0;
            created.push(...newCreated);
            stats.uploaded += newCreated.length;
            stats.failed += newFailed;
            stats.percent = (stats.uploaded / stats.total) * 100;
            updateBulkUI(stats);
          }

          if (bulkStatus) bulkStatus.textContent = 'Bulk upload completed!';
          if (bulkCounts) bulkCounts.textContent = `Uploaded ${stats.uploaded} of ${stats.total} images.`;
          if (bulkSummary) bulkSummary.textContent = `Successfully created ${created.length} cakes (${stats.failed} failed).`;
          if (bulkResults) bulkResults.hidden = false;
          if (bulkGrid) created.forEach(c => bulkGrid.appendChild(cakeCard(c)));
          toast('Bulk upload complete');
          await refreshAll();
        } catch (err) {
          if (bulkStatus) bulkStatus.textContent = 'Upload interrupted';
          toast(err.message || 'Bulk upload encountered an error');
        } finally {
          if (bulkBtn) bulkBtn.disabled = false;
        }
      });
    }

    // Shop Info Form
    const shopForm = $('#shopForm');
    if (shopForm) {
      shopForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          address: $('#shopAddress')?.value || '',
          phone: $('#shopPhone')?.value || '',
          email: $('#shopEmail')?.value || '',
          openingHours: $('#shopHours')?.value || '',
          whatsappNumber: $('#shopWhatsapp')?.value || '',
          instagramUrl: $('#shopInstagram')?.value || '',
          facebookUrl: $('#shopFacebook')?.value || '',
          googleMapsUrl: $('#shopMaps')?.value || '',
          googleMapsEmbedUrl: $('#shopMaps')?.value || '',
          googleReviewsUrl: $('#shopReviews')?.value || '',
        };
        try {
          await authedFetch('/api/shop-info', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          toast('Shop info updated');
          await refreshAll();
        } catch (err) {
          toast(err.message || 'Failed to update shop info');
        }
      });
    }

    // Delegation: Admin Actions
    document.addEventListener('click', async (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;

      const catEdit = t.closest('[data-cat-edit]');
      const catDel = t.closest('[data-cat-del]');
      const catSave = t.closest('[data-cat-save]');

      if (catEdit) {
        const id = catEdit.getAttribute('data-cat-edit');
        const block = document.querySelector(`[data-cat-form="${CSS.escape(id)}"]`);
        if (block) block.hidden = !block.hidden;
      }

      if (catDel) {
        const id = catDel.getAttribute('data-cat-del');
        if (!confirm('Are you sure you want to delete this category?')) return;
        try {
          await authedFetch(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
          toast('Category deleted');
          await refreshAll();
        } catch (err) {
          toast(err.message || 'Failed to delete category');
        }
      }

      if (catSave) {
        const id = catSave.getAttribute('data-cat-save');
        const block = document.querySelector(`[data-cat-form="${CSS.escape(id)}"]`);
        const name = block ? String(block.querySelector('[data-cat-name]')?.value || '').trim() : '';
        if (!name) return;
        try {
          await authedFetch(`/api/categories/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          });
          toast('Category updated');
          await refreshAll();
        } catch (err) {
          toast(err.message || 'Failed to update category');
        }
      }

      const cakeToggle = t.closest('[data-cake-toggle]');
      const cakeDel = t.closest('[data-cake-del]');

      if (cakeToggle) {
        const id = cakeToggle.getAttribute('data-cake-toggle');
        const panel = document.querySelector(`[data-cake-panel="${CSS.escape(id)}"]`);
        if (panel) panel.hidden = !panel.hidden;
      }

      if (cakeDel) {
        const id = cakeDel.getAttribute('data-cake-del');
        if (!confirm('Are you sure you want to delete this cake design? This also deletes its images.')) return;
        try {
          await authedFetch(`/api/cakes/${encodeURIComponent(id)}`, { method: 'DELETE' });
          toast('Cake deleted');
          await refreshAll();
        } catch (err) {
          toast(err.message || 'Failed to delete cake');
        }
      }

      const cakeSave = t.closest('[data-cake-save]');
      const cakeUpload = t.closest('[data-cake-upload]');

      if (cakeSave || cakeUpload) {
        const panel = t.closest('[data-cake-panel]');
        const cakeId = panel ? panel.getAttribute('data-cake-panel') : null;
        if (!panel || !cakeId) return;

        if (cakeUpload) {
          const input = panel.querySelector('[data-cake-files]');
          if (!input?.files || !input.files.length) {
            toast('Select images first');
            return;
          }
          cakeUpload.disabled = true;
          cakeUpload.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Uploading…';
          try {
            const categoryId = String(panel.querySelector('[data-cake-cat]')?.value || '').trim();
            const uploaded = await uploadImages(input.files, categoryId);
            await authedFetch(`/api/cakes/${encodeURIComponent(cakeId)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ appendImages: uploaded }),
            });
            toast('Images appended');
            await refreshAll();
          } catch (err) {
            toast(err.message || 'Image upload failed');
          } finally {
            cakeUpload.disabled = false;
            cakeUpload.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload';
          }
        }

        if (cakeSave) {
          const name = String(panel.querySelector('[data-cake-name]')?.value || '').trim();
          const categoryId = String(panel.querySelector('[data-cake-cat]')?.value || '').trim();
          const description = String(panel.querySelector('[data-cake-desc]')?.value || '').trim();

          try {
            await authedFetch(`/api/cakes/${encodeURIComponent(cakeId)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, categoryId, description }),
            });
            toast('Cake updated');
            await refreshAll();
          } catch (err) {
            toast(err.message || 'Failed to save cake changes');
          }
        }
      }

      const imgDel = t.closest('[data-img-del]');
      if (imgDel) {
        const panel = t.closest('[data-cake-panel]');
        const cakeId = panel ? panel.getAttribute('data-cake-panel') : null;
        const publicId = imgDel.getAttribute('data-img-del');
        if (!cakeId || !publicId) return;
        if (!confirm('Delete this image from the cake design?')) return;
        try {
          await authedFetch('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cakeId, publicId }),
          });
          toast('Image deleted');
          await refreshAll();
        } catch (err) {
          toast(err.message || 'Failed to delete image');
        }
      }
    });

    try {
      await refreshAll();
    } catch (err) {
      localStorage.removeItem('monginis_admin_token');
      location.href = 'admin-login.html';
    }
  };

  // ==========================================================================
  // Application Bootstrap
  // ==========================================================================
  const boot = async () => {
    document.body.classList.add('is-loaded');
    setYear();
    setBottomNavActive();
    initBurgerMenu();

    const page = document.body.dataset.page;
    try {
      if (page === 'home') await initHome();
      else if (page === 'catalog') await initCatalog();
      else if (page === 'details') await initDetails();
      else if (page === 'contact') await initContact();
      else if (page === 'about') await initAbout();
      else if (page === 'admin-login') await initAdminLogin();
      else if (page === 'admin-dashboard') await initAdminDashboard();
    } catch (err) {
      console.warn('Page initialization error:', err);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
