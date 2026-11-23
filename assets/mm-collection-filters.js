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

  const setScrollLock = (locked) => {
    const docEl = document.documentElement;
    if (locked) {
      if (docEl.dataset.mmFiltersScrollLock === '1') return;
      docEl.dataset.mmFiltersScrollLock = '1';
      docEl.dataset.mmFiltersScrollY = String(window.scrollY || 0);
      docEl.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else if (docEl.dataset.mmFiltersScrollLock === '1') {
      const y = Number(docEl.dataset.mmFiltersScrollY || 0);
      delete docEl.dataset.mmFiltersScrollLock;
      delete docEl.dataset.mmFiltersScrollY;
      docEl.style.overflow = '';
      document.body.style.overflow = '';
      window.scrollTo(0, y);
    }
  };

  const validatePrice = (form) => {
    if (!form) return true;
    const wraps = form.querySelectorAll('[data-mm-price-range]');
    if (!wraps.length) return true;
    let ok = true;
    wraps.forEach((wrap) => {
      const minInput = wrap.querySelector('[data-mm-price-min]');
      const maxInput = wrap.querySelector('[data-mm-price-max]');
      const error = wrap.querySelector('[data-mm-price-error]');
      const minVal = parseNumber(minInput && minInput.value);
      const maxVal = parseNumber(maxInput && maxInput.value);
      const invalid = minVal != null && maxVal != null && minVal > maxVal;
      if (error) error.hidden = !invalid;
      if (invalid) {
        wrap.classList.add('is-invalid');
        ok = false;
        (minInput || maxInput)?.focus();
      } else {
        wrap.classList.remove('is-invalid');
      }
    });
    return ok;
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

  const snapshotFields = (scope) => {
    if (!scope) return [];
    const snapshot = [];
    scope.querySelectorAll('input, select, textarea').forEach((el) => {
      if (el.matches('[data-mm-filter-search]')) return;
      if (el.type === 'checkbox' || el.type === 'radio') {
        snapshot.push({ name: el.name, value: el.value, checked: el.checked, type: el.type });
      } else {
        snapshot.push({ name: el.name, value: el.value, type: el.type || el.tagName });
      }
    });
    return snapshot;
  };

  const clearValidation = (scope) => {
    if (!scope) return;
    scope.querySelectorAll('[data-mm-price-error]').forEach((err) => {
      err.hidden = true;
    });
    scope.querySelectorAll('[data-mm-price-range]').forEach((wrap) => {
      wrap.classList.remove('is-invalid');
    });
    scope.querySelectorAll('[data-mm-filter-search]').forEach((input) => {
      input.value = '';
      const group = input.closest('[data-mm-filter-group]');
      if (!group) return;
      group.querySelectorAll('[data-mm-filter-option]').forEach((row) => {
        row.hidden = false;
      });
    });
  };

  /** Restore committed (server-rendered) values — reliable discard without depending on toggle timing. */
  const restoreDefaults = (scope) => {
    if (!scope) return;
    scope.querySelectorAll('input, select, textarea').forEach((el) => {
      if (el.matches('[data-mm-filter-search]')) {
        el.value = '';
        return;
      }
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = el.defaultChecked;
      } else {
        el.value = el.defaultValue;
      }
    });
    clearValidation(scope);
  };

  const restoreFields = (scope, snapshot) => {
    if (!scope) return;
    if (!snapshot) {
      restoreDefaults(scope);
      return;
    }
    scope.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach((el) => {
      if (el.matches('[data-mm-filter-search]')) return;
      el.checked = false;
    });
    snapshot.forEach((item) => {
      if (item.type === 'checkbox' || item.type === 'radio') {
        const el = scope.querySelector(
          `input[type="${item.type}"][name="${CSS.escape(item.name)}"][value="${CSS.escape(item.value)}"]`
        );
        if (el) el.checked = item.checked;
      } else {
        const el = scope.querySelector(`[name="${CSS.escape(item.name)}"]`);
        if (el && el.type !== 'checkbox' && el.type !== 'radio') el.value = item.value;
      }
    });
    clearValidation(scope);
  };

  const updateGroupActiveBadge = (group) => {
    if (!group) return;
    const summary = group.querySelector('.mm-filters__group-summary');
    if (!summary) return;
    let count = 0;
    const price = group.querySelector('[data-mm-price-range]');
    if (price) {
      const minInput = price.querySelector('[data-mm-price-min]');
      const maxInput = price.querySelector('[data-mm-price-max]');
      if ((minInput && String(minInput.value || '').trim()) || (maxInput && String(maxInput.value || '').trim())) {
        count = 1;
      }
    } else {
      count = group.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked').length;
    }
    let badge = summary.querySelector('[data-mm-group-active]');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'mm-filters__group-active';
        badge.setAttribute('data-mm-group-active', '');
        badge.setAttribute('aria-hidden', 'true');
        const chevron = summary.querySelector('.mm-filters__group-chevron');
        summary.insertBefore(badge, chevron || null);
      }
      badge.textContent = String(count);
    } else if (badge) {
      badge.remove();
    }
  };

  class MmFilters {
    constructor(rootEl) {
      this.root = rootEl;
      this.openBtn = rootEl.querySelector('[data-mm-filters-open]');
      this.closeBtns = rootEl.querySelectorAll('[data-mm-filters-close]');
      this.overlay = rootEl.querySelector('[data-mm-filters-overlay]');
      this.panel = rootEl.querySelector('[data-mm-filters-panel]');
      this.desktopForm = rootEl.querySelector('[data-mm-filters-desktop-form]');
      this.panelForm = rootEl.querySelector('[data-mm-filters-panel-form]');
      this.sortForms = rootEl.querySelectorAll('[data-mm-filters-sort-form]');
      this.loadingEl = rootEl.querySelector('[data-mm-filters-loading]');
      this.filtersSectionId = rootEl.getAttribute('data-mm-section-id');
      this.requestId = 0;
      this.abort = null;
      this.lastFocus = null;
      this.focusTrapHandler = null;
      this.panelSnapshot = null;
      this.groupSnapshots = new WeakMap();
      this.applyingDesktop = false;
      this.boundKeydown = this.onDocumentKeydown.bind(this);
      this.boundCloseRequest = this.onCloseRequest.bind(this);
      this.boundDocClick = this.onDocumentClick.bind(this);
      this.boundChipClick = this.onChipClick.bind(this);
      this.bind();
    }

    destroy() {
      document.removeEventListener('keydown', this.boundKeydown);
      document.removeEventListener('mm:filters-close-request', this.boundCloseRequest);
      document.removeEventListener('click', this.boundDocClick);
      if (this.root) this.root.removeEventListener('click', this.boundChipClick);
      if (this.onPopState) window.removeEventListener('popstate', this.onPopState);
      this.releaseFocusTrap();
      setScrollLock(false);
      if (this.abort) this.abort.abort();
    }

    onCloseRequest() {
      if (this.root.classList.contains('is-panel-open')) {
        this.setOpen(false, { discard: true });
      }
    }

    closeDesktopGroups({ discard = true } = {}) {
      if (!this.root) return;
      this.root.querySelectorAll('.mm-filters__groups--toolbar .mm-filters__group[open]').forEach((group) => {
        if (discard && !this.applyingDesktop) {
          restoreDefaults(group);
          updateGroupActiveBadge(group);
        }
        group.open = false;
      });
    }

    onDocumentClick(event) {
      if (!this.root) return;
      if (this.root.classList.contains('is-panel-open')) return;
      const openGroups = this.root.querySelectorAll('.mm-filters__groups--toolbar .mm-filters__group[open]');
      if (!openGroups.length) return;
      let inside = false;
      openGroups.forEach((openGroup) => {
        if (openGroup.contains(event.target)) inside = true;
      });
      if (inside) return;
      this.closeDesktopGroups({ discard: true });
    }

    bindExclusiveGroups() {
      if (!this.root) return;
      this.root.querySelectorAll('.mm-filters__groups--toolbar .mm-filters__group').forEach((group) => {
        group.addEventListener('toggle', () => {
          if (group.open) {
            this.groupSnapshots.set(group, snapshotFields(group));
            this.root.querySelectorAll('.mm-filters__groups--toolbar .mm-filters__group[open]').forEach((other) => {
              if (other === group) return;
              if (!this.applyingDesktop) {
                restoreDefaults(other);
                updateGroupActiveBadge(other);
              }
              other.open = false;
            });
            return;
          }
          if (this.applyingDesktop) return;
          restoreDefaults(group);
          updateGroupActiveBadge(group);
        });
      });

      // Mobile panel: accordion without discard (panel snapshot handles discard on close)
      this.root.querySelectorAll('.mm-filters__groups--panel .mm-filters__group').forEach((group) => {
        group.addEventListener('toggle', () => {
          if (!group.open) return;
          this.root.querySelectorAll('.mm-filters__groups--panel .mm-filters__group[open]').forEach((other) => {
            if (other !== group) other.open = false;
          });
        });
      });
    }

    bindProvisionalUpdates(form) {
      if (!form) return;
      form.addEventListener('change', (event) => {
        const target = event.target;
        if (!target || target.matches('[data-mm-filter-search]')) return;
        if (!target.matches('input[type="checkbox"], input[type="radio"], .mm-filters__price-input')) return;
        const group = target.closest('[data-mm-filter-group]');
        updateGroupActiveBadge(group);
        if (target.matches('.mm-filters__price-input')) {
          validatePrice(form);
        }
      });
      form.querySelectorAll('.mm-filters__price-input').forEach((input) => {
        input.addEventListener('input', () => {
          // Visual validation only — never navigate on keystroke.
          const wrap = input.closest('[data-mm-price-range]');
          if (!wrap) return;
          const minInput = wrap.querySelector('[data-mm-price-min]');
          const maxInput = wrap.querySelector('[data-mm-price-max]');
          const error = wrap.querySelector('[data-mm-price-error]');
          const minVal = parseNumber(minInput && minInput.value);
          const maxVal = parseNumber(maxInput && maxInput.value);
          const invalid = minVal != null && maxVal != null && minVal > maxVal;
          if (error) error.hidden = !invalid;
          wrap.classList.toggle('is-invalid', invalid);
          updateGroupActiveBadge(input.closest('[data-mm-filter-group]'));
        });
      });
    }

    onChipClick(event) {
      const link = event.target.closest('a.mm-filters__chip, a.mm-filters__reset, [data-mm-filters-reset]');
      if (!link || !this.root.contains(link)) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      event.preventDefault();
      this.navigate(new URL(href, window.location.origin), { source: 'chip' });
    }

    bind() {
      document.addEventListener('keydown', this.boundKeydown);
      document.addEventListener('mm:filters-close-request', this.boundCloseRequest);
      document.addEventListener('click', this.boundDocClick);

      if (this.openBtn) {
        this.openBtn.addEventListener('click', () => this.setOpen(true));
      }
      this.closeBtns.forEach((btn) => {
        btn.addEventListener('click', () => this.setOpen(false, { discard: true }));
      });
      if (this.overlay) {
        this.overlay.addEventListener('click', () => this.setOpen(false, { discard: true }));
      }

      this.bindFilterSearch(this.root);
      this.bindExclusiveGroups();
      this.bindProvisionalUpdates(this.desktopForm);
      this.bindProvisionalUpdates(this.panelForm);

      const retryBtn = this.root.querySelector('[data-mm-filters-retry]');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          const err = this.root.querySelector('[data-mm-filters-error]');
          if (err) err.hidden = true;
          this.navigate(new URL(window.location.href), { push: false, source: 'retry' });
        });
      }

      if (this.desktopForm) {
        const syncDesktopSort = () => {
          const liveSort = this.root.querySelector(
            '.mm-filters__toolbar select[data-mm-filters-sort], .mm-filters__sort--desktop select[data-mm-filters-sort]'
          );
          const hiddenSort = this.desktopForm.querySelector('[data-mm-desktop-sort]');
          if (liveSort && hiddenSort) hiddenSort.value = liveSort.value;
        };

        this.desktopForm.addEventListener('submit', (event) => {
          event.preventDefault();
          if (!validatePrice(this.desktopForm)) {
            restoreDisabledPriceInputs(this.desktopForm);
            return;
          }
          this.applyingDesktop = true;
          syncDesktopSort();
          prepareForm(this.desktopForm);
          const url = formToUrl(this.desktopForm);
          this.closeDesktopGroups({ discard: false });
          this.navigate(url, { source: 'desktop' });
          restoreDisabledPriceInputs(this.desktopForm);
          this.applyingDesktop = false;
        });
      }

      if (this.panelForm) {
        this.panelForm.addEventListener('submit', (event) => {
          event.preventDefault();
          if (!validatePrice(this.panelForm)) {
            restoreDisabledPriceInputs(this.panelForm);
            return;
          }
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

      this.root.addEventListener('click', this.boundChipClick);

      this.onPopState = () => {
        this.navigate(new URL(window.location.href), { push: false, source: 'popstate' });
      };
      window.addEventListener('popstate', this.onPopState);
    }

    onDocumentKeydown(event) {
      if (event.key !== 'Escape') return;
      if (this.root.classList.contains('is-panel-open')) {
        this.setOpen(false, { discard: true });
        return;
      }
      const openDesktop = this.root.querySelector('.mm-filters__groups--toolbar .mm-filters__group[open]');
      if (openDesktop) {
        this.closeDesktopGroups({ discard: true });
      }
    }

    getFocusable() {
      if (!this.panel) return [];
      return Array.from(
        this.panel.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.getAttribute('aria-hidden') !== 'true' && !el.closest('[hidden]'));
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
      this.panelSnapshot = snapshotFields(this.panelForm);
    }

    restorePanel() {
      if (!this.panelForm) return;
      if (this.panelSnapshot) {
        restoreFields(this.panelForm, this.panelSnapshot);
      } else {
        restoreDefaults(this.panelForm);
      }
      this.panelForm.querySelectorAll('[data-mm-filter-group]').forEach((group) => {
        updateGroupActiveBadge(group);
      });
    }

    setOpen(open, { discard = false } = {}) {
      if (open) {
        this.snapshotPanel();
        if (window.mmA11yOverlays) window.mmA11yOverlays.closeOthers('filters');
        document.dispatchEvent(new CustomEvent('mm:overlay-open', { detail: { which: 'filters' } }));
      } else if (discard) {
        this.restorePanel();
      }

      this.root.classList.toggle('is-panel-open', open);
      setScrollLock(open);
      if (this.panel) {
        this.panel.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (open) {
          this.panel.setAttribute('role', 'dialog');
          this.panel.setAttribute('aria-modal', 'true');
        } else {
          this.panel.removeAttribute('aria-modal');
        }
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
        document.dispatchEvent(new CustomEvent('mm:overlay-close', { detail: { which: 'filters' } }));
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

      if (source === 'desktop' || source === 'panel' || source === 'chip' || source === 'sort') {
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
        // Do not send Accept: application/json — this store returns 404 for that header
        // on the Section Rendering API; default Accept yields valid JSON.
        const res = await fetch(fetchUrl.toString(), {
          signal: this.abort.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (currentRequest !== this.requestId) return;

        const filtersHtml = data[filtersSectionId];
        const resultsHtml = resultsSectionId ? data[resultsSectionId] : null;
        if (!filtersHtml && !resultsHtml) {
          throw new Error('empty-sections');
        }

        if (push) {
          window.history.pushState({}, '', url.toString());
        }

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

        const nextRoot = document.querySelector('[data-mm-filters]');
        if (window.__mmFiltersInstance) {
          window.__mmFiltersInstance.destroy();
          window.__mmFiltersInstance = null;
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
        // Section Rendering unavailable/failed → native full navigation keeps filters usable.
        window.location.assign(url.toString());
        return;
      } finally {
        if (currentRequest === this.requestId) {
          this.setLoading(false);
        }
      }
    }

    bindFilterSearch(scope) {
      scope.querySelectorAll('[data-mm-filter-search]').forEach((input) => {
        input.addEventListener('input', () => {
          const group = input.closest('[data-mm-filter-group]');
          if (!group) return;
          const q = String(input.value || '').trim().toLowerCase();
          group.querySelectorAll('[data-mm-filter-option]').forEach((row) => {
            const label = row.getAttribute('data-mm-filter-label') || '';
            row.hidden = q !== '' && !label.includes(q);
          });
        });
      });
    }
  }

  const boot = () => {
    const rootEl = document.querySelector('[data-mm-filters]');
    if (!rootEl) return;
    if (window.__mmFiltersInstance) {
      window.__mmFiltersInstance.destroy();
      window.__mmFiltersInstance = null;
    }
    window.__mmFiltersInstance = new MmFilters(rootEl);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Silence unused helper in some builds; motion preference used by CSS primarily.
  void prefersReducedMotion;
})();
