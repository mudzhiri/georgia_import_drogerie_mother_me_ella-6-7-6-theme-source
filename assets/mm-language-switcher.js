(() => {
  const SELECTOR = '[data-mm-lang]';

  function closeAll(except) {
    document.querySelectorAll(SELECTOR).forEach((root) => {
      if (except && root === except) return;
      const trigger = root.querySelector('[data-mm-lang-trigger]');
      const dropdown = root.querySelector('[data-mm-lang-dropdown]');
      if (!trigger || !dropdown) return;
      trigger.setAttribute('aria-expanded', 'false');
      dropdown.hidden = true;
      root.classList.remove('is-open');
    });
  }

  function open(root) {
    const trigger = root.querySelector('[data-mm-lang-trigger]');
    const dropdown = root.querySelector('[data-mm-lang-dropdown]');
    if (!trigger || !dropdown) return;
    closeAll(root);
    trigger.setAttribute('aria-expanded', 'true');
    dropdown.hidden = false;
    root.classList.add('is-open');
    const current = dropdown.querySelector('.mm-lang__option--current') || dropdown.querySelector('[data-mm-lang-option]');
    current?.focus();
  }

  function toggle(root) {
    const trigger = root.querySelector('[data-mm-lang-trigger]');
    if (!trigger) return;
    if (trigger.getAttribute('aria-expanded') === 'true') {
      closeAll();
      trigger.focus();
    } else {
      open(root);
    }
  }

  function optionsOf(root) {
    return [...root.querySelectorAll('[data-mm-lang-option]')];
  }

  function focusOption(root, index) {
    const opts = optionsOf(root);
    if (!opts.length) return;
    const next = ((index % opts.length) + opts.length) % opts.length;
    opts[next].focus();
  }

  function initRoot(root) {
    if (root.dataset.mmLangReady === '1') return;
    root.dataset.mmLangReady = '1';

    const trigger = root.querySelector('[data-mm-lang-trigger]');
    const dropdown = root.querySelector('[data-mm-lang-dropdown]');
    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggle(root);
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(root);
      } else if (event.key === 'Escape') {
        closeAll();
      }
    });

    function selectLocale(option) {
      if (!option) return;
      const value = option.getAttribute('data-value');
      const input = root.querySelector('[data-mm-lang-input]');
      const form = root.querySelector('form');
      if (!value || !input || !form) return;
      if (value === input.value) {
        closeAll();
        trigger.focus();
        return;
      }
      input.value = value;
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.submit();
      }
    }

    dropdown.addEventListener('keydown', (event) => {
      const opts = optionsOf(root);
      const index = opts.indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAll();
        trigger.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusOption(root, index + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusOption(root, index - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        focusOption(root, 0);
      } else if (event.key === 'End') {
        event.preventDefault();
        focusOption(root, opts.length - 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectLocale(document.activeElement?.closest?.('[data-mm-lang-option]') || opts[index]);
      } else if (event.key === 'Tab') {
        closeAll();
      }
    });

    dropdown.addEventListener('click', (event) => {
      const option = event.target.closest('[data-mm-lang-option]');
      if (!option) return;
      event.preventDefault();
      selectLocale(option);
    });
  }

  function init() {
    document.querySelectorAll(SELECTOR).forEach(initRoot);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest(SELECTOR)) return;
    closeAll();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
