(() => {
  const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const parseNumber = (value) => {
    if (value == null || String(value).trim() === '') return null;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const findResultsSection = () =>
    document.getElementById('shopify-section-product-grid') ||
    document.getElementById('shopify-section-main') ||
    document.querySelector('#CollectionProductGrid')?.closest('[id^="shopify-section-"]') ||
    document.querySelector('#main-collection-product-grid')?.closest('[id^="shopify-section-"]');

  const sectionDomId = (el) => {
    if (!el || !el.id) return null;
    return el.id.replace(/^shopify-section-/, '');
  };

  // Filter drawer only: prevent background scroll while open (brief). Restore on close.
  const setScrollLock = (locked) => {
    const root = document.documentElement;
    if (locked) {
      if (root.dataset.mmFiltersScrollLock === '1') return;
      root.dataset.mmFiltersScrollLock = '1';
      root.dataset.mmFiltersScrollY = String(window.scrollY || 0);
      root.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else if (root.dataset.mmFiltersScrollLock === '1') {
      const y = Number(root.dataset.mmFiltersScrollY || 0);
      delete root.dataset.mmFiltersScrollLock;
      delete root.dataset.mmFiltersScrollY;
      root.style.overflow = '';
      document.body.style.overflow = '';
      window.scrollTo(0, y);
    }
  };

  const validatePrice = (form) => {
    if (!form) return true;
    const wrap = form.querySelector('[data-mm-price-range]');
    if (!wrap) return true;
    const minInput = wrap.querySelector('[data-mm-price-min]');
    const maxInput = wrap.querySelector('[data-mm-price-max]');
    const error = wrap.querySelector('[data-mm-price-error]');
    const minVal = parseNumber(minInput && minInput.value);
    const maxVal = parseNumber(maxInput && maxInput.value);
    const invalid = minVal != null && maxVal != null && minVal > maxVal;
    if (error) {
      error.hidden = !invalid;
    }
    if (invalid) {
      wrap.classList.add('is-invalid');
      (minInput || maxInput)?.focus();
      return false;
    }
    wrap.classList.remove('is-invalid');
    return true;
  };

  const prepareForm = (form) => {
    if (!form) return;
    form.querySelectorAll('.mm-filters__price-input').forEach((input) => {
      if (!input.value || !String(input.value).trim()) {
        input.disabled = true;
      }
    });
  };

  const restoreDisabledPriceInputs = (form) => {
    if (!form) return;
    form.querySelectorAll('.mm-filters__price-input[disabled]').forEach((input) => {
      input.disabled = false;
    });
  };

  const formToUrl = (form, { resetPage = true } = {}) => {
    const action = form.getAttribute('action') || window.location.pathname;
    const url = new URL(action, window.location.origin);
    const data = new FormData(form);
    const params = new URLSearchParams();
    data.forEach((value, key) => {
      if (value === '' || value == null) return;
      params.append(key, String(value));
    });
    if (resetPage) params.delete('page');
    url.search = params.toString();
    return url;
  };

  class MmFilters {
    constructor(root) {
      this.root = root;
      this.openBtn = root.querySelector('[data-mm-filters-open]');
      this.closeBtns = root.querySelectorAll('[data-mm-filters-close]');
      this.overlay = root.querySelector('[data-mm-filters-overlay]');
      this.panel = root.querySelector('[data-mm-filters-panel]');
      this.desktopForm = root.querySelector('[data-mm-filters-desktop-form]');
      this.panelForm = root.querySelector('[data-mm-filters-panel-form]');
      this.sortForms = root.querySelectorAll('[data-mm-filters-sort-form]');
      this.loadingEl = root.querySelector('[data-mm-filters-loading]');
      this.filtersSectionId = root.getAttribute('data-mm-section-id');
      this.requestId = 0;
      this.abort = null;
      this.lastFocus = null;
      this.focusTrapHandler = null;
      this.panelSnapshot = null;
      this.boundKeydown = this.onDocumentKeydown.bind(this);
      this.bind();
    }

    destroy() {
      document.removeEventListener('keydown', this.boundKeydown);
      if (this.onPopState) window.removeEventListener('popstate', this.onPopState);
      this.releaseFocusTrap();
      setScrollLock(false);
      if (this.abort) this.abort.abort();
    }

    bind() {
      document.addEventListener('keydown', this.boundKeydown);

      if (this.openBtn) {
        this.openBtn.addEventListener('click', () => this.setOpen(true));
      }
      this.closeBtns.forEach((btn) => {
        btn.addEventListener('click', () => this.setOpen(false, { discard: true }));
      });
      if (this.overlay) {
        this.overlay.addEventListener('click', () => this.setOpen(false, { discard: true }));
      }

      if (this.desktopForm) {
        this.desktopForm.addEventListener('submit', (event) => {
          if (!validatePrice(this.desktopForm)) {
            event.preventDefault();
            restoreDisabledPriceInputs(this.desktopForm);
            return;
          }
          prepareForm(this.desktopForm);
          event.preventDefault();
          this.navigate(formToUrl(this.desktopForm), { source: 'desktop' });
          restoreDisabledPriceInputs(this.desktopForm);
        });

        this.desktopForm.addEventListener('change', (event) => {
          const target = event.target;
          if (!target) return;
          if (target.matches('input[type="checkbox"], input[type="radio"], select[data-mm-filters-sort]')) {
            if (!validatePrice(this.desktopForm)) return;
            prepareForm(this.desktopForm);
            this.navigate(formToUrl(this.desktopForm), { source: 'desktop' });
            restoreDisabledPriceInputs(this.desktopForm);
          }
        });

        this.desktopForm.querySelectorAll('.mm-filters__price-input').forEach((input) => {
          input.addEventListener('change', () => {
            if (!validatePrice(this.desktopForm)) return;
            prepareForm(this.desktopForm);
            this.navigate(formToUrl(this.desktopForm), { source: 'desktop' });
            restoreDisabledPriceInputs(this.desktopForm);
          });
        });
      }

      if (this.panelForm) {
        this.panelForm.addEventListener('submit', (event) => {
          event.preventDefault();
          if (!validatePrice(this.panelForm)) {
            restoreDisabledPriceInputs(this.panelForm);
            return;
          }
          // Sync current desktop/mobile sort into panel before apply
          const liveSort = this.root.querySelector('select[data-mm-filters-sort]');
          const panelSort = this.panelForm.querySelector('[data-mm-panel-sort]');
          if (liveSort && panelSort) panelSort.value = liveSort.value;
          prepareForm(this.panelForm);
          this.setOpen(false, { discard: false });
          this.navigate(formToUrl(this.panelForm), { source: 'panel' });
          restoreDisabledPriceInputs(this.panelForm);
        });
      }

      this.sortForms.forEach((form) => {
        const select = form.querySelector('[data-mm-filters-sort]');
        if (!select) return;
        select.addEventListener('change', () => {
          prepareForm(form);
          this.navigate(formToUrl(form, { resetPage: true }), { source: 'sort' });
          restoreDisabledPriceInputs(form);
        });
      });

      this.root.addEventListener('click', (event) => {
        const link = event.target.closest('a.mm-filters__chip, a.mm-filters__reset, [data-mm-filters-reset]');
        if (!link || !this.root.contains(link)) return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#')) return;
        event.preventDefault();
        this.navigate(new URL(href, window.location.origin), { source: 'chip' });
      });

      this.onPopState = () => {
        this.navigate(new URL(window.location.href), { push: false, source: 'popstate' });
      };
      window.addEventListener('popstate', this.onPopState);
    }

    onDocumentKeydown(event) {
      if (event.key === 'Escape' && this.root.classList.contains('is-panel-open')) {
        this.setOpen(false, { discard: true });
      }
    }

    getFocusable() {
      if (!this.panel) return [];
      return Array.from(
        this.panel.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.getAttribute('aria-hidden') !== 'true');
    }

    releaseFocusTrap() {
      if (this.focusTrapHandler) {
        document.removeEventListener('keydown', this.focusTrapHandler);
        this.focusTrapHandler = null;
      }
    }

    trapFocus() {
      this.releaseFocusTrap();
      this.focusTrapHandler = (event) => {
        if (event.key !== 'Tab' || !this.root.classList.contains('is-panel-open')) return;
        const focusable = this.getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };
      document.addEventListener('keydown', this.focusTrapHandler);
    }

    snapshotPanel() {
      if (!this.panelForm) return;
      const snapshot = [];
      this.panelForm.querySelectorAll('input, select, textarea').forEach((el) => {
        if (el.type === 'checkbox' || el.type === 'radio') {
          snapshot.push({ name: el.name, value: el.value, checked: el.checked, type: el.type });
        } else {
          snapshot.push({ name: el.name, value: el.value, type: el.type || el.tagName });
        }
      });
      this.panelSnapshot = snapshot;
    }

    restorePanel() {
      if (!this.panelForm || !this.panelSnapshot) return;
      this.panelForm.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach((el) => {
        el.checked = false;
      });
      this.panelSnapshot.forEach((item) => {
        if (item.type === 'checkbox' || item.type === 'radio') {
          const el = this.panelForm.querySelector(
            `input[type="${item.type}"][name="${CSS.escape(item.name)}"][value="${CSS.escape(item.value)}"]`
          );
          if (el) el.checked = item.checked;
        } else {
          const el = this.panelForm.querySelector(`[name="${CSS.escape(item.name)}"]`);
          if (el) el.value = item.value;
        }
      });
      this.panelForm.querySelectorAll('[data-mm-price-error]').forEach((err) => {
        err.hidden = true;
      });
      this.panelForm.querySelectorAll('[data-mm-price-range]').forEach((wrap) => {
        wrap.classList.remove('is-invalid');
      });
    }

    setOpen(open, { discard = false } = {}) {
      if (open) {
        this.snapshotPanel();
      } else if (discard) {
        this.restorePanel();
      }

      this.root.classList.toggle('is-panel-open', open);
      setScrollLock(open);
      if (this.panel) {
        this.panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      }
      if (this.openBtn) {
        this.openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      }

      if (open) {
        this.lastFocus = document.activeElement;
        const closeBtn = this.root.querySelector('.mm-filters__panel-close');
        if (closeBtn) closeBtn.focus();
        this.trapFocus();
      } else {
        this.releaseFocusTrap();
        if (this.lastFocus && typeof this.lastFocus.focus === 'function') {
          this.lastFocus.focus();
        }
      }
    }

    setLoading(isLoading) {
      this.root.classList.toggle('is-loading', isLoading);
      if (this.loadingEl) this.loadingEl.hidden = !isLoading;
      const resultsSection = findResultsSection();
      if (resultsSection) resultsSection.classList.toggle('is-loading', isLoading);
      if (this.openBtn) this.openBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    }

    async navigate(url, { push = true, source = '' } = {}) {
      if (!(url instanceof URL)) url = new URL(String(url), window.location.origin);

      // Filter changes always reset pagination; sort may keep page but Shopify often resets anyway.
      if (source === 'desktop' || source === 'panel') {
        url.searchParams.delete('page');
      }

      const resultsSection = findResultsSection();
      const resultsSectionId = sectionDomId(resultsSection);
      const filtersSectionId = this.filtersSectionId;
      const sectionIds = [filtersSectionId, resultsSectionId].filter(Boolean);

      if (!sectionIds.length || !window.fetch) {
        window.location.assign(url.toString());
        return;
      }

      if (this.abort) this.abort.abort();
      this.abort = new AbortController();
      const currentRequest = ++this.requestId;
      this.setLoading(true);

      const fetchUrl = new URL(url.toString());
      fetchUrl.searchParams.set('sections', sectionIds.join(','));

      try {
        const res = await fetch(fetchUrl.toString(), {
          signal: this.abort.signal,
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (currentRequest !== this.requestId) return;

        if (push) {
          window.history.pushState({}, '', url.toString());
        }

        const filtersHtml = data[filtersSectionId];
        const resultsHtml = resultsSectionId ? data[resultsSectionId] : null;

        if (filtersHtml) {
          const filtersHost = document.getElementById(`shopify-section-${filtersSectionId}`);
          if (filtersHost) {
            filtersHost.outerHTML = filtersHtml;
          }
        }
        if (resultsHtml && resultsSection) {
          const host = document.getElementById(`shopify-section-${resultsSectionId}`);
          if (host) host.outerHTML = resultsHtml;
        }

        // Re-bind on the replaced filters root
        const nextRoot = document.querySelector('[data-mm-filters]');
        if (window.__mmFiltersInstance) {
          window.__mmFiltersInstance.destroy();
        }
        if (nextRoot) {
          window.__mmFiltersInstance = new MmFilters(nextRoot);
        }

        document.dispatchEvent(
          new CustomEvent('mm:filters:updated', {
            detail: { url: url.toString(), source },
          })
        );
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        // Fallback: full navigation keeps server filters correct
        window.location.assign(url.toString());
      } finally {
        if (currentRequest === this.requestId) {
          this.setLoading(false);
        }
      }
    }
  }

  const boot = () => {
    const root = document.querySelector('[data-mm-filters]');
    if (!root) return;
    if (window.__mmFiltersInstance) {
      window.__mmFiltersInstance.destroy();
    }
    window.__mmFiltersInstance = new MmFilters(root);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
