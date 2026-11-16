/**
 * MOTHER & ME — product card add-to-cart (MM Products section only).
 * Handles loading / success / error without nested click traps.
 * Hover motion is CSS-only; this script never forces hover on touch.
 */
(function () {
  'use strict';

  var SUCCESS_MS = 1600;
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  function labelEl(btn) {
    return btn.querySelector('.mm-product-card__btn-label') || btn;
  }

  function setBusy(btn, busy, text) {
    btn.classList.toggle('is-loading', busy);
    btn.disabled = busy;
    btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (busy) {
      btn.setAttribute('aria-disabled', 'true');
    } else {
      btn.removeAttribute('aria-disabled');
    }
    if (text != null) labelEl(btn).textContent = text;
  }

  function showError(card, message) {
    var err = card.querySelector('[data-mm-card-error]');
    if (!err) return;
    err.hidden = false;
    err.classList.add('is-visible');
    err.textContent = message;
  }

  function clearError(card) {
    var err = card.querySelector('[data-mm-card-error]');
    if (!err) return;
    err.hidden = true;
    err.classList.remove('is-visible');
    err.textContent = '';
  }

  function refreshCartUI() {
    try {
      if (typeof window.Shopify !== 'undefined' && typeof window.Shopify.getCart === 'function') {
        window.Shopify.getCart(function (cart) {
          if (!cart) return;
          var count = cart.item_count;
          document.querySelectorAll('[data-cart-count]').forEach(function (el) {
            el.textContent = count >= 100 && window.cartStrings && window.cartStrings.item_99
              ? window.cartStrings.item_99
              : String(count);
          });
          if (window.halo && typeof window.halo.updateSidebarCart === 'function') {
            window.halo.updateSidebarCart(cart);
          }
          document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: cart } }));
        });
        return;
      }
    } catch (e) { /* fall through */ }

    fetch(root + 'cart.js', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        document.querySelectorAll('[data-cart-count]').forEach(function (el) {
          el.textContent = String(cart.item_count);
        });
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: cart } }));
      })
      .catch(function () {});
  }

  function addToCart(form, btn) {
    var card = btn.closest('.mm-product-card');
    if (!card || btn.disabled || btn.classList.contains('is-loading')) return;

    var addLabel = btn.getAttribute('data-label-add') || labelEl(btn).textContent;
    var addingLabel = btn.getAttribute('data-label-adding') || addLabel;
    var addedLabel = btn.getAttribute('data-label-added') || addLabel;
    var errorLabel = btn.getAttribute('data-label-error') || 'Error';

    clearError(card);
    setBusy(btn, true, addingLabel);

    var body = new FormData(form);

    fetch(root + 'cart/add.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      body: body
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || result.data.status || result.data.message === 'Cart Error') {
          var msg =
            (result.data && (result.data.description || result.data.message)) ||
            errorLabel;
          throw new Error(msg);
        }

        /* Success only after confirmed Shopify response */
        btn.classList.remove('is-loading');
        btn.classList.add('is-success');
        labelEl(btn).textContent = addedLabel;
        btn.disabled = true;

        refreshCartUI();

        window.setTimeout(function () {
          btn.classList.remove('is-success');
          setBusy(btn, false, addLabel);
        }, SUCCESS_MS);
      })
      .catch(function (err) {
        setBusy(btn, false, addLabel);
        btn.classList.remove('is-success');
        showError(card, (err && err.message) || errorLabel);
      });
  }

  function onSubmit(event) {
    var form = event.target.closest('[data-mm-product-form]');
    if (!form || !event.target.closest('.mm-products')) return;

    event.preventDefault();
    event.stopPropagation();

    var btn = form.querySelector('[data-mm-add-to-cart]');
    if (!btn) return;
    addToCart(form, btn);
  }

  function init() {
    document.addEventListener('submit', onSubmit, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
