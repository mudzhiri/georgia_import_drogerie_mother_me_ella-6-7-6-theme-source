(() => {
  const gallery = document.querySelector('[data-image-gallery]');
  if (!gallery || gallery.dataset.mmGalleryInit === '1') return;
  gallery.dataset.mmGalleryInit = '1';
  gallery.classList.add('mm-product-gallery');

  const main = gallery.querySelector('[data-image-gallery-main]');
  const mediaCount = Number(
    main?.getAttribute('data-media-count') ||
      gallery.querySelectorAll('.productView-image:not(.slick-cloned)').length ||
      gallery.querySelectorAll('.productView-image').length ||
      0
  );
  gallery.setAttribute('data-mm-media-count', String(mediaCount));

  let navOptionsApplied = false;
  let slickEventsBound = false;
  let runningSlickSafe = false;

  const stopAutoplay = () => {
    if (!window.jQuery || !main) return;
    const $nav = window.jQuery(main);
    if ($nav.length && $nav.hasClass('slick-initialized') && typeof $nav.slick === 'function') {
      try {
        // refresh=false — never re-init from here
        $nav.slick('slickSetOption', 'autoplay', false, false);
        $nav.slick('slickPause');
      } catch (e) {
        /* ignore */
      }
    }
  };

  // Promote lazysizes data-* to real attributes so slides are visible without JS observers.
  const hydrateLazyImages = () => {
    gallery.querySelectorAll('img').forEach((img, index) => {
      const dataSrc =
        img.getAttribute('data-src') ||
        img.getAttribute('data-srcset') ||
        '';
      if (!img.getAttribute('src')) {
        if (img.getAttribute('data-src')) {
          img.setAttribute('src', img.getAttribute('data-src'));
        } else if (img.getAttribute('data-srcset')) {
          const first = String(img.getAttribute('data-srcset'))
            .split(',')[0]
            .trim()
            .split(/\s+/)[0];
          if (first) img.setAttribute('src', first);
        }
      }
      if (!img.getAttribute('srcset') && img.getAttribute('data-srcset')) {
        img.setAttribute('srcset', img.getAttribute('data-srcset'));
      }
      img.removeAttribute('data-src');
      img.removeAttribute('data-srcset');
      img.classList.remove('lazyload', 'lazyloading');
      if (!img.classList.contains('lazyloaded')) img.classList.add('lazyloaded');

      const mains = gallery.querySelectorAll(
        '.productView-image:not(.slick-cloned) img[data-main-image]'
      );
      const isPrimary = mains[0] === img;
      if (isPrimary) {
        img.setAttribute('loading', 'eager');
        img.setAttribute('fetchpriority', 'high');
      } else if (!img.getAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
    });
  };

  const enhanceThumbs = () => {
    gallery.querySelectorAll('.productView-thumbnail').forEach((thumb, index) => {
      const link = thumb.querySelector('.productView-thumbnail-link');
      if (!link || link.dataset.mmThumbBound) return;
      link.dataset.mmThumbBound = '1';
      if (!link.hasAttribute('tabindex')) link.setAttribute('tabindex', '0');
      if (!link.getAttribute('role')) link.setAttribute('role', 'button');
      const label =
        link.getAttribute('aria-label') ||
        thumb.getAttribute('aria-label') ||
        `Image ${index + 1}`;
      link.setAttribute('aria-label', label);
      link.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          link.click();
        }
      });
    });
  };

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

  let lastFocus = null;
  const bindFancyboxFocus = () => {
    gateZoom();
    gallery.querySelectorAll('[data-fancybox="images"]').forEach((el) => {
      if (el.dataset.mmFancyBound) return;
      el.dataset.mmFancyBound = '1';
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.getAttribute('role')) el.setAttribute('role', 'button');
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
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
      });
    }
  };

  const enhanceCounter = () => {
    const counter = gallery.querySelector('.slick-counter');
    if (!counter) return;
    counter.setAttribute('role', 'status');
    counter.setAttribute('aria-live', 'polite');
  };

  // Apply Slick nav options once only, never with refresh from afterChange.
  const enhanceNavControls = ({ allowRefresh = false } = {}) => {
    if (!main || !window.jQuery) return;
    const $nav = window.jQuery(main);
    if (!$nav.length || !$nav.hasClass('slick-initialized') || typeof $nav.slick !== 'function') return;

    if (mediaCount > 1 && !navOptionsApplied) {
      try {
        // refresh only on the first safe boot — never from afterChange/reInit
        $nav.slick('slickSetOption', 'arrows', true, allowRefresh);
        $nav.slick('slickSetOption', 'swipe', true, false);
        $nav.slick('slickSetOption', 'touchMove', true, false);
        $nav.slick('slickSetOption', 'autoplay', false, false);
        navOptionsApplied = true;
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

  const slideHasMedia = (slide) => {
    if (!slide) return false;
    if (slide.querySelector('video, iframe, .media--video, model-viewer')) return true;
    const img = slide.querySelector('img');
    if (!img) return false;
    return Boolean(
      img.getAttribute('src') ||
        img.getAttribute('srcset') ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-srcset') ||
        img.currentSrc
    );
  };

  const hideEmptySlides = () => {
    gallery.querySelectorAll('.productView-image').forEach((slide) => {
      // Slick clones mirror real slides; never invent media, only mark truly empty originals.
      const hasMedia = slideHasMedia(slide);
      const shouldHide = !hasMedia;
      if (slide.classList.contains('mm-media-empty') === shouldHide) return;
      slide.classList.toggle('mm-media-empty', shouldHide);
      if (shouldHide) slide.setAttribute('aria-hidden', 'true');
      else slide.removeAttribute('aria-hidden');
    });
  };

  const onSlickUpdate = () => {
    if (runningSlickSafe) return;
    runningSlickSafe = true;
    try {
      stopAutoplay();
      enhanceCounter();
      // No slickSetOption(refresh) here — that re-enters init/reInit/afterChange.
      enhanceNavControls({ allowRefresh: false });
      enhanceThumbs();
      hydrateLazyImages();
      hideEmptySlides();
      gateZoom();
    } finally {
      runningSlickSafe = false;
    }
  };

  const boot = ({ allowRefresh = false } = {}) => {
    hydrateLazyImages();
    stopAutoplay();
    enhanceThumbs();
    bindFancyboxFocus();
    enhanceCounter();
    enhanceNavControls({ allowRefresh });
    hideEmptySlides();
    gallery.querySelectorAll('.productView-image:not(.slick-cloned) img[data-main-image]').forEach((img) => {
      if (img.complete) gateZoom();
      else img.addEventListener('load', gateZoom, { once: true });
    });
  };

  boot({ allowRefresh: false });

  // Theme inits Slick asynchronously — refresh at most once when Slick is ready.
  const tryBootWhenSlickReady = () => {
    if (!window.jQuery || !main) return false;
    const $nav = window.jQuery(main);
    if (!$nav.length || !$nav.hasClass('slick-initialized')) return false;
    boot({ allowRefresh: !navOptionsApplied });
    if (!slickEventsBound) {
      slickEventsBound = true;
      $nav.on('init.mmGallery reInit.mmGallery afterChange.mmGallery', onSlickUpdate);
    }
    return true;
  };

  if (!tryBootWhenSlickReady()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (tryBootWhenSlickReady() || attempts >= 20) clearInterval(timer);
    }, 150);
  }
})();
