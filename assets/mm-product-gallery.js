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
  let hydrated = false;

  const stopAutoplay = () => {
    if (!window.jQuery || !main) return;
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

  // Promote lazysizes data-* to real attributes so slides are visible without JS observers.
  const hydrateLazyImages = () => {
    const mains = gallery.querySelectorAll(
      '.productView-image:not(.slick-cloned) img[data-main-image]'
    );
    const primary = mains[0] || null;

    gallery.querySelectorAll('img').forEach((img) => {
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

      if (img === primary) {
        img.setAttribute('loading', 'eager');
        img.setAttribute('fetchpriority', 'high');
      } else if (!img.getAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
    });
    hydrated = true;
  };

  const enhanceThumbs = () => {
    const thumbPattern =
      gallery.getAttribute('data-mm-thumb-label') || 'სურათი {{ index }}';
    gallery.querySelectorAll('.productView-thumbnail').forEach((thumb, index) => {
      const link = thumb.querySelector('.productView-thumbnail-link');
      if (!link || link.dataset.mmThumbBound) return;
      link.dataset.mmThumbBound = '1';
      if (!link.hasAttribute('tabindex')) link.setAttribute('tabindex', '0');
      if (!link.getAttribute('role')) link.setAttribute('role', 'button');
      const existing = link.getAttribute('aria-label');
      if (!existing || /^Image\s+\d+/i.test(existing)) {
        link.setAttribute(
          'aria-label',
          thumbPattern
            .replace('__INDEX__', String(index + 1))
            .replace('{{ index }}', String(index + 1))
        );
      }
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

  const gateZoom = (root = gallery) => {
    root.querySelectorAll('[data-fancybox="images"], .productView-iconZoom, .media[data-fancybox]').forEach((el) => {
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

  // Never refresh Slick from here — theme reInit + asNavFor can freeze the page.
  const enhanceNavControls = () => {
    if (!main || !window.jQuery) return;
    const $nav = window.jQuery(main);
    if (!$nav.length || !$nav.hasClass('slick-initialized') || typeof $nav.slick !== 'function') return;

    if (mediaCount > 1 && !navOptionsApplied) {
      try {
        $nav.slick('slickSetOption', 'arrows', true, false);
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
      const hasMedia = slideHasMedia(slide);
      const shouldHide = !hasMedia;
      if (slide.classList.contains('mm-media-empty') === shouldHide) return;
      slide.classList.toggle('mm-media-empty', shouldHide);
      if (shouldHide) slide.setAttribute('aria-hidden', 'true');
      else slide.removeAttribute('aria-hidden');
    });
  };

  // Lightweight update on slide change — no hydrate / no slick refresh.
  const onSlickUpdate = () => {
    if (runningSlickSafe) return;
    runningSlickSafe = true;
    try {
      stopAutoplay();
      enhanceCounter();
      enhanceNavControls();
      const active = gallery.querySelector('.productView-image.slick-current, .slick-slide.slick-active');
      if (active) gateZoom(active);
    } finally {
      runningSlickSafe = false;
    }
  };

  const clearAnimatedLoading = () => {
    gallery.querySelectorAll('.animated-loading').forEach((el) => {
      el.classList.remove('animated-loading');
    });
  };

  const boot = () => {
    if (!hydrated) hydrateLazyImages();
    stopAutoplay();
    enhanceThumbs();
    bindFancyboxFocus();
    enhanceCounter();
    enhanceNavControls();
    hideEmptySlides();
    clearAnimatedLoading();
    gallery.querySelectorAll('.productView-image:not(.slick-cloned) img[data-main-image]').forEach((img) => {
      if (img.complete) gateZoom(img.closest('.productView-image') || gallery);
      else img.addEventListener('load', () => gateZoom(img.closest('.productView-image') || gallery), { once: true });
    });
  };

  boot();

  const tryBootWhenSlickReady = () => {
    if (!window.jQuery || !main) return false;
    const $nav = window.jQuery(main);
    if (!$nav.length || !$nav.hasClass('slick-initialized')) return false;
    boot();
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

(() => {
  const root = document.querySelector('[data-mm-pdp-actions]');
  if (!root || root.dataset.mmPdpActionsInit === '1') return;
  root.dataset.mmPdpActionsInit = '1';

  const shareBtn = root.querySelector('[data-mm-share]');
  const toast = root.querySelector('[data-mm-share-toast]');
  let toastTimer = null;

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message || '';
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2200);
  };

  const copyLink = async (url) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return;
    }
    const input = document.createElement('input');
    input.value = url;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  };

  shareBtn?.addEventListener('click', async (event) => {
    event.preventDefault();
    const url = shareBtn.getAttribute('data-mm-share-url') || window.location.href;
    const title = shareBtn.getAttribute('data-mm-share-title') || document.title;
    const copied = shareBtn.getAttribute('data-mm-share-copied') || 'Copied';

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await copyLink(url);
      shareBtn.classList.add('is-copied');
      showToast(copied);
      window.setTimeout(() => shareBtn.classList.remove('is-copied'), 1800);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      try {
        await copyLink(url);
        shareBtn.classList.add('is-copied');
        showToast(copied);
        window.setTimeout(() => shareBtn.classList.remove('is-copied'), 1800);
      } catch (_) {
        /* ignore */
      }
    }
  });
})();
