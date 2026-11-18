/**
 * MOTHER & ME — native share / copy-link for [data-mm-share].
 * Strips theme preview params from shared URLs.
 */
(function () {
  'use strict';

  function publicUrl(raw) {
    try {
      var u = new URL(raw, window.location.origin);
      ['preview_theme_id', 'pb', '_ab', 'view', 'oseid', 'key'].forEach(function (k) {
        u.searchParams.delete(k);
      });
      var q = u.searchParams.toString();
      return u.origin + u.pathname + (q ? '?' + q : '');
    } catch (e) {
      return raw;
    }
  }

  function copyLink(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url);
    }
    return new Promise(function (resolve, reject) {
      try {
        var input = document.createElement('input');
        input.value = url;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  function showToast(btn, message) {
    var root = btn.closest('.mm-pdp-title-share-wrap, [data-mm-pdp-actions], .mm-card-actions') || btn.parentElement;
    var toast = root && root.querySelector('[data-mm-share-toast]');
    if (!toast) return;
    toast.textContent = message || '';
    toast.hidden = false;
    window.clearTimeout(toast._mmTimer);
    toast._mmTimer = window.setTimeout(function () {
      toast.hidden = true;
    }, 2200);
  }

  function markCopied(btn, message) {
    btn.classList.add('is-copied');
    if (message) {
      btn.setAttribute('aria-label', message);
      btn.setAttribute('title', message);
      showToast(btn, message);
    }
    window.setTimeout(function () {
      btn.classList.remove('is-copied');
      var label = btn.getAttribute('data-mm-share-label');
      if (label) {
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
      }
    }, 1800);
  }

  function onClick(event) {
    var btn = event.target.closest('[data-mm-share]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    if (!btn.getAttribute('data-mm-share-label')) {
      btn.setAttribute(
        'data-mm-share-label',
        btn.getAttribute('aria-label') || btn.getAttribute('title') || ''
      );
    }
    var url = publicUrl(btn.getAttribute('data-mm-share-url') || window.location.href);
    var title = btn.getAttribute('data-mm-share-title') || document.title;
    var copied = btn.getAttribute('data-mm-share-copied') || 'Copied';

    var run = navigator.share
      ? navigator.share({ title: title, url: url })
      : copyLink(url).then(function () {
          markCopied(btn, copied);
        });

    Promise.resolve(run).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      copyLink(url)
        .then(function () {
          markCopied(btn, copied);
        })
        .catch(function () {
          /* do not fake success */
        });
    });
  }

  function init() {
    document.addEventListener('click', onClick, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
