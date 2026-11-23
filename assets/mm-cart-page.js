/**
 * MOTHER & ME — cart page: updating state, checkout waits for pending changes.
 * Relies on existing Shopify.changeItem / theme cart handlers.
 */
(function () {
  'use strict';

  const PAGE_SELECTOR = '.template-cart .mm-cart-page, .template-cart [data-cart]';
  const UPDATING_CLASS = 'mm-cart-updating';

  let requestSeq = 0;
  let lastAppliedSeq = 0;
  let inFlight = 0;
  /** @type {Map<string, {quantity: number, callback: Function|undefined, row: Element|null}>} */
  const pendingByLine = new Map();
  let patched = false;
  let lastItemRow = null;

  function pageRoot() {
    return document.querySelector(PAGE_SELECTOR);
  }

  function isCartPage() {
    return document.body.classList.contains('template-cart');
  }

  function announce(message) {
    const live = document.getElementById('cart-live-region-text');
    if (!live || !message) return;
    live.textContent = '';
    window.requestAnimationFrame(() => {
      live.textContent = message;
    });
  }

  function syncUpdatingUi() {
    const root = pageRoot();
    const busy = inFlight > 0 || pendingByLine.size > 0;
    if (root) {
      root.classList.toggle(UPDATING_CLASS, busy);
      root.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
    const checkout = document.getElementById('cart-checkout');
    if (checkout) {
      if (busy) {
        checkout.classList.add('is-mm-waiting');
        checkout.setAttribute('aria-disabled', 'true');
      } else {
        checkout.classList.remove('is-mm-waiting');
        checkout.removeAttribute('aria-disabled');
      }
    }
    if (busy) {
      announce(
        (window.cartStrings && window.cartStrings.mm_updating) || 'კალათა ახლდება…'
      );
    }
  }

  function showRowError(message, row) {
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
  }

  function clearErrors() {
    document.querySelectorAll('.template-cart .mm-cart-item-error').forEach((node) => {
      node.hidden = true;
      node.textContent = '';
    });
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
    clearErrors();

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
          showRowError(message, itemRow);
          syncUpdatingUi();
          flushPending();
          return;
        }

        if (seq < lastAppliedSeq) {
          syncUpdatingUi();
          flushPending();
          return;
        }
        lastAppliedSeq = seq;

        if (typeof callback === 'function') {
          callback(parsedState);
        } else if (typeof Shopify.onCartUpdate === 'function') {
          Shopify.onCartUpdate(parsedState);
        }

        syncUpdatingUi();
        flushPending();
      })
      .catch((e) => {
        console.error(e);
        inFlight = Math.max(0, inFlight - 1);
        showRowError(
          (window.cartStrings && window.cartStrings.error) ||
            'კალათის განახლებისას მოხდა შეცდომა. სცადეთ თავიდან.',
          itemRow
        );
        syncUpdatingUi();
        flushPending();
      });
  }

  function flushPending() {
    if (!pendingByLine.size || inFlight > 0) {
      syncUpdatingUi();
      return;
    }
    const entry = pendingByLine.entries().next().value;
    if (!entry) return;
    const [key, payload] = entry;
    pendingByLine.delete(key);
    mmFetchUpdate(Number(key), payload.quantity, payload.callback, payload.row);
  }

  function queueOrSend(line, quantity, callback, itemRow) {
    const key = String(line);
    if (inFlight > 0) {
      pendingByLine.set(key, { quantity, callback, row: itemRow });
      syncUpdatingUi();
      return;
    }
    mmFetchUpdate(line, quantity, callback, itemRow);
  }

  function drawerOpen() {
    return document.body.classList.contains('cart-sidebar-show');
  }

  function patchShopify() {
    if (patched || !window.Shopify || !isCartPage()) return;
    patched = true;

    const origChange = Shopify.changeItem;
    const origRemove = Shopify.removeItem;

    Shopify.changeItem = function (variant_id, quantity, index, callback) {
      // Drawer owns its own race-safe path while open.
      if (drawerOpen()) {
        return origChange.call(this, variant_id, quantity, index, callback);
      }
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
        showRowError(
          (window.cartStrings && window.cartStrings.quantityError) ||
            (window.cartStrings && window.cartStrings.error) ||
            'Invalid quantity'
        );
        return;
      }
      queueOrSend(index, qty, callback, lastItemRow);
    };

    Shopify.removeItem = function (variant_id, index, callback) {
      if (drawerOpen()) {
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

  function bindTracking() {
    document.addEventListener(
      'click',
      (event) => {
        if (!isCartPage()) return;
        const row = event.target.closest('.cart-item');
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
        if (!isCartPage()) return;
        if (!event.target.matches('[data-cart-quantity]')) return;
        lastItemRow = event.target.closest('.cart-item');
      },
      true
    );
  }

  function bindCheckoutGate() {
    const checkout = document.getElementById('cart-checkout');
    if (!checkout) return;
    let releasing = false;

    checkout.addEventListener(
      'click',
      (event) => {
        if (releasing) return;
        if (inFlight === 0 && pendingByLine.size === 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        announce(
          (window.cartStrings && window.cartStrings.mm_checkout_wait) ||
            'გთხოვთ, დაელოდოთ კალათის განახლებას'
        );
        waitForIdle().then(() => {
          releasing = true;
          checkout.click();
          releasing = false;
        });
      },
      true
    );
  }

  function init() {
    if (!isCartPage()) return;
    patchShopify();
    bindTracking();
    bindCheckoutGate();

    document.addEventListener('cart-update', () => {
      inFlight = 0;
      pendingByLine.clear();
      syncUpdatingUi();
      clearErrors();
    });

    window.mmCartPageBusy = {
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
