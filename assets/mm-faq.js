/**
 * MOTHER & ME — accessible FAQ accordion (homepage).
 * Without JS: all answers stay visible. With JS: accordion + keyboard.
 */
(function () {
  'use strict';

  var ROOT_SEL = '.mm-faq';

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function setOpen(item, open) {
    var trigger = item.querySelector('[data-mm-faq-trigger]');
    var panel = item.querySelector('[data-mm-faq-panel]');
    if (!trigger || !panel) return;

    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (prefersReducedMotion()) {
      if (open) {
        panel.hidden = false;
        panel.style.height = '';
        panel.style.opacity = '';
      } else {
        panel.hidden = true;
        panel.style.height = '';
        panel.style.opacity = '';
      }
      return;
    }

    if (open) {
      panel.hidden = false;
      panel.style.height = '0px';
      panel.style.opacity = '0';
      panel.offsetHeight; /* reflow */
      panel.style.transition = 'height 280ms ease-out, opacity 280ms ease-out';
      panel.style.height = panel.scrollHeight + 'px';
      panel.style.opacity = '1';
      var onEnd = function (event) {
        if (event.propertyName !== 'height') return;
        panel.style.height = '';
        panel.style.transition = '';
        panel.removeEventListener('transitionend', onEnd);
      };
      panel.addEventListener('transitionend', onEnd);
    } else {
      panel.style.height = panel.scrollHeight + 'px';
      panel.offsetHeight;
      panel.style.transition = 'height 240ms ease-out, opacity 240ms ease-out';
      panel.style.height = '0px';
      panel.style.opacity = '0';
      var onClose = function (event) {
        if (event.propertyName !== 'height') return;
        panel.hidden = true;
        panel.style.height = '';
        panel.style.opacity = '';
        panel.style.transition = '';
        panel.removeEventListener('transitionend', onClose);
      };
      panel.addEventListener('transitionend', onClose);
    }
  }

  function enhance(root) {
    if (!root || root.dataset.mmFaqReady === '1') return;
    root.dataset.mmFaqReady = '1';
    root.classList.add('is-faq-enhanced');

    // Collapse after enhance so no-JS users still see all answers in HTML/CSS.
    Array.prototype.forEach.call(root.querySelectorAll('[data-mm-faq-item]'), function (item) {
      var trigger = item.querySelector('[data-mm-faq-trigger]');
      var panel = item.querySelector('[data-mm-faq-panel]');
      if (!trigger || !panel) return;
      trigger.setAttribute('aria-expanded', 'false');
      panel.hidden = true;
      panel.style.height = '';
      panel.style.opacity = '';
      panel.style.transition = '';
    });

    root.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-mm-faq-trigger]');
      if (!trigger || !root.contains(trigger)) return;
      var item = trigger.closest('[data-mm-faq-item]');
      if (!item) return;
      var open = trigger.getAttribute('aria-expanded') === 'true';
      setOpen(item, !open);
    });

    root.addEventListener('keydown', function (event) {
      var trigger = event.target.closest('[data-mm-faq-trigger]');
      if (!trigger || !root.contains(trigger)) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        trigger.click();
      }
    });
  }

  function initAll(scope) {
    var root = scope || document;
    if (!root.querySelectorAll) return;
    Array.prototype.forEach.call(root.querySelectorAll(ROOT_SEL), enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll(document);
    });
  } else {
    initAll(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    var target = event.target;
    if (target && target.classList && target.classList.contains('mm-faq')) {
      delete target.dataset.mmFaqReady;
      target.classList.remove('is-faq-enhanced');
    }
    initAll(target || document);
  });
})();
