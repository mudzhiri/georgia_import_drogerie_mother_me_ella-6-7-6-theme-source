(() => {
  const MQ = window.matchMedia('(max-width: 1024px)');

  function drawer() {
    return document.getElementById('navigation-mobile');
  }

  function toggleBtn() {
    return document.querySelector('.header-mobile [data-mobile-menu], [data-mobile-menu]');
  }

  function isOpen() {
    return document.body.classList.contains('menu_open');
  }

  function focusableIn(root) {
    if (!root) return [];
    return [...root.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden'
    );
  }

  function resetAccordions() {
    const root = drawer();
    if (!root) return;
    root
      .querySelectorAll(
        '.menu-lv-1.is-open, .menu-lv-2.is-open, .menu-lv-1.is-hidden, .menu-lv-1.d-none, .mm-cat-item__row.is-open'
      )
      .forEach((item) => {
        item.classList.remove('is-open', 'is-hidden', 'd-none');
        const trigger = item.querySelector(
          ':scope > a.menu_mobile_link, :scope > .mm-cat-item__row .mm-cat-toggle, :scope > .mm-cat-toggle'
        );
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
  }

  function syncToggleAria() {
    const btn = toggleBtn();
    if (!btn) return;
    btn.setAttribute('aria-expanded', isOpen() ? 'true' : 'false');
    btn.setAttribute('aria-controls', 'navigation-mobile');
  }

  function onOpened() {
    const root = drawer();
    if (!root) return;
    if (window.mmA11yOverlays) window.mmA11yOverlays.closeOthers('menu');
    document.dispatchEvent(new CustomEvent('mm:overlay-open', { detail: { which: 'menu' } }));
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    syncToggleAria();
    enhanceMobileToggles();
    const closeBtn = root.querySelector('[data-menu-close-sidebar]');
    window.setTimeout(() => {
      (closeBtn || focusableIn(root)[0])?.focus();
    }, 30);
  }

  function onClosed() {
    const root = drawer();
    if (root) {
      root.removeAttribute('aria-modal');
      root.setAttribute('aria-hidden', 'true');
    }
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('touch-action');
    document.dispatchEvent(new CustomEvent('mm:overlay-close', { detail: { which: 'menu' } }));
    resetAccordions();
    syncToggleAria();
    const btn = toggleBtn();
    if (btn) {
      window.setTimeout(() => btn.focus(), 30);
    }
  }

  function closeMenu() {
    if (!isOpen()) return;
    document.body.classList.remove('menu_open');
  }

  const TOGGLE_ICONS_HTML =
    '<span class="mm-cat-toggle__icons" aria-hidden="true">' +
    '<svg class="mm-cat-toggle__icon mm-cat-toggle__icon--plus" width="18" height="18" viewBox="0 0 24 24" focusable="false">' +
    '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>' +
    '<svg class="mm-cat-toggle__icon mm-cat-toggle__icon--minus" width="18" height="18" viewBox="0 0 24 24" focusable="false">' +
    '<path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>' +
    '</span>';

  function syncToggleLabel(toggle, anchor, open) {
    const title = (anchor?.textContent || '').trim();
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute(
      'aria-label',
      open ? `${title} — ქვემენიუს დახურვა` : `${title} — ქვემენიუს გახსნა`
    );
  }

  function ensureMobileToggle(item) {
    if (!item) return;
    const submenu = item.querySelector(
      ':scope > .header__submenu, :scope > .list-menu--disclosure-1, :scope > .list-menu--disclosure-2, :scope > .menu-lv__dropdownmenu'
    );
    let anchor = item.querySelector(
      ':scope > a.menu_mobile_link, :scope > a.menu-lv-1__action, :scope > a.menu-lv-2__action, :scope > .mm-cat-item__row > a'
    );
    if (!submenu || !anchor) return;

    let row = item.querySelector(':scope > .mm-cat-item__row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'mm-cat-item__row';
      anchor.parentNode.insertBefore(row, anchor);
      row.appendChild(anchor);
    }

    let toggle = row.querySelector('.mm-cat-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'mm-cat-toggle';
      toggle.setAttribute('aria-haspopup', 'true');
      syncToggleLabel(toggle, anchor, item.classList.contains('is-open'));
      toggle.innerHTML = TOGGLE_ICONS_HTML;
      row.appendChild(toggle);
    } else if (!toggle.querySelector('.mm-cat-toggle__icon--plus')) {
      toggle.innerHTML = TOGGLE_ICONS_HTML;
      syncToggleLabel(toggle, anchor, item.classList.contains('is-open'));
    }

    /* Hide Ella caret inside the link — toggle button owns expand. */
    const icon = anchor.querySelector('.icon-dropdown');
    if (icon) icon.setAttribute('hidden', '');

    /* Click handled via document capture below — mark as prepared. */
    item.dataset.mmMobileToggle = '1';
  }

  function enhanceMobileToggles() {
    const root = drawer();
    if (!root || !MQ.matches) return;
    root.querySelectorAll('.menu-lv-1.dropdown, .menu-lv-2.dropdown').forEach(ensureMobileToggle);
  }

  function toggleAccordionItem(item, toggle) {
    if (!item || !toggle) return;
    const row = item.querySelector(':scope > .mm-cat-item__row');
    const anchor = row?.querySelector('a') || item.querySelector(':scope > a');
    const willOpen = !item.classList.contains('is-open');
    item.classList.remove('is-hidden', 'd-none');
    item.classList.toggle('is-open', willOpen);
    if (row) row.classList.toggle('is-open', willOpen);
    syncToggleLabel(toggle, anchor, willOpen);
  }

  /*
   * Capture-phase: run accordion here (before Ella), and stop theme.js from
   * treating the toggle / parent link as drill-down.
   * Main header menu is cloned into #navigation-mobile by Ella (mobile_menu=default).
   */
  document.addEventListener(
    'click',
    (event) => {
      if (!MQ.matches) return;
      const toggle = event.target.closest('#navigation-mobile .mm-cat-toggle');
      if (toggle) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        const item = toggle.closest('.menu-lv-1.dropdown, .menu-lv-2.dropdown');
        if (item) {
          if (item.dataset.mmMobileToggle !== '1') ensureMobileToggle(item);
          toggleAccordionItem(item, toggle);
        }
        return;
      }
      const trigger = event.target.closest(
        '#navigation-mobile .menu-lv-1.dropdown > .mm-cat-item__row > a.menu_mobile_link, #navigation-mobile .menu-lv-1.dropdown > a.menu_mobile_link'
      );
      if (!trigger) return;
      /* Allow navigation; stop Ella expand-on-link. */
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    },
    true
  );

  document.addEventListener('keydown', (event) => {
    if (!MQ.matches || !isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key !== 'Tab') return;
    const root = drawer();
    const items = focusableIn(root);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!root.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!MQ.matches || !isOpen()) return;
    if (event.target.closest('.background-overlay') && !event.target.closest('#navigation-mobile')) {
      closeMenu();
    }
  });

  let wasOpen = false;
  const bodyObserver = new MutationObserver(() => {
    const open = isOpen();
    if (open && !wasOpen) onOpened();
    if (!open && wasOpen) onClosed();
    wasOpen = open;
  });

  function watchDrawerMenu() {
    const root = drawer();
    if (!root || root.dataset.mmMenuWatch === '1') return;
    root.dataset.mmMenuWatch = '1';
    const obs = new MutationObserver(() => {
      if (!MQ.matches) return;
      enhanceMobileToggles();
    });
    obs.observe(root, { childList: true, subtree: true });
  }

  function init() {
    const btn = toggleBtn();
    if (btn) syncToggleAria();
    const closeBtns = document.querySelectorAll('#navigation-mobile [data-menu-close-sidebar]');
    closeBtns.forEach((el) => {
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'დახურვა');
    });
    watchDrawerMenu();
    enhanceMobileToggles();
    wasOpen = isOpen();
    bodyObserver.disconnect();
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (wasOpen) onOpened();
  }

  MQ.addEventListener?.('change', () => {
    if (MQ.matches) enhanceMobileToggles();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', init);
})();
