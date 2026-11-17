(() => {
  const DESKTOP_MQ = window.matchMedia('(min-width: 1025px)');

  function stickyEnabled(el) {
    if (!el) return false;
    const type = el.getAttribute('data-sticky-type');
    return type && type !== 'none';
  }

  function ensureSpacer(beforeEl, className) {
    const parent = beforeEl?.parentElement;
    if (!parent) return null;
    let spacer = beforeEl.previousElementSibling;
    if (!(spacer && spacer.classList.contains(className))) {
      spacer = parent.querySelector(`:scope > .${className}`);
    }
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.className = className;
      spacer.setAttribute('aria-hidden', 'true');
      parent.insertBefore(spacer, beforeEl);
    } else if (spacer.nextElementSibling !== beforeEl) {
      parent.insertBefore(spacer, beforeEl);
    }
    return spacer;
  }

  function ensureDesktopMainRow(container) {
    if (!container) return null;
    let row = container.querySelector(':scope > .mm-header-main-row');
    if (row) return row;

    const logo = container.querySelector(':scope > .header-logo');
    const icons = container.querySelector(':scope > .header-icons');
    if (!logo && !icons) return null;

    row = document.createElement('div');
    row.className = 'mm-header-main-row';
    if (logo) row.appendChild(logo);
    if (icons) row.appendChild(icons);
    container.insertBefore(row, container.firstChild);
    return row;
  }

  function neutralizeEllaSticky(section) {
    if (!section) return;
    section.classList.remove(
      'shopify-section-header-sticky',
      'shopify-section-header-hidden',
      'shopify-section-header-show',
      'animate',
      'scrolled-past-header'
    );
    section.style.top = '';
    document.body.classList.remove('section-header-is-hidden');
  }

  class MmPinController {
    constructor({ section, row, enabled }) {
      this.section = section;
      this.row = row;
      this.enabled = enabled;
      this.pinned = false;
      this.pinY = 0;
      this.spacer = null;
      this.onScroll = this.onScroll.bind(this);
      this.onResize = this.onResize.bind(this);
    }

    start() {
      if (!this.enabled || !this.row || !this.section) return;
      this.section.classList.add('mm-sticky-enabled');
      document.documentElement.classList.add('mm-sticky-header-on');
      this.spacer = ensureSpacer(this.row, 'mm-sticky-spacer');
      neutralizeEllaSticky(this.section);
      this.measure();
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onResize, { passive: true });
      this.onScroll();
    }

    stop() {
      this.unpin();
      this.section?.classList.remove('mm-sticky-enabled', 'mm-header-is-pinned');
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('resize', this.onResize);
    }

    measure() {
      if (this.pinned) return;
      const rect = this.row.getBoundingClientRect();
      this.pinY = Math.max(0, window.scrollY + rect.top);
    }

    onResize() {
      const wasPinned = this.pinned;
      if (wasPinned) this.unpin();
      this.measure();
      if (wasPinned || window.scrollY >= this.pinY) this.pin();
    }

    onScroll() {
      if (!this.enabled) return;
      if (window.scrollY >= this.pinY) this.pin();
      else this.unpin();
    }

    pin() {
      if (this.pinned || !this.row) return;
      this.spacer = ensureSpacer(this.row, 'mm-sticky-spacer') || this.spacer;
      // Reserve layout space from the pre-pin height so content does not jump.
      const height = Math.max(
        1,
        Math.ceil(this.row.getBoundingClientRect().height || this.row.offsetHeight || 0)
      );
      if (this.spacer) {
        this.spacer.style.cssText = `display:block;height:${height}px;min-height:${height}px;flex:0 0 ${height}px;width:100%;pointer-events:none;`;
        this.spacer.classList.add('is-active');
      }
      this.row.classList.add('is-pinned');
      this.section.classList.add('mm-header-is-pinned');
      // After pin, CSS may soft-compact the bar — use the visible height for scroll-padding.
      const pinnedHeight = Math.max(
        1,
        Math.ceil(this.row.getBoundingClientRect().height || height)
      );
      document.documentElement.style.setProperty('--mm-sticky-height', `${pinnedHeight}px`);
      this.pinned = true;
    }

    unpin() {
      if (!this.pinned) return;
      this.row.classList.remove('is-pinned');
      this.section.classList.remove('mm-header-is-pinned');
      if (this.spacer) {
        this.spacer.style.cssText = 'display:block;height:0px;min-height:0;flex:0 0 0px;width:100%;pointer-events:none;';
        this.spacer.classList.remove('is-active');
      }
      this.pinned = false;
      this.measure();
    }
  }

  let desktopCtrl = null;
  let mobileCtrl = null;

  function initDesktop() {
    desktopCtrl?.stop();
    desktopCtrl = null;
    const host = document.querySelector('sticky-header[data-sticky-type]');
    const section = document.querySelector('.section-header-navigation');
    if (!stickyEnabled(host) || !section) {
      section?.classList.remove('mm-sticky-enabled', 'mm-header-is-pinned');
      return;
    }
    const container = section.querySelector('.header-nav-hamburger--style1 > .container, .header-nav-hamburger > .container');
    const row = ensureDesktopMainRow(container);
    if (!row) return;
    desktopCtrl = new MmPinController({ section, row, enabled: true });
    desktopCtrl.start();
  }

  function initMobile() {
    mobileCtrl?.stop();
    mobileCtrl = null;
    const host = document.querySelector('sticky-header-mobile[data-sticky-type]');
    const section = document.querySelector('.section-header-mobile');
    if (!stickyEnabled(host) || !section) {
      section?.classList.remove('mm-sticky-enabled', 'mm-header-is-pinned');
      return;
    }
    const row = section.querySelector('.header-mobile__wrapper, .header-mobile--wrapper');
    if (!row) return;
    mobileCtrl = new MmPinController({ section, row, enabled: true });
    mobileCtrl.start();
  }

  function patchEllaSticky() {
    const patch = (Ctor) => {
      if (!Ctor || Ctor.prototype.__mmStickyPatched) return;
      const proto = Ctor.prototype;
      proto.__mmStickyPatched = true;
      proto.onScroll = function mmNoopScroll() {};
      proto.hide = function mmNoopHide() {};
      proto.reveal = function mmNoopReveal() {};
      proto.reset = function mmNoopReset() {
        neutralizeEllaSticky(this.header);
      };
      proto.checkLoadPosition = function mmNoopCheck() {};
    };
    patch(customElements.get('sticky-header'));
    patch(customElements.get('sticky-header-mobile'));
  }

  function init() {
    patchEllaSticky();
    if (DESKTOP_MQ.matches) {
      initDesktop();
      mobileCtrl?.stop();
      mobileCtrl = null;
      document.querySelector('.section-header-mobile')?.classList.remove('mm-sticky-enabled', 'mm-header-is-pinned');
    } else {
      initMobile();
      desktopCtrl?.stop();
      desktopCtrl = null;
      document.querySelector('.section-header-navigation')?.classList.remove('mm-sticky-enabled', 'mm-header-is-pinned');
    }
    if (!document.querySelector('sticky-header[data-sticky-type], sticky-header-mobile[data-sticky-type]')) {
      document.documentElement.classList.remove('mm-sticky-header-on');
    }
  }

  function boot() {
    init();
    // Ella defines custom elements in section {% javascript %} which may run after us
    window.setTimeout(init, 0);
    window.setTimeout(patchEllaSticky, 50);
    window.setTimeout(patchEllaSticky, 300);
  }

  function syncCartBadges() {
    document.querySelectorAll('.header__icon--cart .cart-count-bubble [data-cart-count], .header-mobile .cart-count-bubble [data-cart-count]').forEach((el) => {
      const raw = String(el.textContent || '').trim();
      const count = Number.parseInt(raw, 10);
      const empty = !Number.isFinite(count) || count <= 0;
      const bubble = el.closest('.cart-count-bubble');
      if (!bubble) return;
      bubble.classList.toggle('is-empty', empty);
      if (empty) bubble.setAttribute('hidden', '');
      else bubble.removeAttribute('hidden');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  DESKTOP_MQ.addEventListener('change', init);
  document.addEventListener('shopify:section:load', () => window.setTimeout(init, 50));
  document.addEventListener('cart:updated', syncCartBadges);
  window.addEventListener('load', () => {
    patchEllaSticky();
    desktopCtrl?.measure();
    mobileCtrl?.measure();
    desktopCtrl?.onScroll();
    mobileCtrl?.onScroll();
    syncCartBadges();
  });

  // Keep empty badge hidden when Ella updates [data-cart-count] text only
  const cartObserver = new MutationObserver(syncCartBadges);
  function observeCartCounts() {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      cartObserver.observe(el, { characterData: true, childList: true, subtree: true });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeCartCounts);
  } else {
    observeCartCounts();
  }
})();
