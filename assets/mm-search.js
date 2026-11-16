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

  function toCents(price) {
    // /search/suggest.json returns prices in major currency units (e.g. "12.99" or 12.99)
    if (price == null || price === '') return NaN;
    const n = typeof price === 'string' ? parseFloat(price.replace(',', '.')) : Number(price);
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n * 100);
  }

  function formatMoney(price) {
    const cents = toCents(price);
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

      this.bindTriggers();
      this.panel.querySelectorAll('[data-mm-search-close]').forEach((el) => {
        el.addEventListener('click', (event) => {
          event.preventDefault();
          this.close();
        });
      });
      this.input?.addEventListener('input', this.onInput);
      this.form?.addEventListener('submit', () => {
        /* allow native navigation to search results */
      });
    }

    bindTriggers() {
      document.addEventListener(
        'click',
        (event) => {
          const trigger = event.target.closest(
            '.header-nav-hamburger .header__icon--search, .header-nav-hamburger [data-search-menu], .header-mobile [data-search-mobile], .header-mobile__item--search summary, [data-mm-search-open]'
          );
          if (!trigger) return;
          // Don't intercept submit/close inside our panel
          if (trigger.closest('#mm-search-panel')) return;

          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

          // Prevent Ella <details> from opening
          const details = trigger.closest('details');
          if (details) details.open = false;

          this.openPanel(trigger.closest('summary, button, a, [data-mm-search-open]') || trigger);
        },
        true
      );
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

      // Force reflow then animate
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

    async runSearch() {
      const q = (this.input?.value || '').trim();
      if (q.length < MIN_CHARS) {
        this.clearResults();
        return;
      }

      const id = ++this.requestId;
      if (this.abort) this.abort.abort();
      this.abort = new AbortController();

      if (this.status) this.status.textContent = i18n.loading || '';

      // Some buyer locales (e.g. ka) return 417 Unsupported buyer locale on /search/suggest.json.
      // Retry via /en/… which still returns localized product titles for this shop.
      const primaryBase = i18n.predictiveUrl || window.routes?.predictive_search_url || '/search/suggest';
      const bases = [primaryBase];
      if (!String(primaryBase).startsWith('/en/')) bases.push('/en/search/suggest');

      const query =
        `q=${encodeURIComponent(q)}` +
        `&resources[type]=product&resources[limit]=${LIMIT}` +
        `&resources[options][unavailable_products]=last` +
        `&resources[options][fields]=title,product_type,vendor,variants.title,variants.sku`;

      try {
        let data = null;
        for (const base of bases) {
          const clean = String(base).replace(/\.json$/i, '');
          const url = `${clean}.json?${query}`;
          const res = await fetch(url, { signal: this.abort.signal, headers: { Accept: 'application/json' } });
          if (res.ok) {
            data = await res.json();
            break;
          }
          if (res.status !== 417) throw new Error(String(res.status));
        }
        if (id !== this.requestId) return; // stale
        this.renderProducts(q, data?.resources?.results?.products || []);
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (id !== this.requestId) return;
        this.renderProducts(q, []);
      }
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
          const url = escapeHtml(product.url);
          const img = productImage(product);
          const priceRaw = product.price ?? product.price_min ?? product.price_max;
          const price = escapeHtml(formatMoney(priceRaw));
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

      const viewAllUrl = `${i18n.searchUrl || window.routes?.search_url || '/search'}?q=${encodeURIComponent(query)}&type=product&options%5Bprefix%5D=last`;
      const footer = `<a class="mm-search-panel__view-all" href="${escapeHtml(viewAllUrl)}">${escapeHtml(i18n.viewAll || '')}</a>`;

      this.results.innerHTML = `<div class="mm-search-panel__list">${items}</div>${footer}`;
      if (this.status) this.status.textContent = `${list.length}`;
    }
  }

  function boot() {
    window.__mmSearch = new MmSearch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('shopify:section:load', () => {
    window.__mmSearch = new MmSearch();
  });
})();
