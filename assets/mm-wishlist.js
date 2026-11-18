/**
 * MOTHER & ME — single wishlist controller (localStorage key: wishlistItem).
 * Owns click handling so theme.js cannot double-toggle. Syncs every visible control.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'wishlistItem';
  var syncTimer = null;

  function readRaw() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function normalizeList(raw) {
    var list = Array.isArray(raw) ? raw : [];
    var out = [];
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var handle = '';
      if (typeof item === 'string') handle = item;
      else if (item && typeof item === 'object' && item.handle) handle = String(item.handle);
      handle = (handle || '').trim();
      if (!handle || seen[handle]) continue;
      seen[handle] = true;
      out.push(handle);
    }
    return out;
  }

  function writeList(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  function getList() {
    return normalizeList(readRaw());
  }

  function labelsFor(btn, on) {
    var add =
      btn.getAttribute('data-mm-wl-add') ||
      (window.wishlist && window.wishlist.add) ||
      btn.getAttribute('title') ||
      '';
    var remove =
      btn.getAttribute('data-mm-wl-remove') ||
      (window.wishlist && window.wishlist.remove) ||
      add;
    return on ? remove : add;
  }

  function syncButtons(list) {
    document.querySelectorAll('[data-wishlist][data-wishlist-handle]').forEach(function (btn) {
      var handle = btn.getAttribute('data-wishlist-handle');
      var on = list.indexOf(handle) !== -1;
      btn.classList.toggle('wishlist-added', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var label = labelsFor(btn, on);
      if (label) {
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
        var text = btn.querySelector('.text');
        if (text) text.textContent = label;
      }
    });

    document.querySelectorAll('[data-wishlist-count]').forEach(function (el) {
      el.textContent = String(list.length);
      var bubble = el.closest('.wishlist-count-bubble');
      if (bubble) {
        if (list.length) bubble.removeAttribute('hidden');
        else bubble.setAttribute('hidden', '');
      }
    });
  }

  function scheduleSync() {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(function () {
      var list = getList();
      writeList(list);
      syncButtons(list);
    }, 40);
  }

  function onClick(event) {
    var btn = event.target.closest('[data-wishlist][data-wishlist-handle]');
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

    var handle = btn.getAttribute('data-wishlist-handle');
    var id = btn.getAttribute('data-product-id');
    var list = getList();
    var idx = list.indexOf(handle);
    var adding = idx === -1;

    if (adding) list.push(handle);
    else list.splice(idx, 1);

    if (!writeList(list)) {
      /* Storage blocked — do not pretend success */
      syncButtons(getList());
      return;
    }

    syncButtons(list);

    if (adding) {
      btn.classList.add('is-animating');
      window.setTimeout(function () {
        btn.classList.remove('is-animating');
      }, 280);
      document.dispatchEvent(
        new CustomEvent('addwishlistitem', { detail: { handle: handle }, bubbles: true })
      );
    } else {
      var card = document.querySelector('[data-wishlist-added="wishlist-' + id + '"]');
      if (card) {
        var product = card.closest ? card.closest('.product') : null;
        if (product) product.remove();
        else card.remove();
      }
      document.dispatchEvent(new CustomEvent('updatepagination', { bubbles: true }));
    }

    document.dispatchEvent(new CustomEvent('updatewishlistmail', { bubbles: true }));

    var wishlistContainer = document.querySelector('[data-wishlist-container]');
    if (wishlistContainer && list.length === 0 && window.wishlist) {
      wishlistContainer.classList.add('is-empty');
      var emptyText = window.wishlist.empty || '';
      var continueText = window.wishlist.continue_shopping || '';
      var continueUrl =
        (window.routes && window.routes.collection_all) || '/collections/all';
      wishlistContainer.innerHTML =
        '<div class="wishlist-content-empty text-center">' +
        '<span class="wishlist-content-text">' +
        emptyText +
        '</span>' +
        '<div class="wishlist-content-actions">' +
        '<a class="button button-2 button-continue" href="' +
        continueUrl +
        '">' +
        continueText +
        '</a></div></div>';
      var footer = document.querySelector('[data-wishlist-footer]');
      if (footer) footer.style.display = 'none';
    }
  }

  function init() {
    var list = getList();
    writeList(list);
    syncButtons(list);

    document.addEventListener('click', onClick, true);
    document.addEventListener('shopify:section:load', scheduleSync);
    document.addEventListener('mm:collection:updated', scheduleSync);
    document.addEventListener('mm:filters:updated', scheduleSync);
    document.addEventListener('addwishlistitem', scheduleSync);
    document.addEventListener('updatepagination', scheduleSync);
    window.addEventListener('load', scheduleSync);
    window.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY) scheduleSync();
    });

    /* Re-sync after theme.js paints wishlist classes from the same storage key. */
    window.setTimeout(scheduleSync, 120);
    window.setTimeout(scheduleSync, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.mmWishlist = {
    getList: getList,
    sync: function () {
      syncButtons(getList());
    }
  };
})();
