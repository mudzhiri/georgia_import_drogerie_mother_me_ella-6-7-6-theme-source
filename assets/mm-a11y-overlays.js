/**
 * MOTHER & ME — exclusive overlays + background inert while a modal is open.
 * Coordinates menu / search / cart / filters without replacing their own logic.
 */
(function () {
  'use strict';

  const OVERLAYS = {
    menu: 'menu_open',
    cart: 'cart-sidebar-show',
    search: 'mm-search-open',
    filters: 'mm-filters-open',
  };

  let inertNodes = [];

  function dialogRoots() {
    return [
      document.getElementById('navigation-mobile'),
      document.getElementById('halo-cart-sidebar'),
      document.getElementById('mm-search-panel'),
      document.querySelector('[data-mm-filters-root].is-panel-open, .mm-collection-filters.is-panel-open'),
    ].filter(Boolean);
  }

  function isAnyOpen() {
    return (
      document.body.classList.contains(OVERLAYS.menu) ||
      document.body.classList.contains(OVERLAYS.cart) ||
      document.body.classList.contains(OVERLAYS.search) ||
      document.documentElement.classList.contains(OVERLAYS.search) ||
      !!document.querySelector('.mm-collection-filters.is-panel-open, [data-mm-filters-root].is-panel-open')
    );
  }

  function clearInert() {
    inertNodes.forEach((el) => {
      try {
        el.inert = false;
      } catch (_) {
        el.removeAttribute('inert');
      }
      if (el.getAttribute('aria-hidden') === 'true' && el.dataset.mmA11yAriaHidden === '1') {
        el.removeAttribute('aria-hidden');
        delete el.dataset.mmA11yAriaHidden;
      }
    });
    inertNodes = [];
  }

  function applyInert() {
    clearInert();
    if (!isAnyOpen()) return;

    const keep = new Set();
    dialogRoots().forEach((root) => {
      if (
        (root.id === 'navigation-mobile' && document.body.classList.contains(OVERLAYS.menu)) ||
        (root.id === 'halo-cart-sidebar' && document.body.classList.contains(OVERLAYS.cart)) ||
        (root.id === 'mm-search-panel' &&
          (document.body.classList.contains(OVERLAYS.search) ||
            document.documentElement.classList.contains(OVERLAYS.search))) ||
        (root.classList && root.classList.contains('is-panel-open'))
      ) {
        keep.add(root);
        let p = root.parentElement;
        while (p && p !== document.body) {
          keep.add(p);
          p = p.parentElement;
        }
      }
    });

    Array.from(document.body.children).forEach((child) => {
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'LINK') return;
      if (keep.has(child)) return;
      // Allow preview bar / Shopify chrome
      if (child.id && /PBar|preview/i.test(child.id)) return;
      try {
        child.inert = true;
      } catch (_) {
        child.setAttribute('inert', '');
      }
      if (!child.hasAttribute('aria-hidden')) {
        child.setAttribute('aria-hidden', 'true');
        child.dataset.mmA11yAriaHidden = '1';
      }
      inertNodes.push(child);
    });
  }

  function closeOthers(except) {
    if (except !== 'menu' && document.body.classList.contains(OVERLAYS.menu)) {
      document.body.classList.remove(OVERLAYS.menu);
    }
    if (except !== 'cart' && document.body.classList.contains(OVERLAYS.cart)) {
      document.body.classList.remove(OVERLAYS.cart);
    }
    if (except !== 'search') {
      document.body.classList.remove(OVERLAYS.search);
      document.documentElement.classList.remove(OVERLAYS.search);
      const panel = document.getElementById('mm-search-panel');
      if (panel && panel.classList.contains('is-open')) {
        document.dispatchEvent(new CustomEvent('mm:search-close-request'));
      }
    }
    if (except !== 'filters') {
      document.dispatchEvent(new CustomEvent('mm:filters-close-request'));
    }
  }

  window.mmA11yOverlays = {
    closeOthers,
    syncInert: applyInert,
    clearInert,
  };

  document.addEventListener('mm:overlay-open', (event) => {
    const which = event.detail && event.detail.which;
    if (which) closeOthers(which);
    window.requestAnimationFrame(applyInert);
  });

  document.addEventListener('mm:overlay-close', () => {
    window.requestAnimationFrame(applyInert);
  });

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(applyInert);
  });

  function init() {
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    applyInert();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
