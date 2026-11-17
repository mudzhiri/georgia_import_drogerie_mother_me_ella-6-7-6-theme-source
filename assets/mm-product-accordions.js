(() => {
  const root = document.querySelector('[data-mm-product-accordions]');
  if (!root) return;

  const items = Array.from(root.querySelectorAll('details.mm-product-accordions__item'));
  if (!items.length) return;

  const reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) root.setAttribute('data-reduced-motion', 'true');

  items.forEach((item) => {
    const summary = item.querySelector('summary');
    if (summary) {
      summary.setAttribute('aria-expanded', item.open ? 'true' : 'false');
    }

    item.addEventListener('toggle', () => {
      if (summary) summary.setAttribute('aria-expanded', item.open ? 'true' : 'false');
      if (!item.open) return;
      // Mobile: one open panel at a time for clearer scanning
      if (window.matchMedia('(min-width: 900px)').matches) return;
      items.forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });
})();
