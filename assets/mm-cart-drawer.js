/**
 * MOTHER & ME — cart drawer a11y, update locking, per-item errors.
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
  let updating = false;
  let lastItemRow = null;
  let previouslyPatched = false;

  function drawer() {
    return document.getElementById(DRAWER_ID);
  }

  function isOpen() {
    return document.body.classList.contains(OPEN_CLASS);
  }

  function setUpdating(on, row) {
    updating = !!on;
    const el = drawer();
    if (!el) return;
    el.classList.toggle(UPDATING_CLASS, updating);
    el.setAttribute('aria-busy', updating ? 'true' : 'false');
    if (row) lastItemRow = row;
    if (!updating) lastItemRow = null;
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
      (node) => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true' && node.offsetParent !== null
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
    lastActiveElement = document.activeElement;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    if (!el.getAttribute('aria-label')) {
      const title = el.querySelector('.halo-sidebar-header .title');
      if (title) el.setAttribute('aria-label', title.textContent.trim());
    }
    lockScroll();
    const closeBtn = el.querySelector('[data-close-cart-sidebar]');
    window.requestAnimationFrame(() => {
      (closeBtn || getFocusable(el)[0] || el).focus();
    });
  }

  function onClose() {
    unlockScroll();
    setUpdating(false);
    clearItemErrors();
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

  function patchCartMutations() {
    if (previouslyPatched || !window.Shopify) return;
    previouslyPatched = true;

    const routes = window.routes || {};
    const changeUrl = routes.cart_change_url || '/cart/change.js';
    const origChange = Shopify.changeItem;
    const origRemove = Shopify.removeItem;

    function mmFetchUpdate(line, quantity, callback, itemRow) {
      if (isOpen() && updating) return;

      if (isOpen()) {
        clearItemErrors();
        setUpdating(true, itemRow);
      }

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

      fetch(changeUrl, Object.assign({}, config, { body: body }))
        .then((response) => response.text())
        .then((state) => {
          const parsedState = JSON.parse(state);
          if (parsedState.errors) {
            const message =
              typeof parsedState.errors === 'string'
                ? parsedState.errors
                : window.cartStrings && window.cartStrings.error
                  ? window.cartStrings.error
                  : String(parsedState.errors);
            if (isOpen()) {
              showItemError(message, itemRow);
            } else if (typeof window.showWarning === 'function') {
              window.showWarning('Error : ' + message);
            }
            setUpdating(false);
            return;
          }
          if (typeof callback === 'function') {
            callback(parsedState);
          } else if (typeof Shopify.onCartUpdate === 'function') {
            Shopify.onCartUpdate(parsedState);
          }
          // Header count + drawer HTML refresh happen in theme updateSidebarCart complete.
          // Clear lock after a short delay; updateSidebarCart also toggles loading.
          window.setTimeout(() => setUpdating(false), 50);
        })
        .catch((e) => {
          console.error(e);
          if (isOpen()) {
            showItemError(
              (window.cartStrings && window.cartStrings.error) ||
                'There was an error while updating your cart. Please try again.'
            );
          }
          setUpdating(false);
        });
    }

    Shopify.changeItem = function (variant_id, quantity, index, callback) {
      if (!isOpen()) {
        return origChange.call(this, variant_id, quantity, index, callback);
      }
      if (updating) return;
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
        showItemError(
          (window.cartStrings && window.cartStrings.quantityError) ||
            (window.cartStrings && window.cartStrings.error) ||
            'Invalid quantity'
        );
        return;
      }
      mmFetchUpdate(index, qty, callback, lastItemRow);
    };

    Shopify.removeItem = function (variant_id, index, callback) {
      if (!isOpen()) {
        return origRemove.call(this, variant_id, index, callback);
      }
      if (updating) return;
      mmFetchUpdate(index, 0, callback, lastItemRow);
    };
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
          if (updating) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
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
        const row = findItemRow(event.target);
        if (updating) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        lastItemRow = row;
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
    observeBodyClass();
    document.addEventListener('keydown', handleKeydown);
    syncPreviewPad();
    window.setTimeout(syncPreviewPad, 800);

    document.addEventListener('cart-update', () => {
      setUpdating(false);
      clearItemErrors();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
