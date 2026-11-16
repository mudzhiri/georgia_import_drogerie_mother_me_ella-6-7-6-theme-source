/**
 * MOTHER & ME — one-shot reveal for homepage category tiles.
 * Content stays visible until JS successfully enables the animation.
 */
(function () {
  'use strict';

  var SECTION_SEL = '.mm-categories';
  var TILE_SEL = '.mm-categories__tile';
  var observers = new WeakMap();

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function tiles(section) {
    return Array.prototype.slice.call(section.querySelectorAll(TILE_SEL));
  }

  function showAll(section) {
    tiles(section).forEach(function (tile) {
      tile.classList.add('is-revealed');
    });
    section.classList.remove('is-reveal-enabled');
  }

  function cleanup(section) {
    var obs = observers.get(section);
    if (obs) {
      obs.disconnect();
      observers.delete(section);
    }
    section.classList.remove('is-reveal-enabled');
    delete section.dataset.mmRevealInit;
  }

  function init(section) {
    if (!section || section.dataset.mmRevealInit === '1') return;

    section.dataset.mmRevealInit = '1';

    if (prefersReducedMotion() || typeof IntersectionObserver !== 'function') {
      showAll(section);
      return;
    }

    var list = tiles(section);
    if (!list.length) return;

    /* Enable hidden pending state only after observer is ready */
    section.classList.add('is-reveal-enabled');

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var tile = entry.target;
          observer.unobserve(tile);
          tile.classList.add('is-revealed');
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.2
      }
    );

    list.forEach(function (tile) {
      observer.observe(tile);
    });

    observers.set(section, observer);
  }

  function findSection(root) {
    if (!root) return null;
    if (root.matches && root.matches(SECTION_SEL)) return root;
    if (root.querySelector) return root.querySelector(SECTION_SEL);
    return null;
  }

  function initAll(scope) {
    var root = scope || document;
    var sections = root.querySelectorAll
      ? root.querySelectorAll(SECTION_SEL)
      : [];
    Array.prototype.forEach.call(sections, init);
  }

  function onSectionLoad(event) {
    var section = findSection(event.target);
    if (!section) return;
    cleanup(section);
    init(section);
  }

  function onSectionUnload(event) {
    var section = findSection(event.target);
    if (!section) return;
    cleanup(section);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll(document);
    });
  } else {
    initAll(document);
  }

  document.addEventListener('shopify:section:load', onSectionLoad);
  document.addEventListener('shopify:section:unload', onSectionUnload);
})();
