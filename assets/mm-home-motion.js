/**
 * MOTHER & ME — one-shot homepage reveal.
 * Content stays visible until JS enables animation. Hero is never delayed.
 */
(function () {
  'use strict';

  var SECTION_SEL = '.mm-reveal';
  var ITEM_SEL = '[data-mm-reveal-item]';
  var observers = new WeakMap();

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function items(section) {
    return Array.prototype.slice.call(section.querySelectorAll(ITEM_SEL));
  }

  function showAll(section) {
    items(section).forEach(function (el) {
      el.classList.add('is-revealed');
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

    var list = items(section);
    if (!list.length) return;

    section.classList.add('is-reveal-enabled');

    var remaining = list.length;
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          observer.unobserve(el);
          el.classList.add('is-revealed');
          remaining -= 1;
          if (remaining <= 0) {
            observer.disconnect();
            observers.delete(section);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.15
      }
    );

    list.forEach(function (el) {
      observer.observe(el);
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
    if (!root.querySelectorAll) return;
    Array.prototype.forEach.call(root.querySelectorAll(SECTION_SEL), init);
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
