(() => {
  const root = document.querySelector('[data-mm-filters]');
  if (!root) return;

  const openBtn = root.querySelector('[data-mm-filters-open]');
  const closeBtns = root.querySelectorAll('[data-mm-filters-close]');
  const overlay = root.querySelector('[data-mm-filters-overlay]');
  const panel = root.querySelector('[data-mm-filters-panel]');
  const desktopForm = root.querySelector('[data-mm-filters-desktop-form]');
  const panelForm = root.querySelector('[data-mm-filters-panel-form]');
  const sortSelects = root.querySelectorAll('[data-mm-filters-sort]');

  let lastFocus = null;

  const setOpen = (open) => {
    root.classList.toggle('is-panel-open', open);
    if (panel) {
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    if (openBtn) {
      openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (open) {
      lastFocus = document.activeElement;
      const closeBtn = root.querySelector('.mm-filters__panel-close');
      if (closeBtn) closeBtn.focus();
    } else if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
    }
  };

  if (openBtn) {
    openBtn.addEventListener('click', () => setOpen(true));
  }

  closeBtns.forEach((btn) => {
    btn.addEventListener('click', () => setOpen(false));
  });

  if (overlay) {
    overlay.addEventListener('click', () => setOpen(false));
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.classList.contains('is-panel-open')) {
      setOpen(false);
    }
  });

  const prepareForm = (form) => {
    if (!form) return;
    form.querySelectorAll('.mm-filters__price-input').forEach((input) => {
      if (!input.value || !String(input.value).trim()) {
        input.disabled = true;
      }
    });
  };

  const submitNearestForm = (el) => {
    const form = el.closest('form');
    if (!form) return;
    prepareForm(form);
    if (form.requestSubmit) form.requestSubmit();
    else form.submit();
  };

  [desktopForm, panelForm].forEach((form) => {
    if (!form) return;
    form.addEventListener('submit', () => prepareForm(form));
  });

  if (desktopForm) {
    desktopForm.addEventListener('change', (event) => {
      const target = event.target;
      if (!target) return;
      if (target.matches('input[type="checkbox"], input[type="radio"], select[data-mm-filters-sort]')) {
        submitNearestForm(target);
      }
    });

    desktopForm.querySelectorAll('.mm-filters__price-input').forEach((input) => {
      input.addEventListener('change', () => submitNearestForm(input));
    });
  }

  sortSelects.forEach((select) => {
    select.addEventListener('change', () => {
      const form = select.closest('form');
      if (!form) return;
      // Keep filter fields; only sort changes
      if (form === panelForm) return; // panel uses Apply
      submitNearestForm(select);
    });
  });
})();
