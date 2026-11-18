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
    root.querySelectorAll('.menu-lv-1.is-open, .menu-lv-1.is-hidden, .menu-lv-1.d-none').forEach((item) => {
      item.classList.remove('is-open', 'is-hidden', 'd-none');
      const trigger = item.querySelector(':scope > a.menu_mobile_link, :scope > .mm-cat-item__row .mm-cat-toggle');
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
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-hidden', 'false');
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

  function ensureMobileToggle(item) {
    if (!item || item.dataset.mmMobileToggle === '1') return;
    const submenu = item.querySelector(':scope > .header__submenu, :scope > .list-menu--disclosure-1');
    let anchor = item.querySelector(':scope > a.menu_mobile_link, :scope > a.menu-lv-1__action');
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
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-haspopup', 'true');
      const title = (anchor.textContent || '').trim();
      toggle.setAttribute('aria-label', `${title} — ქვემენიუს გახსნა`);
      toggle.innerHTML =
        '<svg class="mm-cat-toggle__icon" width="12" height="8" viewBox="0 0 12 8" aria-hidden="true" focusable="false"><path d="M1 1.5L6 6.5L11 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      row.appendChild(toggle);
    }

    /* Hide Ella caret inside the link — toggle button owns expand. */
    const icon = anchor.querySelector('.icon-dropdown');
    if (icon) icon.setAttribute('hidden', '');

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      const willOpen = !item.classList.contains('is-open');
      item.classList.remove('is-hidden', 'd-none');
      item.classList.toggle('is-open', willOpen);
      toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      const title = (anchor.textContent || '').trim();
      toggle.setAttribute(
        'aria-label',
        willOpen ? `${title} — ქვემენიუს დახურვა` : `${title} — ქვემენიუს გახსნა`
      );
    });

    item.dataset.mmMobileToggle = '1';
  }

  function enhanceMobileToggles() {
    const root = drawer();
    if (!root) return;
    root.querySelectorAll('.menu-lv-1.dropdown').forEach(ensureMobileToggle);
  }

  /*
   * Block Ella/theme.js from treating the parent category link as "expand only".
   * Expand happens via .mm-cat-toggle; the link navigates.
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
        return;
      }
      const trigger = event.target.closest('#navigation-mobile .menu_mobile_link');
      if (!trigger) return;
      if (trigger.classList.contains('list-menu__item--end')) return;
      const parent = trigger.closest('.menu-lv-1.dropdown, .menu-lv-2.dropdown');
      if (!parent) return;
      /* Allow navigation to the parent collection URL. */
    },
    true
  );

  /* Stop theme.js expand-on-link handler for parents that have our toggle. */
  document.addEventListener(
    'click',
    (event) => {
      if (!MQ.matches) return;
      const trigger = event.target.closest(
        '#navigation-mobile .menu-lv-1.dropdown[data-mm-mobile-toggle="1"] > .mm-cat-item__row > a.menu_mobile_link'
      );
      if (!trigger) return;
      /* Do not preventDefault — navigation should proceed. Stop theme expand. */
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

  function init() {
    const btn = toggleBtn();
    if (btn) syncToggleAria();
    const closeBtns = document.querySelectorAll('#navigation-mobile [data-menu-close-sidebar]');
    closeBtns.forEach((el) => {
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'დახურვა');
    });
    wasOpen = isOpen();
    bodyObserver.disconnect();
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (wasOpen) onOpened();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', init);
})();
