(() => {
  const MIN_CHARS = 2;
  const DEBOUNCE_MS = 250;
  const LIMIT = 6;

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
    if (price == null || price === '') return NaN;
    const n = typeof price === 'string' ? parseFloat(price.replace(',', '.')) : Number(price);
    if (!Number.isFinite(n)) return NaN;
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

  function suggestionsStatus(count) {
    const template = i18n.suggestions || '';
    if (template.includes('{{ count }}')) {
      return template.replace(/\{\{\s*count\s*\}\}/g, String(count));
    }
    return template ? `${template}: ${count}` : String(count);
  }

  class MmSearch {
    constructor() {
      this.panel = document.getElementById('mm-search-panel');
      if (!this.panel) return;

      this.input = this.panel.querySelector('[data-mm-search-input]');
      this.form = this.panel.querySelector('[data-mm-search-form]');
      this.results = this.panel.querySelector('[data-mm-search-results]');
      this.status = this.panel.querySelector('[data-mm-search-status]');
      this.bestsellers = this.panel.querySelector('[data-mm-search-bestsellers]');
      this.trigger = null;
      this.open = false;
      this.debounceTimer = null;
      this.requestId = 0;
      this.abort = null;
      this.activeIndex = -1;
      this.optionEls = [];

      this.onDocClick = this.onDocClick.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.onInput = this.onInput.bind(this);
      this.onTriggerClick = this.onTriggerClick.bind(this);
      this.onCloseClick = this.onCloseClick.bind(this);
      this.onFormSubmit = this.onFormSubmit.bind(this);
      this.onResultsClick = this.onResultsClick.bind(this);
      this.onViewport = this.onViewport.bind(this);
      this.onEllaSidebarFocus = this.onEllaSidebarFocus.bind(this);

      this.bindTriggers();
      this.bindEllaSidebarBridge();
      this.panel.querySelectorAll('[data-mm-search-close]').forEach((el) => {
        el.addEventListener('click', this.onCloseClick);
      });
      this.input?.addEventListener('input', this.onInput);
      this.form?.addEventListener('submit', this.onFormSubmit);
      this.results?.addEventListener('click', this.onResultsClick);
      this.showBestsellers();
    }

    onCloseClick(event) {
      event.preventDefault();
      this.close();
    }

    onFormSubmit(event) {
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
        [
          '.header-nav-hamburger .header__icon--search',
          '.header-nav-hamburger [data-search-menu]',
          '[data-search-mobile]',
          '[data-search-menu]',
          '.header-mobile__item--search summary',
          '[data-mm-search-open]',
        ].join(', ')
      );
      if (!trigger) return;
      if (trigger.closest('#mm-search-panel')) return;
      if (trigger.matches('[data-search-close-sidebar], [data-mm-search-close]')) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

      const details = trigger.closest('details');
      if (details) details.open = false;
      this.closeEllaSidebar();

      this.openPanel(trigger.closest('summary, button, a, [data-mm-search-open], [data-search-mobile]') || trigger);
    }

    bindTriggers() {
      document.addEventListener('click', this.onTriggerClick, true);
    }

    bindEllaSidebarBridge() {
      const ellaInput = document.getElementById('Search-In-Modal-Sidebar');
      if (!ellaInput || ellaInput.dataset.mmSearchBridged === '1') return;
      ellaInput.dataset.mmSearchBridged = '1';
      ellaInput.addEventListener('focus', this.onEllaSidebarFocus, true);
      ellaInput.addEventListener('input', this.onEllaSidebarFocus, true);
    }

    onEllaSidebarFocus(event) {
      const ellaInput = event.currentTarget;
      if (!ellaInput || this.open) {
        if (this.open && ellaInput && document.activeElement === ellaInput) {
          const q = ellaInput.value || '';
          if (this.input && this.input.value !== q) {
            this.input.value = q;
            this.onInput();
          }
          this.input?.focus({ preventScroll: true });
        }
        return;
      }
      const q = ellaInput.value || '';
      this.closeEllaSidebar();
      this.openPanel(ellaInput);
      if (this.input) {
        this.input.value = q;
        if (q.trim().length >= MIN_CHARS) this.scheduleSearch();
        else this.showBestsellers();
      }
    }

    closeEllaSidebar() {
      document.body.classList.remove('open_search_mobile', 'open_search_menu', 'open_search');
      document.documentElement.classList.remove('open_search_mobile');
      const sidebar = document.getElementById('search-form-mobile');
      if (sidebar) {
        sidebar.classList.remove('is-open', 'halo-sidebar-active');
        sidebar.querySelectorAll('details[open]').forEach((d) => d.removeAttribute('open'));
      }
    }

    showBestsellers() {
      if (!this.bestsellers) return;
      this.bestsellers.hidden = false;
      this.bestsellers.removeAttribute('aria-hidden');
    }

    hideBestsellers() {
      if (!this.bestsellers) return;
      this.bestsellers.hidden = true;
      this.bestsellers.setAttribute('aria-hidden', 'true');
    }

    destroy() {
      document.removeEventListener('click', this.onTriggerClick, true);
      document.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('click', this.onDocClick, true);
      this.input?.removeEventListener('input', this.onInput);
      this.form?.removeEventListener('submit', this.onFormSubmit);
      this.results?.removeEventListener('click', this.onResultsClick);
      const ellaInput = document.getElementById('Search-In-Modal-Sidebar');
      if (ellaInput) {
        ellaInput.removeEventListener('focus', this.onEllaSidebarFocus, true);
        ellaInput.removeEventListener('input', this.onEllaSidebarFocus, true);
        delete ellaInput.dataset.mmSearchBridged;
      }
      this.panel?.querySelectorAll('[data-mm-search-close]').forEach((el) => {
        el.removeEventListener('click', this.onCloseClick);
      });
      this.unbindViewport();
      if (this.abort) {
        this.abort.abort();
        this.abort = null;
      }
      window.clearTimeout(this.debounceTimer);
    }

    bindViewport() {
      this.onViewport();
      window.visualViewport?.addEventListener('resize', this.onViewport);
      window.visualViewport?.addEventListener('scroll', this.onViewport);
      window.addEventListener('resize', this.onViewport);
    }

    unbindViewport() {
      window.visualViewport?.removeEventListener('resize', this.onViewport);
      window.visualViewport?.removeEventListener('scroll', this.onViewport);
      window.removeEventListener('resize', this.onViewport);
    }

    onViewport() {
      if (!this.panel || !this.open) return;
      const vv = window.visualViewport;
      const h = vv?.height || window.innerHeight;
      this.panel.style.setProperty('--mm-search-vvh', `${Math.round(h)}px`);
      if (vv) {
        this.panel.style.setProperty('--mm-search-vvo', `${Math.round(vv.offsetTop || 0)}px`);
      }
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
      this.bindViewport();

      window.setTimeout(() => {
        this.input?.focus({ preventScroll: true });
        this.input?.select?.();
      }, 30);

      document.addEventListener('keydown', this.onKeydown);
      document.addEventListener('click', this.onDocClick, true);
      this.closeEllaSidebar();

      if ((this.input?.value || '').trim().length >= MIN_CHARS) {
        this.hideBestsellers();
        this.scheduleSearch();
      } else {
        this.clearResults();
        this.showBestsellers();
      }
    }

    close() {
      if (!this.panel || !this.open) return;
      this.open = false;
      this.panel.classList.remove('is-open');
      this.panel.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('mm-search-open');
      document.body.classList.remove('mm-search-open');
      this.unbindViewport();

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
      else window.setTimeout(finish, 200);

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
        return;
      }

      if (!this.optionEls.length) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.setActiveIndex(this.activeIndex < this.optionEls.length - 1 ? this.activeIndex + 1 : 0);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.setActiveIndex(this.activeIndex > 0 ? this.activeIndex - 1 : this.optionEls.length - 1);
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        this.setActiveIndex(0);
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        this.setActiveIndex(this.optionEls.length - 1);
        return;
      }

      if (event.key === 'Enter' && this.activeIndex >= 0) {
        const active = this.optionEls[this.activeIndex];
        if (active) {
          event.preventDefault();
          active.click();
        }
      }
    }

    setActiveIndex(index) {
      this.activeIndex = index;
      this.optionEls.forEach((el, i) => {
        const on = i === index;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      const active = this.optionEls[index];
      if (active) {
        this.input?.setAttribute('aria-activedescendant', active.id);
        active.scrollIntoView({ block: 'nearest' });
      } else {
        this.input?.removeAttribute('aria-activedescendant');
      }
    }

    onInput() {
      const q = (this.input?.value || '').trim();
      if (q.length < MIN_CHARS) {
        this.clearResults();
        this.showBestsellers();
        if (this.abort) {
          this.abort.abort();
          this.abort = null;
        }
        window.clearTimeout(this.debounceTimer);
        return;
      }
      this.hideBestsellers();
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
      this.optionEls = [];
      this.activeIndex = -1;
      this.input?.setAttribute('aria-expanded', 'false');
      this.input?.removeAttribute('aria-activedescendant');
      if (this.status) this.status.textContent = '';
    }

    onResultsClick(event) {
      const retry = event.target.closest('[data-mm-search-retry]');
      if (!retry) return;
      event.preventDefault();
      this.runSearch();
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

      this.hideBestsellers();
      if (this.status) this.status.textContent = i18n.loading || '';
      this.results.hidden = false;
      this.results.innerHTML = `<p class="mm-search-panel__loading" aria-hidden="true">${escapeHtml(i18n.loading || '')}</p>`;

      try {
        let products = [];
        try {
          products = await this.fetchSuggestJson(q, signal);
        } catch (suggestErr) {
          if (suggestErr?.name === 'AbortError') return;
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
      this.hideBestsellers();
      this.results.hidden = false;
      this.optionEls = [];
      this.activeIndex = -1;
      this.input?.setAttribute('aria-expanded', 'true');
      this.input?.removeAttribute('aria-activedescendant');
      const msg = escapeHtml(i18n.error || i18n.noResults || '');
      const retry = escapeHtml(i18n.retry || '');
      this.results.innerHTML = `
        <div class="mm-search-panel__error">
          <p class="mm-search-panel__empty">${msg}</p>
          <button type="button" class="mm-search-panel__retry" data-mm-search-retry>${retry}</button>
        </div>`;
      if (this.status) this.status.textContent = i18n.error || '';
    }

    renderProducts(query, products) {
      if (!this.results) return;
      const list = Array.isArray(products) ? products.slice(0, LIMIT) : [];
      this.hideBestsellers();
      this.results.hidden = false;
      this.input?.setAttribute('aria-expanded', 'true');
      this.activeIndex = -1;

      if (!list.length) {
        this.optionEls = [];
        this.input?.removeAttribute('aria-activedescendant');
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
          return `<a class="mm-search-panel__item" role="option" id="mm-search-option-${index}" href="${url}" aria-selected="false">
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
      this.optionEls = [...this.results.querySelectorAll('.mm-search-panel__item')];
      if (this.status) this.status.textContent = suggestionsStatus(list.length);
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
