(() => {
  const rootSelector = '[data-mm-availability]';

  function readI18n() {
    const node = document.querySelector('[data-mm-availability-i18n]');
    if (!node) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (e) {
      return null;
    }
  }

  function resolveStatus(variant, productId, flags = {}) {
    if (flags.unavailable || !variant) return 'out_of_stock';
    if (flags.soldOut || variant.available === false) return 'out_of_stock';

    const qtyMap = window[`product_inven_array_${productId}`] || {};
    const policyMap = window[`selling_array_${productId}`] || {};
    const qty = parseInt(qtyMap[variant.id], 10);
    const policy = policyMap[variant.id];

    if (variant.inventory_management == null || variant.inventory_management === '') {
      return 'in_stock';
    }

    if (!Number.isNaN(qty) && qty > 0) {
      return 'in_stock';
    }

    // Explicit Shopify continue-selling / pre-order setup only
    if (variant.available && (Number.isNaN(qty) || qty <= 0) && policy === 'continue') {
      return 'preorder';
    }

    return 'out_of_stock';
  }

  function applyStatus(el, status, i18n) {
    if (!el || !i18n) return;
    const label = i18n[status] || i18n.out_of_stock;
    const text = el.querySelector('[data-mm-availability-text]');
    const dot = el.querySelector('[data-mm-availability-dot]');
    const prev = el.getAttribute('data-status');

    el.setAttribute('data-status', status);
    if (text) text.textContent = label;
    if (dot) {
      if (status === 'in_stock') {
        dot.classList.add('is-visible');
      } else {
        dot.classList.remove('is-visible');
      }
    }

    // aria-live announces when text changes; avoid noise on identical updates
    if (prev === status && text && text.textContent === label) return;
  }

  window.mmUpdateProductAvailability = function mmUpdateProductAvailability(options = {}) {
    const productId = options.productId;
    if (!productId) return;

    const el = document.querySelector(`${rootSelector}[data-product-id="${productId}"]`);
    if (!el) return;

    const i18n = readI18n();
    if (!i18n) return;

    const status = resolveStatus(options.variant, productId, {
      unavailable: !!options.unavailable,
      soldOut: !!options.soldOut
    });

    applyStatus(el, status, i18n);
  };
})();
