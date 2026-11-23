/**
 * MOTHER & ME — special-order form
 * Requires product link OR product name. Builds contact[body] for inbox.
 */
(function () {
  'use strict';

  function trim(value) {
    return (value || '').replace(/^\s+|\s+$/g, '');
  }

  function buildBody(form) {
    var link = trim((form.querySelector('[data-mm-so-product-link]') || {}).value);
    var name = trim((form.querySelector('[data-mm-so-product-name]') || {}).value);
    var qty = trim((form.querySelector('[data-mm-so-quantity]') || {}).value);
    var phone = trim((form.querySelector('[data-mm-so-phone]') || {}).value);
    var message = trim((form.querySelector('[data-mm-so-message]') || {}).value);
    var lines = ['Special order request / პროდუქტის მოთხოვნა', ''];

    if (link) lines.push('Product link: ' + link);
    if (name) lines.push('Product name: ' + name);
    if (qty) lines.push('Quantity: ' + qty);
    if (phone) lines.push('Phone: ' + phone);
    if (message) {
      lines.push('');
      lines.push('Message:');
      lines.push(message);
    }

    lines.push('');
    lines.push('Note: Individual procurement request (not stock checkout).');
    return lines.join('\n');
  }

  function setBusy(form, busy) {
    var btn = form.querySelector('[data-mm-so-submit]');
    var label = form.querySelector('[data-mm-so-submit-label]');
    var loading = form.querySelector('[data-mm-so-submit-loading]');
    if (!btn) return;
    btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    btn.disabled = !!busy;
    if (label) label.hidden = !!busy;
    if (loading) loading.hidden = !busy;
  }

  function clearProductError(form) {
    var group = form.querySelector('[data-mm-so-product-group]');
    var alert = form.querySelector('[data-mm-so-client-error]');
    var link = form.querySelector('[data-mm-so-product-link]');
    var name = form.querySelector('[data-mm-so-product-name]');
    if (group) group.classList.remove('is-invalid');
    if (alert) alert.hidden = true;
    if (link) link.removeAttribute('aria-invalid');
    if (name) name.removeAttribute('aria-invalid');
  }

  function showProductError(form) {
    var group = form.querySelector('[data-mm-so-product-group]');
    var alert = form.querySelector('[data-mm-so-client-error]');
    var link = form.querySelector('[data-mm-so-product-link]');
    var name = form.querySelector('[data-mm-so-product-name]');
    if (group) group.classList.add('is-invalid');
    if (alert) {
      alert.hidden = false;
      try {
        alert.focus();
      } catch (e) {}
    }
    if (link) link.setAttribute('aria-invalid', 'true');
    if (name) name.setAttribute('aria-invalid', 'true');
  }

  function validateProduct(form) {
    var link = trim((form.querySelector('[data-mm-so-product-link]') || {}).value);
    var name = trim((form.querySelector('[data-mm-so-product-name]') || {}).value);
    return !!(link || name);
  }

  function initForm(form) {
    if (!form || form.dataset.mmSoInit === '1') return;
    form.dataset.mmSoInit = '1';

    var link = form.querySelector('[data-mm-so-product-link]');
    var name = form.querySelector('[data-mm-so-product-name]');
    var body = form.querySelector('[data-mm-so-body]');
    var success = form.querySelector('[data-mm-so-success]');

    if (success) {
      try {
        success.focus();
      } catch (e) {}
    }

    function onProductInput() {
      if (validateProduct(form)) clearProductError(form);
    }

    if (link) link.addEventListener('input', onProductInput);
    if (name) name.addEventListener('input', onProductInput);

    form.addEventListener('submit', function (event) {
      clearProductError(form);

      if (!validateProduct(form)) {
        event.preventDefault();
        showProductError(form);
        setBusy(form, false);
        return;
      }

      if (body) body.value = buildBody(form);
      setBusy(form, true);
    });
  }

  function initAll() {
    document.querySelectorAll('[data-mm-so-form]').forEach(initForm);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', function (event) {
    if (!event || !event.target) return;
    event.target.querySelectorAll('[data-mm-so-form]').forEach(initForm);
  });
})();
