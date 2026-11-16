/**
 * MOTHER & ME — compact mobile sticky buy bar.
 * Proxies the main PDP ATC (#product-add-to-cart); no second cart logic.
 */
(function () {
  'use strict';

  const MQ = window.matchMedia('(max-width: 749px)');
  const OVERLAY_CLASSES = [
    'cart-sidebar-show',
    'menu_open',
    'open_search_mobile',
    'auth-sidebar-show',
    'show-mobile-options',
    'quickshop-popup-show',
    'quick_shop_popup_mobile',
    'term-condition-show',
  ];

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function initMmStickyBuybar() {
    const bar = document.querySelector('[data-mm-sticky-buybar]');
    if (!bar) return;

    const priceEl = bar.querySelector('[data-mm-sticky-price]');
    const btn = bar.querySelector('[data-mm-sticky-atc]');
    const labelEl = bar.querySelector('[data-mm-sticky-label]');
    if (!btn || !priceEl || !labelEl) return;

    let mainBtn = null;
    let mainObserver = null;
    let mainVisible = true;
    let syncTimer = null;

    function getMainBtn() {
      return document.getElementById('product-add-to-cart');
    }

    function getMainForm() {
      const b = getMainBtn();
      return b ? b.closest('form') : null;
    }

    function getPriceSource() {
      const form = getMainForm();
      const root = form ? form.closest('.productView, .product-details, main') || document : document;
      return (
        root.querySelector('.productView-price .price-item--sale') ||
        root.querySelector('.productView-price .price-item--regular') ||
        root.querySelector('.productView-price .price__regular .price-item') ||
        root.querySelector('.productView-price .money') ||
        root.querySelector('[id^="product-price-"] .price-item--sale') ||
        root.querySelector('[id^="product-price-"] .price-item--regular') ||
        root.querySelector('[id^="product-price-"]')
      );
    }

    function getVariantPicker() {
      return (
        document.querySelector('variant-radios') ||
        document.querySelector('variant-selects') ||
        document.querySelector('.productView-variants') ||
        document.querySelector('.productView-options') ||
        document.querySelector('[data-product-option]')
      );
    }

    function needsVariantSelection() {
      const form = getMainForm();
      if (!form) return false;

      const idInput = form.querySelector('input[name="id"]');
      if (!idInput || !String(idInput.value || '').trim()) return true;

      // Incomplete option groups (radios without checked, empty selects)
      const fieldsets = document.querySelectorAll('variant-radios fieldset, .product-form__input');
      for (const fs of fieldsets) {
        const radios = fs.querySelectorAll('input[type="radio"]');
        if (radios.length && ![...radios].some((r) => r.checked)) return true;
        const select = fs.querySelector('select');
        if (select && (!select.value || select.selectedIndex <= 0 && select.options[0]?.disabled)) {
          // only flag if select has no usable value
          if (!select.value) return true;
        }
      }

      const selects = document.querySelectorAll('variant-selects select');
      for (const select of selects) {
        if (!select.value) return true;
      }

      return false;
    }

    function overlayOpen() {
      return OVERLAY_CLASSES.some((c) => document.body.classList.contains(c));
    }

    function toolbarOffset() {
      const toolbar = document.querySelector('.halo-sticky-toolbar-mobile');
      if (!toolbar) return 0;
      const style = window.getComputedStyle(toolbar);
      if (style.display === 'none' || style.visibility === 'hidden') return 0;
      return toolbar.getBoundingClientRect().height || 0;
    }

    function updateBottomOffset() {
      const offset = toolbarOffset();
      bar.style.bottom = offset ? `${offset}px` : '0px';
      const h = Math.ceil(bar.getBoundingClientRect().height || 72);
      document.documentElement.style.setProperty('--mm-sticky-buybar-height', `${h}px`);
      document.documentElement.style.setProperty('--mm-sticky-toolbar-height', `${Math.ceil(offset)}px`);
    }

    function syncFromMain() {
      mainBtn = getMainBtn();
      if (!mainBtn) return;

      const soldOut = mainBtn.disabled && /sold|გაყიდ|ausverkauft|распрод/i.test(mainBtn.textContent || '');
      const disabled = mainBtn.disabled;
      const loading = mainBtn.classList.contains('is-loading');

      btn.disabled = disabled;
      btn.classList.toggle('is-soldout', disabled);
      btn.classList.toggle('is-loading', loading);
      btn.setAttribute('aria-busy', loading ? 'true' : 'false');

      const mainText = (mainBtn.textContent || '').replace(/\s+/g, ' ').trim();
      if (mainText) {
        labelEl.textContent = mainText;
      }

      const priceSource = getPriceSource();
      if (priceSource) {
        const text = (priceSource.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) priceEl.textContent = text;
      }
    }

    function shouldShow() {
      if (!MQ.matches) return false;
      if (overlayOpen()) return false;
      if (!getMainBtn()) return false;
      // Show only when main ATC has scrolled out above the viewport
      return !mainVisible;
    }

    function applyVisibility() {
      const show = shouldShow();
      if (show) {
        bar.hidden = false;
        bar.setAttribute('aria-hidden', 'false');
        // next frame for transition
        window.requestAnimationFrame(() => {
          updateBottomOffset();
          bar.classList.add('is-visible');
          document.body.classList.add('mm-sticky-buybar-open');
        });
      } else {
        bar.classList.remove('is-visible');
        document.body.classList.remove('mm-sticky-buybar-open');
        window.setTimeout(() => {
          if (!shouldShow()) {
            bar.hidden = true;
            bar.setAttribute('aria-hidden', 'true');
          }
        }, 240);
      }
    }

    function observeMain() {
      if (mainObserver) {
        mainObserver.disconnect();
        mainObserver = null;
      }
      mainBtn = getMainBtn();
      if (!mainBtn || typeof IntersectionObserver === 'undefined') {
        // Fallback: treat as not visible when scrolled past
        mainVisible = true;
        return;
      }

      mainObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          const rect = entry.boundingClientRect;
          if (entry.isIntersecting) {
            // Normal ATC visible again → hide sticky bar
            mainVisible = true;
          } else if (rect.bottom <= 0) {
            // ATC scrolled out upward → show sticky bar
            mainVisible = false;
          } else {
            // ATC still below the fold → keep sticky bar hidden
            mainVisible = true;
          }
          applyVisibility();
        },
        { root: null, threshold: 0, rootMargin: '0px' }
      );
      mainObserver.observe(mainBtn);
    }

    function scrollToVariants() {
      const target = getVariantPicker();
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.pageYOffset - 88;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      const focusable = target.querySelector('input, select, button, [tabindex]:not([tabindex="-1"])');
      if (focusable && typeof focusable.focus === 'function') {
        window.setTimeout(() => focusable.focus({ preventScroll: true }), 350);
      }
    }

    btn.addEventListener('click', function onStickyAtc(event) {
      event.preventDefault();
      event.stopPropagation();

      if (btn.disabled || btn.classList.contains('is-loading')) return;

      if (needsVariantSelection()) {
        scrollToVariants();
        return;
      }

      mainBtn = getMainBtn();
      if (!mainBtn || mainBtn.disabled) {
        if (mainBtn && mainBtn.disabled) syncFromMain();
        else scrollToVariants();
        return;
      }

      // Use the existing purchase action on the main product form
      mainBtn.click();
    });

    const bodyObserver = new MutationObserver(() => {
      applyVisibility();
      syncFromMain();
    });
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Watch main ATC attributes/text for sold-out / loading / label sync
    const attrObserver = new MutationObserver(() => {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(syncFromMain, 40);
    });

    function watchMainBtn() {
      mainBtn = getMainBtn();
      if (!mainBtn) return;
      attrObserver.disconnect();
      attrObserver.observe(mainBtn, {
        attributes: true,
        attributeFilter: ['disabled', 'class', 'data-available'],
        childList: true,
        characterData: true,
        subtree: true,
      });
      const priceRoot = document.querySelector('[id^="product-price-"], .productView-price');
      if (priceRoot) {
        attrObserver.observe(priceRoot, { childList: true, characterData: true, subtree: true });
      }
    }

    function onMqChange() {
      if (!MQ.matches) {
        mainVisible = true;
        applyVisibility();
        if (mainObserver) mainObserver.disconnect();
        return;
      }
      watchMainBtn();
      observeMain();
      syncFromMain();
      applyVisibility();
    }

    window.addEventListener(
      'resize',
      () => {
        if (bar.classList.contains('is-visible')) updateBottomOffset();
      },
      { passive: true }
    );

    // Variants / cart events may replace price markup
    document.addEventListener('variant:change', syncFromMain);
    document.addEventListener('cart-update', syncFromMain);

    if (typeof MQ.addEventListener === 'function') {
      MQ.addEventListener('change', onMqChange);
    } else if (typeof MQ.addListener === 'function') {
      MQ.addListener(onMqChange);
    }

    // Init after layout (sticky header / toolbar)
    window.setTimeout(() => {
      onMqChange();
    }, 100);
  });
})();
