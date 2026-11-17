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
      const trigger = item.querySelector(':scope > a.menu_mobile_link, :scope > a.menu-lv-1__action');
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

  // Accordion: toggle submenu in place (blocks Ella drill-down)
  document.addEventListener(
    'click',
    (event) => {
      if (!MQ.matches) return;
      const trigger = event.target.closest('#navigation-mobile .menu_mobile_link');
      if (!trigger) return;
      if (trigger.classList.contains('list-menu__item--end')) return;
      const parent = trigger.closest('.menu-lv-1, .menu-lv-2');
      if (!parent || !parent.classList.contains('dropdown')) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const willOpen = !parent.classList.contains('is-open');
      parent.classList.remove('is-hidden', 'd-none');
      parent.classList.toggle('is-open', willOpen);
      trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      trigger.setAttribute('aria-haspopup', 'true');
    },
    true
  );

  // Escape closes drawer
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

  // Keep close via overlay (theme already binds); ensure Escape/focus still work
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
