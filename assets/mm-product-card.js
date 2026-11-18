/**
 * MOTHER & ME — product cards: ATC, gallery, wishlist sync helpers.
 * Event-delegated; safe after filters / section reloads (no MutationObserver).
 */
(function () {
  'use strict';

  if (window.__mmProductCardsInit) return;
  window.__mmProductCardsInit = true;

  var SUCCESS_MS = 1600;
  var SWIPE_MIN = 40;
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  function labelEl(btn) {
    return btn.querySelector('.mm-card-atc__label, .mm-product-card__btn-label') || btn;
  }

  function setBusy(btn, busy, text) {
    btn.classList.toggle('is-loading', busy);
    btn.disabled = busy;
    btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (busy) btn.setAttribute('aria-disabled', 'true');
    else btn.removeAttribute('aria-disabled');
    if (text != null) labelEl(btn).textContent = text;
  }

  function showError(scope, message) {
    var err = scope && scope.querySelector('[data-mm-card-error]');
    if (!err) return;
    err.hidden = false;
    err.classList.add('is-visible');
    err.textContent = message;
  }

  function clearError(scope) {
    var err = scope && scope.querySelector('[data-mm-card-error]');
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
            el.textContent =
              count >= 100 && window.cartStrings && window.cartStrings.item_99
                ? window.cartStrings.item_99
                : String(count);
            var bubble = el.closest('.cart-count-bubble');
            if (bubble) {
              bubble.classList.toggle('is-empty', !count);
              if (count) bubble.removeAttribute('hidden');
              else bubble.setAttribute('hidden', '');
            }
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
          var bubble = el.closest('.cart-count-bubble');
          if (bubble) {
            bubble.classList.toggle('is-empty', !cart.item_count);
            if (cart.item_count) bubble.removeAttribute('hidden');
            else bubble.setAttribute('hidden', '');
          }
        });
        if (window.halo && typeof window.halo.updateSidebarCart === 'function') {
          window.halo.updateSidebarCart(cart);
        }
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: cart } }));
      })
      .catch(function () {});
  }

  function addToCart(form, btn) {
    var scope = btn.closest('[data-mm-product-card], .mm-product-card, .mm-collection-card, .mm-card-atc') || form;
    if (btn.disabled || btn.classList.contains('is-loading')) return;

    var addLabel = btn.getAttribute('data-label-add') || labelEl(btn).textContent;
    var addingLabel = btn.getAttribute('data-label-adding') || addLabel;
    var addedLabel = btn.getAttribute('data-label-added') || addLabel;
    var errorLabel = btn.getAttribute('data-label-error') || 'შეცდომა';

    clearError(scope);
    setBusy(btn, true, addingLabel);

    fetch(root + 'cart/add.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      body: new FormData(form)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || result.data.status || result.data.message === 'Cart Error') {
          var apiMsg = result.data && (result.data.description || result.data.message);
          var technical = !apiMsg || /cannot find|cart error|invalid|not found|graphql/i.test(String(apiMsg));
          throw new Error(technical ? errorLabel : apiMsg);
        }

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
        showError(scope, (err && err.message) || errorLabel);
      });
  }

  function onSubmit(event) {
    var form = event.target.closest('[data-mm-product-form]');
    if (!form) return;
    event.preventDefault();
    event.stopPropagation();
    var btn = form.querySelector('[data-mm-add-to-cart]');
    if (!btn) return;
    addToCart(form, btn);
  }

  /* —— Gallery —— */
  function parseImages(gallery) {
    try {
      var raw = gallery.getAttribute('data-mm-images');
      var list = JSON.parse(raw || '[]');
      return Array.isArray(list) ? list.filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function galleryImageEl(gallery) {
    return (
      gallery.querySelector('.mm-card-media__image') ||
      gallery.querySelector('.mm-product-card__image') ||
      gallery.querySelector('img')
    );
  }

  function ensureDots(gallery, count) {
    var dots = gallery.querySelector('[data-mm-gallery-dots]');
    if (!dots) return;
    if (dots.childElementCount === count) return;
    dots.innerHTML = '';
    for (var i = 0; i < count; i++) {
      var d = document.createElement('span');
      d.className = 'mm-card-media__dot' + (i === 0 ? ' is-active' : '');
      dots.appendChild(d);
    }
  }

  function setGalleryIndex(gallery, nextIndex, opts) {
    var images = parseImages(gallery);
    if (images.length < 2) return;
    var idx = ((nextIndex % images.length) + images.length) % images.length;
    var img = galleryImageEl(gallery);
    if (!img) return;

    gallery.setAttribute('data-mm-gallery-index', String(idx));
    img.setAttribute('src', images[idx]);
    img.removeAttribute('srcset');
    img.removeAttribute('data-src');
    img.removeAttribute('data-srcset');
    img.classList.remove('lazyload', 'lazyloading');
    img.classList.add('lazyloaded');

    ensureDots(gallery, images.length);
    var dots = gallery.querySelectorAll('[data-mm-gallery-dots] .mm-card-media__dot');
    dots.forEach(function (dot, i) {
      dot.classList.toggle('is-active', i === idx);
    });

    var status = gallery.querySelector('[data-mm-gallery-status]');
    if (status) status.textContent = (idx + 1) + ' / ' + images.length;

    if (opts && opts.blockClick) {
      gallery.setAttribute('data-mm-swipe-block', '1');
      window.setTimeout(function () {
        gallery.removeAttribute('data-mm-swipe-block');
      }, 350);
    }
  }

  function onGalleryClick(event) {
    var prev = event.target.closest('[data-mm-gallery-prev]');
    var next = event.target.closest('[data-mm-gallery-next]');
    if (!prev && !next) return;
    var gallery = event.target.closest('[data-mm-card-gallery]');
    if (!gallery) return;
    event.preventDefault();
    event.stopPropagation();
    var cur = parseInt(gallery.getAttribute('data-mm-gallery-index') || '0', 10) || 0;
    setGalleryIndex(gallery, prev ? cur - 1 : cur + 1);
  }

  function onMediaLinkClick(event) {
    var gallery = event.target.closest('[data-mm-card-gallery]');
    if (!gallery || gallery.getAttribute('data-mm-swipe-block') !== '1') return;
    if (event.target.closest('a.card-link, a.mm-card-media__link, a.mm-product-card__media')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /* Touch swipe */
  var swipe = { gallery: null, x: 0, y: 0, active: false, locked: null };

  function onTouchStart(event) {
    var gallery = event.target.closest('[data-mm-card-gallery]');
    if (!gallery || !event.touches || event.touches.length !== 1) return;
    if (event.target.closest('.mm-card-wishlist, .mm-card-share, .mm-card-media__nav, .mm-card-atc')) return;
    swipe.gallery = gallery;
    swipe.x = event.touches[0].clientX;
    swipe.y = event.touches[0].clientY;
    swipe.active = true;
    swipe.locked = null;
  }

  function onTouchMove(event) {
    if (!swipe.active || !swipe.gallery || !event.touches || event.touches.length !== 1) return;
    var dx = event.touches[0].clientX - swipe.x;
    var dy = event.touches[0].clientY - swipe.y;
    if (swipe.locked == null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      swipe.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    if (swipe.locked === 'h' && event.cancelable) {
      event.preventDefault();
    }
  }

  function onTouchEnd(event) {
    if (!swipe.active || !swipe.gallery) {
      swipe.active = false;
      return;
    }
    var touch = event.changedTouches && event.changedTouches[0];
    var dx = touch ? touch.clientX - swipe.x : 0;
    var gallery = swipe.gallery;
    var wasH = swipe.locked === 'h';
    swipe.active = false;
    swipe.gallery = null;
    swipe.locked = null;
    if (!wasH || Math.abs(dx) < SWIPE_MIN) return;
    var cur = parseInt(gallery.getAttribute('data-mm-gallery-index') || '0', 10) || 0;
    setGalleryIndex(gallery, dx < 0 ? cur + 1 : cur - 1, { blockClick: true });
  }

  /* Wishlist/share: owned by mm-wishlist.js / mm-share.js (avoid double listeners). */

  function refreshAfterDomChange() {
    document.querySelectorAll('[data-mm-card-gallery]').forEach(function (gallery) {
      var images = parseImages(gallery);
      if (images.length > 1) ensureDots(gallery, images.length);
    });
    if (window.mmWishlist && typeof window.mmWishlist.sync === 'function') {
      window.mmWishlist.sync();
    }
  }

  function onImageError(event) {
    var img = event.target;
    if (!img || img.tagName !== 'IMG') return;
    if (!img.classList.contains('mm-product-card__image') && !img.closest('[data-mm-card-gallery]')) return;
    img.setAttribute('data-mm-broken', '1');
  }

  function init() {
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('click', onGalleryClick, true);
    document.addEventListener('click', onMediaLinkClick, true);
    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    document.addEventListener('error', onImageError, true);
    document.addEventListener('shopify:section:load', refreshAfterDomChange);
    document.addEventListener('mm:collection:updated', refreshAfterDomChange);
    document.addEventListener('mm:filters:updated', refreshAfterDomChange);
    refreshAfterDomChange();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
