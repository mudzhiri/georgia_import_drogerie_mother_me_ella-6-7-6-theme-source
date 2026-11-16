(() => {
  const DESKTOP_MQ = window.matchMedia('(min-width: 1025px)');
  const CLOSE_DELAY_MS = 180;
  let leaveTimer = null;

  function t(key, fallback) {
    const dict = window.mm_category_nav || {};
    return dict[key] || fallback;
  }

  function rootNav() {
    return document.querySelector('.header-nav-hamburger--style1 .main-menu [data-navigation]');
  }

  function submenuOf(item) {
    return item.querySelector(':scope > .header__submenu');
  }

  function toggleOf(item) {
    return item.querySelector(':scope .mm-cat-toggle');
  }

  function setLinkFocusable(submenu, enabled) {
    if (!submenu) return;
    submenu.querySelectorAll('a, button, [tabindex]').forEach((el) => {
      if (enabled) {
        if (el.dataset.mmPrevTabindex !== undefined) {
          if (el.dataset.mmPrevTabindex === '') el.removeAttribute('tabindex');
          else el.setAttribute('tabindex', el.dataset.mmPrevTabindex);
          delete el.dataset.mmPrevTabindex;
        } else if (el.getAttribute('tabindex') === '-1' && el.matches('a, button')) {
          el.removeAttribute('tabindex');
        }
      } else {
        if (el.dataset.mmPrevTabindex === undefined) {
          el.dataset.mmPrevTabindex = el.hasAttribute('tabindex') ? el.getAttribute('tabindex') : '';
        }
        el.setAttribute('tabindex', '-1');
      }
    });
    submenu.setAttribute('aria-hidden', enabled ? 'false' : 'true');
    if ('inert' in submenu) submenu.inert = !enabled;
  }

  function closeItem(item) {
    if (!item) return;
    item.classList.remove('is-open');
    const toggle = toggleOf(item);
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    setLinkFocusable(submenuOf(item), false);
  }

  function openItem(item) {
    if (!item) return;
    closeAll(item);
    item.classList.add('is-open');
    const toggle = toggleOf(item);
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    setLinkFocusable(submenuOf(item), true);
  }

  function closeAll(except) {
    document
      .querySelectorAll('.header-nav-hamburger--style1 .main-menu .menu-lv-1.dropdown.is-open')
      .forEach((item) => {
        if (except && item === except) return;
        closeItem(item);
      });
  }

  function isLinked(anchor) {
    if (!anchor) return false;
    if (anchor.getAttribute('aria-disabled') === 'true') return false;
    const href = anchor.getAttribute('href');
    return Boolean(href) && href !== '#' && href !== 'javascript:void(0)';
  }

  function ensureToggle(item, anchor, submenu) {
    let toggle = toggleOf(item);
    if (toggle) return toggle;

    let row = item.querySelector(':scope > .mm-cat-item__row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'mm-cat-item__row';
      anchor.parentNode.insertBefore(row, anchor);
      row.appendChild(anchor);
    }

    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mm-cat-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-haspopup', 'true');
    if (!submenu.id) {
      submenu.id = `mm-submenu-${Math.random().toString(36).slice(2, 9)}`;
    }
    toggle.setAttribute('aria-controls', submenu.id);
    const title = (anchor.textContent || '').trim();
    toggle.setAttribute(
      'aria-label',
      t('submenu_expand', 'Open submenu').replace('{{ title }}', title)
    );
    toggle.innerHTML =
      '<svg class="mm-cat-toggle__icon" width="12" height="8" viewBox="0 0 12 8" aria-hidden="true" focusable="false"><path d="M1 1.5L6 6.5L11 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    row.appendChild(toggle);
    return toggle;
  }

  function syncToggleLabel(toggle, open, title) {
    const key = open ? 'submenu_collapse' : 'submenu_expand';
    const fallback = open ? 'Close submenu' : 'Open submenu';
    toggle.setAttribute('aria-label', t(key, fallback).replace('{{ title }}', title));
  }

  function enhanceItem(item) {
    if (item.dataset.mmCatItem === '1') return;
    const submenu = submenuOf(item);
    const anchor = item.querySelector(':scope > a.menu-lv-1__action, :scope > .mm-cat-item__row > a.menu-lv-1__action');
    if (!submenu || !anchor) return;
    item.dataset.mmCatItem = '1';
    item.classList.add('mm-cat-item');

    const title = (anchor.textContent || '').trim();
    const linked = isLinked(anchor);
    const toggle = ensureToggle(item, anchor, submenu);
    setLinkFocusable(submenu, false);

    const setOpen = (open) => {
      if (open) openItem(item);
      else closeItem(item);
      syncToggleLabel(toggle, open, title);
    };

    toggle.addEventListener('click', (event) => {
      if (!DESKTOP_MQ.matches) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(!item.classList.contains('is-open'));
    });

    toggle.addEventListener('keydown', (event) => {
      if (!DESKTOP_MQ.matches) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(!item.classList.contains('is-open'));
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true);
        const first = submenu.querySelector('a:not([tabindex="-1"])');
        if (first) first.focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        toggle.focus();
      }
    });

    // Linked category stays navigable; unlinked label toggles the panel.
    if (!linked) {
      anchor.addEventListener('click', (event) => {
        if (!DESKTOP_MQ.matches) return;
        event.preventDefault();
        setOpen(!item.classList.contains('is-open'));
      });
      anchor.addEventListener('keydown', (event) => {
        if (!DESKTOP_MQ.matches) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setOpen(!item.classList.contains('is-open'));
        }
      });
    }

    item.addEventListener('mouseenter', () => {
      if (!DESKTOP_MQ.matches) return;
      clearTimeout(leaveTimer);
      setOpen(true);
    });

    item.addEventListener('mouseleave', () => {
      if (!DESKTOP_MQ.matches) return;
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        if (!item.contains(document.activeElement)) setOpen(false);
      }, CLOSE_DELAY_MS);
    });

    submenu.addEventListener('keydown', (event) => {
      if (!DESKTOP_MQ.matches) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        toggle.focus();
      }
    });
  }

  function enhance() {
    const nav = rootNav();
    if (!nav) return;

    nav.querySelectorAll('.menu-lv-1.dropdown').forEach(enhanceItem);

    if (nav.dataset.mmCatNav === '1') return;
    nav.dataset.mmCatNav = '1';

    document.addEventListener('click', (event) => {
      if (!DESKTOP_MQ.matches) return;
      const navEl = rootNav();
      if (!navEl) return;
      if (!navEl.contains(event.target)) closeAll();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !DESKTOP_MQ.matches) return;
      const openItemEl = document.querySelector(
        '.header-nav-hamburger--style1 .main-menu .menu-lv-1.dropdown.is-open'
      );
      if (!openItemEl) return;
      const toggle = toggleOf(openItemEl);
      closeItem(openItemEl);
      if (toggle) toggle.focus();
    });

    DESKTOP_MQ.addEventListener('change', () => {
      if (!DESKTOP_MQ.matches) closeAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance);
  } else {
    enhance();
  }

  document.addEventListener('shopify:section:load', () => {
    const nav = rootNav();
    if (nav) delete nav.dataset.mmCatNav;
    document.querySelectorAll('.menu-lv-1.dropdown[data-mm-cat-item]').forEach((el) => {
      delete el.dataset.mmCatItem;
    });
    enhance();
  });
})();
