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

  // Zoom / Fancybox only when the media has enough resolution to benefit
  const MIN_ZOOM_EDGE = 900;
  const canZoomMedia = (el) => {
    const img = el.matches('img') ? el : el.querySelector('img');
    if (!img) return false;
    const w = img.naturalWidth || Number(img.getAttribute('width')) || 0;
    const h = img.naturalHeight || Number(img.getAttribute('height')) || 0;
    return w >= MIN_ZOOM_EDGE || h >= MIN_ZOOM_EDGE;
  };

  const gateZoom = () => {
    gallery.querySelectorAll('[data-fancybox="images"], .productView-iconZoom, .media[data-fancybox]').forEach((el) => {
      const zoomable = canZoomMedia(el);
      el.classList.toggle('mm-zoom-disabled', !zoomable);
      if (!zoomable) {
        if (el.hasAttribute('data-fancybox')) {
          el.setAttribute('data-mm-fancybox-disabled', el.getAttribute('data-fancybox'));
          el.removeAttribute('data-fancybox');
        }
        el.style.cursor = 'default';
        if (el.classList.contains('productView-iconZoom')) {
          el.hidden = true;
          el.setAttribute('aria-hidden', 'true');
        }
      } else {
        const restored = el.getAttribute('data-mm-fancybox-disabled');
        if (restored && !el.hasAttribute('data-fancybox')) {
          el.setAttribute('data-fancybox', restored);
          el.removeAttribute('data-mm-fancybox-disabled');
        }
        if (el.classList.contains('productView-iconZoom')) {
          el.hidden = false;
          el.removeAttribute('aria-hidden');
        }
      }
    });
  };

  // Fancybox: remember focus opener and restore on close; Escape handled by Fancybox
  let lastFocus = null;
  const bindFancyboxFocus = () => {
    gateZoom();
    const openers = gallery.querySelectorAll('[data-fancybox="images"]');
    openers.forEach((el) => {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.getAttribute('role')) el.setAttribute('role', 'button');
      if (el.dataset.mmFancyBound) return;
      el.dataset.mmFancyBound = '1';
      el.addEventListener('click', (event) => {
        if (el.classList.contains('mm-zoom-disabled')) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        lastFocus = el;
      });
      el.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (el.classList.contains('mm-zoom-disabled')) return;
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

  // Keep swipe (Slick touch) and ensure visible prev/next controls on mobile
  const enhanceNavControls = () => {
    if (!main || !window.jQuery) return;
    const $nav = window.jQuery(main);
    if (!$nav.length || !$nav.hasClass('slick-initialized') || typeof $nav.slick !== 'function') return;

    if (mediaCount > 1) {
      try {
        $nav.slick('slickSetOption', 'arrows', true, true);
        $nav.slick('slickSetOption', 'swipe', true, false);
        $nav.slick('slickSetOption', 'touchMove', true, false);
      } catch (e) {
        /* ignore */
      }
    }

    const prevLabel =
      gallery.getAttribute('data-mm-gallery-prev') ||
      (window.accessibilityStrings && window.accessibilityStrings.previous) ||
      'წინა';
    const nextLabel =
      gallery.getAttribute('data-mm-gallery-next') ||
      (window.accessibilityStrings && window.accessibilityStrings.next) ||
      'შემდეგი';

    gallery.querySelectorAll('.productView-nav .slick-prev').forEach((btn) => {
      btn.setAttribute('aria-label', prevLabel);
      btn.setAttribute('type', 'button');
    });
    gallery.querySelectorAll('.productView-nav .slick-next').forEach((btn) => {
      btn.setAttribute('aria-label', nextLabel);
      btn.setAttribute('type', 'button');
    });
  };

  const hideEmptySlides = () => {
    gallery.querySelectorAll('.productView-image').forEach((slide) => {
      const hasMedia =
        slide.querySelector('img[src], img[data-src], video, iframe, .media--video, model-viewer');
      slide.classList.toggle('mm-media-empty', !hasMedia);
      if (!hasMedia) slide.setAttribute('aria-hidden', 'true');
    });
  };

  const boot = () => {
    stopAutoplay();
    enhanceThumbs();
    bindFancyboxFocus();
    enhanceCounter();
    enhanceNavControls();
    hideEmptySlides();
    gallery.querySelectorAll('img').forEach((img) => {
      if (img.complete) gateZoom();
      else img.addEventListener('load', gateZoom, { once: true });
    });
  };

  boot();
  // Theme inits Slick asynchronously
  setTimeout(boot, 400);
  setTimeout(boot, 1200);

  if (window.jQuery && main) {
    window.jQuery(main).on('init reInit afterChange', () => {
      stopAutoplay();
      enhanceCounter();
      enhanceNavControls();
      enhanceThumbs();
      hideEmptySlides();
      gateZoom();
    });
  }

  // Preserve variant → media: variants.js already clicks [data-media-id]; no override
})();
