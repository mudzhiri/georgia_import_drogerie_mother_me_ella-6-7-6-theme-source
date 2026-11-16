(() => {
  const root = document.querySelector('[data-mm-footer]');
  if (!root) return;

  const panels = root.querySelectorAll('[data-mm-footer-accordion]');
  if (!panels.length) return;

  const mql = window.matchMedia('(min-width: 900px)');

  const sync = () => {
    panels.forEach((panel) => {
      if (mql.matches) {
        panel.setAttribute('open', '');
        panel.dataset.mmForcedOpen = 'true';
      } else if (panel.dataset.mmForcedOpen === 'true') {
        panel.removeAttribute('open');
        delete panel.dataset.mmForcedOpen;
      }
    });
  };

  sync();

  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', sync);
  } else if (typeof mql.addListener === 'function') {
    mql.addListener(sync);
  }
})();
