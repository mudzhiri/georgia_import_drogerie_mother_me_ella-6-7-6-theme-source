/**
 * MOTHER & ME — shared add-to-cart error helpers.
 * Extends existing ATC flows; does not create a second cart pipeline.
 */
(function () {
  'use strict';

  function strings() {
    return window.mmAtcErrorStrings || {};
  }

  function isTechnical(value) {
    if (value == null) return true;
    var text = String(value).trim();
    if (!text) return true;
    if (/^(cart error|error)$/i.test(text)) return true;
    if (/^\s*[\[{]/.test(text)) return true;
    if (/graphql|cannot find variant|invalid id|undefined|null/i.test(text)) return true;
    return false;
  }

  function isInventoryRelated(value) {
    return /sold out|not enough|insufficient|inventory|stock|quantity|can't add more|cannot add|nur noch|ausverkauft|bestand|недостаточно|нет в наличии|არ არის|მარაგ|რაოდენობ/i.test(
      String(value || '')
    );
  }

  function ensureHost(button) {
    if (!button || !button.closest) return null;
    var scope =
      button.closest('.productView-action') ||
      button.closest('.product-form__buttons') ||
      button.closest('.card-action') ||
      button.closest('.mm-collection-atc-wrap') ||
      button.closest('product-form') ||
      button.parentElement;
    if (!scope) return null;

    var host = scope.querySelector('[data-mm-atc-error]');
    if (host) return host;

    host = document.createElement('div');
    host.className = 'mm-atc-error';
    host.setAttribute('data-mm-atc-error', '');
    host.setAttribute('role', 'alert');
    host.setAttribute('aria-live', 'assertive');
    host.setAttribute('aria-atomic', 'true');
    host.hidden = true;

    var buttons = scope.querySelector('.product-form__buttons');
    if (buttons && buttons.parentElement === scope) {
      buttons.insertAdjacentElement('afterend', host);
    } else {
      scope.appendChild(host);
    }
    return host;
  }

  function successHost(button) {
    if (!button || !button.closest) return null;
    var scope =
      button.closest('.productView-action') ||
      button.closest('.product-form__buttons') ||
      button.closest('product-form') ||
      button.parentElement;
    if (!scope) return null;
    return scope.querySelector('[data-mm-atc-success]');
  }

  function clear(button) {
    var host = ensureHost(button);
    if (host) {
      host.hidden = true;
      host.classList.remove('is-visible');
      host.textContent = '';
    }
    var ok = successHost(button);
    if (ok) {
      ok.hidden = true;
      ok.textContent = '';
    }
  }

  function show(button, message) {
    var host = ensureHost(button);
    if (!host) return;
    var ok = successHost(button);
    if (ok) {
      ok.hidden = true;
      ok.textContent = '';
    }
    var text = String(message || strings().generic || '').trim();
    if (!text) text = strings().generic || '';
    host.textContent = text;
    host.hidden = false;
    host.classList.add('is-visible');
  }

  function showSuccess(button, message) {
    clear(button);
    var ok = successHost(button);
    if (!ok) return;
    var text = String(
      message ||
        ok.getAttribute('data-mm-atc-success-message') ||
        (strings().success || '')
    ).trim();
    if (!text) return;
    ok.textContent = text;
    ok.hidden = false;
  }

  function mapResponse(data) {
    var i18n = strings();
    if (!data || typeof data !== 'object') return i18n.generic;

    var desc = data.description;
    if (Array.isArray(data.errors)) {
      desc = desc || data.errors.filter(Boolean).join(' ');
    } else if (typeof data.errors === 'string') {
      desc = desc || data.errors;
    }

    var msg = data.message;

    if (!isTechnical(desc)) {
      return isInventoryRelated(desc) ? i18n.inventory || desc : desc;
    }

    if (!isTechnical(msg) && !/^cart error$/i.test(String(msg))) {
      return isInventoryRelated(msg) ? i18n.inventory || msg : msg;
    }

    if (isInventoryRelated(desc) || isInventoryRelated(msg) || data.status === 422) {
      return i18n.inventory || i18n.generic;
    }

    return i18n.generic;
  }

  function mapCaught(error) {
    var i18n = strings();
    if (!error) return i18n.generic;

    if (error.type === 'network' || error.name === 'TypeError' || error.name === 'NetworkError') {
      return i18n.network || i18n.generic;
    }

    if (error.data) return mapResponse(error.data);

    var message = error.message || error;
    if (message && typeof message === 'object') {
      return mapResponse(message);
    }

    if (isTechnical(message)) return i18n.generic;
    if (isInventoryRelated(message)) return i18n.inventory || message;
    return String(message);
  }

  function releaseButton(button) {
    if (!button) return;
    button.classList.remove('is-loading', 'loading');
    button.removeAttribute('aria-busy');
    if (button.getAttribute('data-mm-keep-disabled') === 'true') return;
    if (button.classList.contains('is-soldout') || button.classList.contains('is-notify-me')) return;
    button.removeAttribute('disabled');
    button.disabled = false;
  }

  window.mmAtcError = {
    ensureHost: ensureHost,
    clear: clear,
    show: show,
    showSuccess: showSuccess,
    mapResponse: mapResponse,
    mapCaught: mapCaught,
    releaseButton: releaseButton,
    isInventoryRelated: isInventoryRelated,
    isTechnical: isTechnical
  };

  /* Block double-submit while ATC is in flight (capture before theme handler). */
  document.addEventListener(
    'click',
    function (event) {
      var btn = event.target && event.target.closest && event.target.closest('[data-btn-addtocart]');
      if (!btn) return;
      if (btn.disabled || btn.classList.contains('is-soldout') || btn.classList.contains('is-notify-me')) {
        return;
      }
      if (btn.classList.contains('is-loading') || btn.getAttribute('aria-busy') === 'true') {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        return;
      }
      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');
    },
    true
  );
})();

