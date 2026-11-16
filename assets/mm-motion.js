/**
 * MOTHER & ME — tasteful motion
 * Scroll reveals, soft header elevation, reduced-motion safe
 */
(function () {
  'use strict';

  var reduce =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function markRevealTargets() {
    var selectors = [
      '.mm-cats__head',
      '.mm-cats__grid > li',
      '.mm-featured__head',
      '.mm-featured__grid > li',
      '.mm-featured__cta',
      '.mm-story__media',
      '.mm-story__copy',
      '.mm-trust__item',
      '.product-grid > li',
      '.product-grid__item',
      '.collection-list > li',
      '.mm-btn'
    ];

    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (el.closest('.mm-hero')) return;
        if (el.classList.contains('mm-reveal') || el.hasAttribute('data-mm-reveal')) return;
        el.classList.add('mm-reveal');
      });
    });

    document.querySelectorAll('.mm-cats__grid, .mm-featured__grid, .product-grid').forEach(function (grid) {
      var items = grid.querySelectorAll(':scope > li, :scope > .product-grid__item, :scope > .mm-reveal');
      items.forEach(function (item, i) {
        item.style.setProperty('--mm-delay', Math.min(i * 55, 420) + 'ms');
      });
    });

    document.querySelectorAll('.mm-trust__inner').forEach(function (row) {
      row.querySelectorAll('.mm-trust__item').forEach(function (item, i) {
        item.style.setProperty('--mm-delay', i * 80 + 'ms');
      });
    });
  }

  function observeReveals() {
    var nodes = document.querySelectorAll('.mm-reveal, [data-mm-reveal]');
    if (!nodes.length) return;

    if (reduce || !('IntersectionObserver' in window)) {
      nodes.forEach(function (el) {
        el.classList.add('is-in');
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );

    nodes.forEach(function (el) {
      io.observe(el);
    });
  }

  function stickyHeader() {
    var header =
      document.querySelector('#header-group') ||
      document.querySelector('sticky-header') ||
      document.querySelector('header');
    if (!header) return;

    var last = 0;
    var ticking = false;

    function onScroll() {
      var y = window.scrollY || window.pageYOffset || 0;
      header.classList.toggle('mm-header--scrolled', y > 12);
      header.classList.toggle('mm-header--compact', y > 80);
      last = y;
      ticking = false;
    }

    window.addEventListener(
      'scroll',
      function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(onScroll);
      },
      { passive: true }
    );

    onScroll();
  }

  function softHeroParallax() {
    if (reduce) return;
    var hero = document.querySelector('.mm-hero__media img');
    if (!hero) return;

    var ticking = false;
    window.addEventListener(
      'scroll',
      function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          var y = window.scrollY || 0;
          var shift = Math.min(y * 0.12, 48);
          hero.style.transform = 'scale(1.04) translate3d(0,' + shift + 'px,0)';
          ticking = false;
        });
      },
      { passive: true }
    );
  }

  ready(function () {
    document.documentElement.classList.add('mm-motion-ready');
    markRevealTargets();
    observeReveals();
    stickyHeader();
    softHeroParallax();
  });
})();
