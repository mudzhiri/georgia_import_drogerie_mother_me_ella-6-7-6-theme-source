(() => {
  const gallery = document.querySelector('[data-image-gallery]');
  if (!gallery) return;

  gallery.classList.add('mm-product-gallery');

  const main = gallery.querySelector('[data-image-gallery-main]');
  const mediaCount = Number(
    main?.getAttribute('data-media-count') ||
      gallery.querySelectorAll('.productView-image').length ||
      0
  );
  gallery.setAttribute('data-mm-media-count', String(mediaCount));

  // No autoplay: keep theme slick without starting autoplay if present
  const stopAutoplay = () => {
    if (!window.jQuery) return;
    const $nav = window.jQuery(main);
    if ($nav.length && $nav.hasClass('slick-initialized') && typeof $nav.slick === 'function') {
      try {
        $nav.slick('slickSetOption', 'autoplay', false, false);
        $nav.slick('slickPause');
      } catch (e) {
        /* ignore */
      }
    }
  };

  // First image eager; later lazy already handled in Liquid — reinforce
  gallery.querySelectorAll('.productView-image img[data-main-image]').forEach((img, index) => {
    if (index === 0) {
      img.setAttribute('loading', 'eager');
      img.setAttribute('fetchpriority', 'high');
      img.removeAttribute('data-src');
    } else if (!img.getAttribute('loading')) {
      img.setAttribute('loading', 'lazy');
    }
  });

  // Make thumbs keyboard-activatable without breaking Slick click
  const enhanceThumbs = () => {
    gallery.querySelectorAll('.productView-thumbnail').forEach((thumb, index) => {
      const link = thumb.querySelector('.productView-thumbnail-link');
      if (!link) return;
      if (!link.hasAttribute('tabindex')) link.setAttribute('tabindex', '0');
      if (!link.getAttribute('role')) link.setAttribute('role', 'button');
      const label =
        link.getAttribute('aria-label') ||
        thumb.getAttribute('aria-label') ||
        `Image ${index + 1}`;
      link.setAttribute('aria-label', label);

      if (link.dataset.mmThumbBound) return;
      link.dataset.mmThumbBound = '1';
      link.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          link.click();
        }
      });
    });
  };

  // Fancybox: remember focus opener and restore on close; Escape handled by Fancybox
  let lastFocus = null;
  const bindFancyboxFocus = () => {
    const openers = gallery.querySelectorAll('[data-fancybox="images"]');
    openers.forEach((el) => {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.getAttribute('role')) el.setAttribute('role', 'button');
      if (el.dataset.mmFancyBound) return;
      el.dataset.mmFancyBound = '1';
      el.addEventListener('click', () => {
        lastFocus = el;
      });
      el.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          lastFocus = el;
          el.click();
        }
      });
    });

    if (window.jQuery && window.jQuery.fancybox && !document.documentElement.dataset.mmFancyFocus) {
      document.documentElement.dataset.mmFancyFocus = '1';
      window.jQuery(document).on('afterClose.fb', () => {
        if (lastFocus && typeof lastFocus.focus === 'function') {
          lastFocus.focus();
        }
      });
    }
  };

  // Mobile counter already injected by theme; ensure aria-live for updates
  const enhanceCounter = () => {
    const counter = gallery.querySelector('.slick-counter');
    if (!counter) return;
    counter.setAttribute('role', 'status');
    counter.setAttribute('aria-live', 'polite');
  };

  const boot = () => {
    stopAutoplay();
    enhanceThumbs();
    bindFancyboxFocus();
    enhanceCounter();
  };

  boot();
  // Theme inits Slick asynchronously
  setTimeout(boot, 400);
  setTimeout(boot, 1200);

  if (window.jQuery && main) {
    window.jQuery(main).on('init reInit afterChange', () => {
      stopAutoplay();
      enhanceCounter();
      enhanceThumbs();
    });
  }

  // Preserve variant → media: variants.js already clicks [data-media-id]; no override
})();
