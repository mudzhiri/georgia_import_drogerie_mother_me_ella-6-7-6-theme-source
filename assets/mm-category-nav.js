(() => {
  const DESKTOP_MQ = window.matchMedia('(min-width: 1025px)');

  function rootNav() {
    return document.querySelector('.header-nav-hamburger--style1 .main-menu [data-navigation]');
  }

  function closeAll(except) {
    document.querySelectorAll('.header-nav-hamburger--style1 .main-menu .menu-lv-1.dropdown.is-open').forEach((item) => {
      if (except && item === except) return;
      item.classList.remove('is-open');
      const trigger = item.querySelector(':scope > a.menu-lv-1__action');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  }

  function enhance() {
    const nav = rootNav();
    if (!nav || nav.dataset.mmCatNav === '1') return;
    nav.dataset.mmCatNav = '1';

    nav.querySelectorAll('.menu-lv-1.dropdown').forEach((item) => {
      const trigger = item.querySelector(':scope > a.menu-lv-1__action');
      if (!trigger) return;
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', item.classList.contains('is-open') ? 'true' : 'false');

      const toggle = (event) => {
        if (!DESKTOP_MQ.matches) return;
        if (!item.querySelector(':scope > .header__submenu')) return;
        event.preventDefault();
        event.stopPropagation();
        const open = item.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) closeAll(item);
      };
      trigger.addEventListener('click', toggle, true);

      trigger.addEventListener('keydown', (event) => {
        if (!DESKTOP_MQ.matches) return;
        if (event.key === 'Escape') {
          closeAll();
          trigger.focus();
          return;
        }
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
          if (!item.querySelector(':scope > .header__submenu')) return;
          event.preventDefault();
          item.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
          closeAll(item);
          const first = item.querySelector('.header__submenu a');
          if (first) first.focus();
        }
      });
    });

    document.addEventListener('click', (event) => {
      if (!DESKTOP_MQ.matches) return;
      const navEl = rootNav();
      if (!navEl) return;
      if (!navEl.contains(event.target)) closeAll();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance);
  } else {
    enhance();
  }

  document.addEventListener('shopify:section:load', enhance);
})();
