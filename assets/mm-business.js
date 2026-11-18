(function () {
  'use strict';

  var root = document.querySelector('[data-mm-business]');
  if (!root) return;

  var typeSelect = root.querySelector('[data-mm-business-type]');
  var cards = root.querySelectorAll('[data-mm-business-card]');
  var form = root.querySelector('[data-mm-business-form]');
  var formAnchor = root.querySelector('#mm-business-form');
  var conditionalFields = root.querySelectorAll('[data-mm-business-show-for]');

  var validTypes = {
    supplier: true,
    reseller: true,
    distribution: true,
    other: true
  };

  function setType(type, scrollToForm) {
    if (!validTypes[type]) return;
    if (typeSelect) {
      typeSelect.value = type;
      typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    cards.forEach(function (card) {
      var active = card.getAttribute('data-mm-business-card') === type;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    updateConditional(type);
    if (scrollToForm && formAnchor) {
      formAnchor.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      window.setTimeout(function () {
        var first = form && form.querySelector('input, select, textarea');
        if (first) first.focus({ preventScroll: true });
      }, prefersReducedMotion() ? 0 : 220);
    }
  }

  function updateConditional(type) {
    conditionalFields.forEach(function (field) {
      var showFor = (field.getAttribute('data-mm-business-show-for') || '')
        .split(',')
        .map(function (s) { return s.trim(); })
        .filter(Boolean);
      var show = showFor.length === 0 || showFor.indexOf(type) !== -1;
      field.hidden = !show;
      var controls = field.querySelectorAll('input, select, textarea');
      controls.forEach(function (el) {
        if (!show) {
          el.setAttribute('tabindex', '-1');
        } else {
          el.removeAttribute('tabindex');
        }
      });
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function typeFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var fromQuery = params.get('type');
      if (fromQuery && validTypes[fromQuery]) return fromQuery;
      var hash = (window.location.hash || '').replace(/^#/, '');
      if (hash && validTypes[hash]) return hash;
    } catch (e) {}
    return typeSelect && typeSelect.value ? typeSelect.value : 'other';
  }

  cards.forEach(function (card) {
    card.addEventListener('click', function () {
      setType(card.getAttribute('data-mm-business-card'), true);
    });
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setType(card.getAttribute('data-mm-business-card'), true);
      }
    });
  });

  if (typeSelect) {
    typeSelect.addEventListener('change', function () {
      setType(typeSelect.value, false);
    });
  }

  if (form) {
    form.addEventListener('submit', function () {
      var btn = form.querySelector('[type="submit"]');
      if (btn) btn.setAttribute('aria-busy', 'true');
    });
  }

  setType(typeFromUrl(), false);
})();
