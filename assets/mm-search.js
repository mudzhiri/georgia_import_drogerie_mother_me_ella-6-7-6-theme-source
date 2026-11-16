(() => {
  const MIN_CHARS = 2;
  const DEBOUNCE_MS = 250;
  const LIMIT = 5;

  const i18n = (() => {
    try {
      return JSON.parse(document.getElementById('mm-search-i18n')?.textContent || '{}');
    } catch (_) {
      return {};
    }
  })();

  function shopRoot() {
    const fromI18n = i18n.root;
    const fromShopify = window.Shopify?.routes?.root;
    const fromRoutes = window.routes?.root;
    let root = fromI18n || fromShopify || fromRoutes || '/';
    if (!root.endsWith('/')) root += '/';
    return root;
  }

  function searchUrl() {
    return i18n.searchUrl || window.routes?.search_url || `${shopRoot().replace(/\/$/, '')}/search` || '/search';
  }

  function predictiveBase() {
    return i18n.predictiveUrl || window.routes?.predictive_search_url || `${shopRoot().replace(/\/$/, '')}/search/suggest` || '/search/suggest';
  }

  /** Keep product/result links on the active Shopify language root. */
  function localizePath(url) {
    if (!url || typeof url !== 'string') return url || '#';
    if (/^https?:\/\//i.test(url) || url.startsWith('//')) return url;
    const root = shopRoot();
    if (root === '/') return url.startsWith('/') ? url : `/${url}`;
    const rootNoSlash = root.replace(/\/$/, '');
    if (url === rootNoSlash || url.startsWith(`${rootNoSlash}/`)) return url;
    if (url.startsWith('/')) return `${rootNoSlash}${url}`;
    return `${rootNoSlash}/${url}`;
  }

  function toCents(price, priceCents) {
    if (priceCents != null && priceCents !== '' && Number.isFinite(Number(priceCents))) {
      return Math.round(Number(priceCents));
    }
    // /search/suggest.json returns prices in major currency units (e.g. "12.99" or 12.99)
    if (price == null || price === '') return NaN;
    const n = typeof price === 'string' ? parseFloat(price.replace(',', '.')) : Number(price);
    if (!Number.isFinite(n)) return NaN;
    // Heuristic: values >= 1000 without decimals are likely already cents
    if (Number.isInteger(n) && Math.abs(n) >= 1000) return n;
    return Math.round(n * 100);
  }

  function formatMoney(price, priceCents) {
    const cents = toCents(price, priceCents);
    if (!Number.isFinite(cents)) return '';
    if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(cents, i18n.moneyFormat || window.money_format || '{{amount}}');
    }
    const value = (cents / 100).toFixed(2);
    const fmt = i18n.moneyFormat || window.money_format || '{{amount}}';
    return fmt
      .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, value.replace('.', ','))
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, String(Math.round(cents / 100)))
      .replace(/\{\{\s*amount\s*\}\}/g, value);
  }

  function productImage(product) {
    const src =
      product.image ||
      product.featured_image?.url ||
      product.featured_image ||
      (Array.isArray(product.featured_media) ? null : product.featured_media?.preview_image?.src) ||
      '';
    if (!src) return '';
    if (typeof src === 'string') {
      return src.includes('?') ? `${src}&width=96` : `${src}?width=96`;
    }
    return '';
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  class MmSearch {
    constructor() {
      this.panel = document.getElementById('mm-search-panel');
      if (!this.panel) return;

      this.input = this.panel.querySelector('[data-mm-search-input]');
      this.form = this.panel.querySelector('[data-mm-search-form]');
      this.results = this.panel.querySelector('[data-mm-search-results]');
      this.status = this.panel.querySelector('[data-mm-search-status]');
      this.trigger = null;
      this.open = false;
      this.debounceTimer = null;
      this.requestId = 0;
      this.abort = null;

      this.onDocClick = this.onDocClick.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.onInput = this.onInput.bind(this);
      this.onTriggerClick = this.onTriggerClick.bind(this);
      this.onCloseClick = this.onCloseClick.bind(this);
      this.onFormSubmit = this.onFormSubmit.bind(this);

      this.bindTriggers();
      this.panel.querySelectorAll('[data-mm-search-close]').forEach((el) => {
        el.addEventListener('click', this.onCloseClick);
      });
      this.input?.addEventListener('input', this.onInput);
      this.form?.addEventListener('submit', this.onFormSubmit);
    }

    onCloseClick(event) {
      event.preventDefault();
      this.close();
    }

    onFormSubmit(event) {
      // Ensure q is kept and action stays on the locale search route.
      const q = (this.input?.value || '').trim();
      if (!q) {
        event.preventDefault();
        return;
      }
      if (this.form && this.form.action) {
        this.form.action = searchUrl();
      }
      if (this.input) this.input.value = q;
    }

    onTriggerClick(event) {
      const trigger = event.target.closest(
        '.header-nav-hamburger .header__icon--search, .header-nav-hamburger [data-search-menu], .header-mobile [data-search-mobile], .header-mobile__item--search summary, [data-mm-search-open]'
      );
      if (!trigger) return;
      if (trigger.closest('#mm-search-panel')) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

      const details = trigger.closest('details');
      if (details) details.open = false;

      this.openPanel(trigger.closest('summary, button, a, [data-mm-search-open]') || trigger);
    }

    bindTriggers() {
      document.addEventListener('click', this.onTriggerClick, true);
    }

    destroy() {
      document.removeEventListener('click', this.onTriggerClick, true);
      document.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('click', this.onDocClick, true);
      this.input?.removeEventListener('input', this.onInput);
      this.form?.removeEventListener('submit', this.onFormSubmit);
      this.panel?.querySelectorAll('[data-mm-search-close]').forEach((el) => {
        el.removeEventListener('click', this.onCloseClick);
      });
      if (this.abort) {
        this.abort.abort();
        this.abort = null;
      }
      window.clearTimeout(this.debounceTimer);
    }

    openPanel(trigger) {
      if (!this.panel || this.open) {
        this.input?.focus();
        return;
      }
      this.trigger = trigger;
      this.open = true;
      this.panel.hidden = false;
      this.panel.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('mm-search-open');
      document.body.classList.add('mm-search-open');

      void this.panel.offsetWidth;
      this.panel.classList.add('is-open');

      window.setTimeout(() => {
        this.input?.focus({ preventScroll: true });
        this.input?.select?.();
      }, 30);

      document.addEventListener('keydown', this.onKeydown);
      document.addEventListener('click', this.onDocClick, true);

      if ((this.input?.value || '').trim().length >= MIN_CHARS) {
        this.scheduleSearch();
      } else {
        this.clearResults();
      }
    }

    close() {
      if (!this.panel || !this.open) return;
      this.open = false;
      this.panel.classList.remove('is-open');
      this.panel.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('mm-search-open');
      document.body.classList.remove('mm-search-open');

      const finish = () => {
        this.panel.hidden = true;
        this.clearResults();
        if (this.abort) {
          this.abort.abort();
          this.abort = null;
        }
        const back = this.trigger;
        this.trigger = null;
        if (back && typeof back.focus === 'function') {
          window.setTimeout(() => back.focus(), 20);
        }
      };

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) finish();
      else window.setTimeout(finish, 220);

      document.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('click', this.onDocClick, true);
    }

    onDocClick(event) {
      if (!this.open) return;
      if (event.target.closest('[data-mm-search-close]')) return;
      if (event.target.closest('.mm-search-panel__sheet')) return;
      if (event.target.closest('.header__icon--search, [data-search-menu], [data-search-mobile], [data-mm-search-open]')) {
        return;
      }
      this.close();
    }

    onKeydown(event) {
      if (!this.open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    }

    onInput() {
      const q = (this.input?.value || '').trim();
      if (q.length < MIN_CHARS) {
        this.clearResults();
        if (this.abort) {
          this.abort.abort();
          this.abort = null;
        }
        window.clearTimeout(this.debounceTimer);
        return;
      }
      this.scheduleSearch();
    }

    scheduleSearch() {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = window.setTimeout(() => this.runSearch(), DEBOUNCE_MS);
    }

    clearResults() {
      if (!this.results) return;
      this.results.innerHTML = '';
      this.results.hidden = true;
      this.input?.setAttribute('aria-expanded', 'false');
      if (this.status) this.status.textContent = '';
    }

    async fetchSuggestJson(q, signal) {
      const base = predictiveBase();
      const url =
        `${base}.json?q=${encodeURIComponent(q)}` +
        `&resources[type]=product&resources[limit]=${LIMIT}` +
        `&resources[options][unavailable_products]=last` +
        `&resources[options][fields]=title,product_type,vendor,variants.title,variants.sku`;
      const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const err = new Error(String(res.status));
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      return data?.resources?.results?.products || [];
    }

    async fetchLocaleSearchFallback(q, signal) {
      // Locale search route + theme view — works when suggest.json rejects the buyer locale (ka → 417).
      const base = searchUrl();
      const url =
        `${base}?q=${encodeURIComponent(q)}` +
        `&type=product&options%5Bprefix%5D=last&view=ajax_mm_predictive`;
      const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const err = new Error(String(res.status));
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      return Array.isArray(data?.products) ? data.products : [];
    }

    async runSearch() {
      const q = (this.input?.value || '').trim();
      if (q.length < MIN_CHARS) {
        this.clearResults();
        return;
      }

      const id = ++this.requestId;
      if (this.abort) this.abort.abort();
      this.abort = new AbortController();
      const { signal } = this.abort;

      if (this.status) this.status.textContent = i18n.loading || '';

      try {
        let products = [];
        try {
          products = await this.fetchSuggestJson(q, signal);
        } catch (suggestErr) {
          if (suggestErr?.name === 'AbortError') return;
          // 417 Unsupported buyer locale (observed for ka) or other suggest failures → locale search view
          products = await this.fetchLocaleSearchFallback(q, signal);
        }
        if (id !== this.requestId) return;
        this.renderProducts(q, products);
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (id !== this.requestId) return;
        this.renderError();
      }
    }

    renderError() {
      if (!this.results) return;
      this.results.hidden = false;
      this.input?.setAttribute('aria-expanded', 'true');
      const msg = escapeHtml(i18n.error || i18n.noResults || '');
      this.results.innerHTML = `<p class="mm-search-panel__empty">${msg}</p>`;
      if (this.status) this.status.textContent = i18n.error || '';
    }

    renderProducts(query, products) {
      if (!this.results) return;
      const list = Array.isArray(products) ? products.slice(0, LIMIT) : [];
      this.results.hidden = false;
      this.input?.setAttribute('aria-expanded', 'true');

      if (!list.length) {
        this.results.innerHTML = `<p class="mm-search-panel__empty">${escapeHtml(i18n.noResults || '')}</p>`;
        if (this.status) this.status.textContent = i18n.noResults || '';
        return;
      }

      const items = list
        .map((product, index) => {
          const title = escapeHtml(product.title);
          const url = escapeHtml(localizePath(product.url));
          const img = productImage(product);
          const priceRaw = product.price ?? product.price_min ?? product.price_max;
          const price = escapeHtml(formatMoney(priceRaw, product.price_cents));
          const imgHtml = img
            ? `<img class="mm-search-panel__thumb" src="${escapeHtml(img)}" alt="" width="48" height="48" loading="lazy">`
            : `<span class="mm-search-panel__thumb mm-search-panel__thumb--empty" aria-hidden="true"></span>`;
          return `<a class="mm-search-panel__item" role="option" id="mm-search-option-${index}" href="${url}">
            ${imgHtml}
            <span class="mm-search-panel__meta">
              <span class="mm-search-panel__title">${title}</span>
              <span class="mm-search-panel__price">${price}</span>
            </span>
          </a>`;
        })
        .join('');

      const viewAllUrl = `${searchUrl()}?q=${encodeURIComponent(query)}&type=product&options%5Bprefix%5D=last`;
      const footer = `<a class="mm-search-panel__view-all" href="${escapeHtml(viewAllUrl)}">${escapeHtml(i18n.viewAll || '')}</a>`;

      this.results.innerHTML = `<div class="mm-search-panel__list" role="presentation">${items}</div>${footer}`;
      if (this.status) this.status.textContent = `${list.length}`;
    }
  }

  function boot() {
    if (window.__mmSearch && typeof window.__mmSearch.destroy === 'function') {
      window.__mmSearch.destroy();
    }
    window.__mmSearch = new MmSearch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('shopify:section:load', boot);
})();
