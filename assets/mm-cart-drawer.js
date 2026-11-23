/**
 * MOTHER & ME — cart drawer a11y, race-safe qty updates, checkout gate.
 * Uses existing Shopify cart change/remove APIs; does not replace checkout.
 */
(function () {
  'use strict';

  const DRAWER_ID = 'halo-cart-sidebar';
  const OPEN_CLASS = 'cart-sidebar-show';
  const UPDATING_CLASS = 'mm-cart-updating';
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let lastActiveElement = null;
  let scrollY = 0;
  let previouslyPatched = false;
  let requestSeq = 0;
  let lastAppliedSeq = 0;
  /** @type {Map<string, number>} */
  const pendingByLine = new Map();
  let inFlight = 0;
  let lastItemRow = null;

  function drawer() {
    return document.getElementById(DRAWER_ID);
  }

  function isOpen() {
    return document.body.classList.contains(OPEN_CLASS);
  }

  function announce(message) {
    const live =
      document.getElementById('cart-live-region-text') ||
      document.getElementById('mm-cart-drawer-live');
    if (!live || !message) return;
    live.textContent = '';
    window.requestAnimationFrame(() => {
      live.textContent = message;
    });
  }

  function syncUpdatingUi() {
    const el = drawer();
    const busy = inFlight > 0 || pendingByLine.size > 0;
    if (el) {
      el.classList.toggle(UPDATING_CLASS, busy);
      el.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
    document.querySelectorAll('[data-mm-checkout], #cart-sidebar-checkout').forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      if (busy) {
        btn.setAttribute('aria-disabled', 'true');
        btn.classList.add('is-mm-waiting');
      } else {
        btn.removeAttribute('aria-disabled');
        btn.classList.remove('is-mm-waiting');
      }
    });
    if (busy) {
      announce(
        (window.cartStrings && window.cartStrings.mm_updating) ||
          'კალათა ახლდება…'
      );
    }
  }

  function clearItemErrors() {
    const el = drawer();
    if (!el) return;
    el.querySelectorAll('.mm-cart-item-error').forEach((node) => {
      node.hidden = true;
      node.textContent = '';
    });
  }

  function showItemError(message, row) {
    const target = row || lastItemRow;
    if (!target) {
      if (typeof window.showWarning === 'function') window.showWarning(message);
      return;
    }
    let err = target.querySelector('.mm-cart-item-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'mm-cart-item-error';
      err.setAttribute('role', 'alert');
      target.appendChild(err);
    }
    err.textContent = message;
    err.hidden = false;
    err.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function getFocusable(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
      (node) =>
        !node.hasAttribute('disabled') &&
        node.getAttribute('aria-hidden') !== 'true' &&
        node.offsetParent !== null
    );
  }

  function lockScroll() {
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.style.setProperty('--mm-cart-scroll-y', `${scrollY}px`);
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }

  function unlockScroll() {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.removeProperty('--mm-cart-scroll-y');
    window.scrollTo(0, scrollY);
  }

  function onOpen() {
    const el = drawer();
    if (!el) return;
    if (window.mmA11yOverlays) window.mmA11yOverlays.closeOthers('cart');
    document.dispatchEvent(new CustomEvent('mm:overlay-open', { detail: { which: 'cart' } }));
    lastActiveElement = document.activeElement;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-hidden', 'false');
    if (!el.getAttribute('aria-label')) {
      const title = el.querySelector('.halo-sidebar-header .title');
      if (title) el.setAttribute('aria-label', title.textContent.trim());
    }
    const closeBtn = el.querySelector('[data-close-cart-sidebar]');
    if (closeBtn && !closeBtn.getAttribute('aria-label')) {
      closeBtn.setAttribute('aria-label', 'დახურვა');
    }
    if (!document.getElementById('mm-cart-drawer-live')) {
      const live = document.createElement('p');
      live.id = 'mm-cart-drawer-live';
      live.className = 'visually-hidden';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('role', 'status');
      el.prepend(live);
    }
    lockScroll();
    window.requestAnimationFrame(() => {
      (closeBtn || getFocusable(el)[0] || el).focus();
    });
  }

  function onClose() {
    const el = drawer();
    if (el) el.setAttribute('aria-hidden', 'true');
    unlockScroll();
    clearItemErrors();
    document.dispatchEvent(new CustomEvent('mm:overlay-close', { detail: { which: 'cart' } }));
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
    lastActiveElement = null;
  }

  function closeDrawer() {
    if (!isOpen()) return;
    document.body.classList.remove(OPEN_CLASS);
  }

  function handleKeydown(event) {
    if (!isOpen()) return;
    const el = drawer();
    if (!el) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }

    if (event.key !== 'Tab') return;
    const nodes = getFocusable(el);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function findItemRow(from) {
    return from && from.closest ? from.closest('.previewCartItem') : null;
  }

  function lineKey(index) {
    return String(index);
  }

  function flushPending(callback) {
    if (!pendingByLine.size) {
      syncUpdatingUi();
      return;
    }
    // Process one pending line at a time (latest qty wins per line).
    const entry = pendingByLine.entries().next().value;
    if (!entry) return;
    const [key, quantity] = entry;
    pendingByLine.delete(key);
    mmFetchUpdate(Number(key), quantity, callback, lastItemRow);
  }

  function mmFetchUpdate(line, quantity, callback, itemRow) {
    const routes = window.routes || {};
    const changeUrl = routes.cart_change_url || '/cart/change.js';
    const seq = ++requestSeq;
    const body = JSON.stringify({
      line: line,
      quantity: quantity,
      sections_url: window.location.pathname,
    });
    const config =
      typeof window.fetchConfig === 'function'
        ? window.fetchConfig()
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          };

    inFlight += 1;
    syncUpdatingUi();
    if (itemRow) lastItemRow = itemRow;
    clearItemErrors();

    fetch(changeUrl, Object.assign({}, config, { body: body }))
      .then((response) => response.text())
      .then((state) => {
        const parsedState = JSON.parse(state);
        inFlight = Math.max(0, inFlight - 1);

        if (parsedState.errors) {
          const message =
            typeof parsedState.errors === 'string'
              ? parsedState.errors
              : (window.cartStrings && window.cartStrings.error) || String(parsedState.errors);
          showItemError(message, itemRow);
          syncUpdatingUi();
          flushPending(callback);
          return;
        }

        // Stale responses must not overwrite newer applied state in the UI.
        if (seq < lastAppliedSeq) {
          syncUpdatingUi();
          flushPending(callback);
          return;
        }
        lastAppliedSeq = seq;

        if (typeof callback === 'function') {
          callback(parsedState);
        } else if (typeof Shopify.onCartUpdate === 'function') {
          Shopify.onCartUpdate(parsedState);
        }

        syncUpdatingUi();
        flushPending(callback);
      })
      .catch((e) => {
        console.error(e);
        inFlight = Math.max(0, inFlight - 1);
        showItemError(
          (window.cartStrings && window.cartStrings.error) ||
            'კალათის განახლებისას მოხდა შეცდომა. სცადეთ თავიდან.'
        );
        syncUpdatingUi();
        flushPending(callback);
      });
  }

  function queueOrSend(line, quantity, callback, itemRow) {
    const key = lineKey(line);
    if (inFlight > 0) {
      pendingByLine.set(key, quantity);
      syncUpdatingUi();
      return;
    }
    mmFetchUpdate(line, quantity, callback, itemRow);
  }

  function patchCartMutations() {
    if (previouslyPatched || !window.Shopify) return;
    previouslyPatched = true;

    const origChange = Shopify.changeItem;
    const origRemove = Shopify.removeItem;

    Shopify.changeItem = function (variant_id, quantity, index, callback) {
      if (!isOpen()) {
        return origChange.call(this, variant_id, quantity, index, callback);
      }
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
        showItemError(
          (window.cartStrings && window.cartStrings.quantityError) ||
            (window.cartStrings && window.cartStrings.error) ||
            'Invalid quantity'
        );
        return;
      }
      queueOrSend(index, qty, callback, lastItemRow);
    };

    Shopify.removeItem = function (variant_id, index, callback) {
      if (!isOpen()) {
        return origRemove.call(this, variant_id, index, callback);
      }
      queueOrSend(index, 0, callback, lastItemRow);
    };
  }

  function waitForIdle() {
    return new Promise((resolve) => {
      const tick = () => {
        if (inFlight === 0 && pendingByLine.size === 0) {
          resolve();
          return;
        }
        window.setTimeout(tick, 50);
      };
      tick();
    });
  }

  function bindCheckoutGate() {
    document.addEventListener(
      'click',
      (event) => {
        const btn = event.target.closest('#cart-sidebar-checkout, [data-mm-checkout]');
        if (!btn) return;
        if (!isOpen() && !btn.closest('#halo-cart-sidebar')) return;

        event.preventDefault();
        event.stopPropagation();

        if (btn.hasAttribute('disabled')) return;

        const href = btn.getAttribute('data-href') || '/checkout';
        const go = () => {
          window.location = href;
        };

        if (inFlight > 0 || pendingByLine.size > 0) {
          announce(
            (window.cartStrings && window.cartStrings.mm_checkout_wait) ||
              'გთხოვთ, დაელოდოთ კალათის განახლებას'
          );
          waitForIdle().then(go);
          return;
        }
        go();
      },
      true
    );
  }

  function bindItemActionTracking() {
    document.addEventListener(
      'click',
      (event) => {
        if (!isOpen()) return;
        const row = findItemRow(event.target);
        if (!row) return;
        if (
          event.target.closest('[data-cart-remove]') ||
          event.target.closest('.btn-quantity') ||
          event.target.closest('[data-cart-quantity]')
        ) {
          lastItemRow = row;
        }
      },
      true
    );

    document.addEventListener(
      'change',
      (event) => {
        if (!isOpen()) return;
        if (!event.target.matches('[data-cart-quantity]')) return;
        lastItemRow = findItemRow(event.target);
      },
      true
    );
  }

  function observeBodyClass() {
    let wasOpen = isOpen();
    if (wasOpen) onOpen();

    const observer = new MutationObserver(() => {
      const open = isOpen();
      if (open && !wasOpen) onOpen();
      if (!open && wasOpen) onClose();
      wasOpen = open;
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function syncPreviewPad() {
    const hasBar = !!(
      window.Shopify?.designMode ||
      document.getElementById('PBarNextFrameWrapper') ||
      document.getElementById('PreviewBarButton') ||
      document.querySelector('iframe#PBarNextFrame') ||
      document.querySelector('[data-preview-bar]')
    );
    document.body.classList.toggle('mm-theme-preview', hasBar);
  }

  function init() {
    patchCartMutations();
    bindItemActionTracking();
    bindCheckoutGate();
    observeBodyClass();
    document.addEventListener('keydown', handleKeydown);
    syncPreviewPad();
    window.setTimeout(syncPreviewPad, 800);

    document.addEventListener('cart-update', () => {
      inFlight = 0;
      pendingByLine.clear();
      syncUpdatingUi();
      clearItemErrors();
    });

    window.mmCartBusy = {
      isBusy: () => inFlight > 0 || pendingByLine.size > 0,
      waitForIdle,
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
