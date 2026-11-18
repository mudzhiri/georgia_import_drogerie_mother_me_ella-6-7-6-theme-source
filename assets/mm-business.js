(function () {
  'use strict';

  var root = document.querySelector('[data-mm-business]');
  if (!root) return;

  var typeSelect = root.querySelector('[data-mm-business-type]');
  var cards = root.querySelectorAll('[data-mm-business-card]');
  var form = root.querySelector('[data-mm-business-form]');
  var formAnchor = root.querySelector('#mm-business-form');
  var conditionalFields = root.querySelectorAll('[data-mm-business-show-for]');
  var subjectInput = root.querySelector('[data-mm-business-subject]');
  var categoryMirror = root.querySelector('[data-mm-business-category-mirror]');
  var successEl = root.querySelector('[data-mm-business-success]');
  var errorEl = root.querySelector('[data-mm-business-errors]');
  var submitting = false;

  var validTypes = {
    supplier: true,
    reseller: true,
    distribution: true,
    other: true
  };

  function typeCodeFromSelect() {
    if (!typeSelect) return 'other';
    var selected = typeSelect.options[typeSelect.selectedIndex];
    var code = selected && selected.getAttribute('data-mm-type');
    return code && validTypes[code] ? code : 'other';
  }

  function selectByCode(code) {
    if (!typeSelect || !validTypes[code]) return;
    var option = typeSelect.querySelector('option[data-mm-type="' + code + '"]');
    if (option) typeSelect.value = option.value;
  }

  function syncInboxFields() {
    var code = typeCodeFromSelect();
    var selected = typeSelect && typeSelect.options[typeSelect.selectedIndex];
    var categoryValue = selected ? selected.value : '';
    if (categoryMirror) categoryMirror.value = categoryValue;
    if (subjectInput) {
      var base = subjectInput.getAttribute('data-mm-subject-base') || 'B2B — MOTHER & ME';
      subjectInput.value = categoryValue ? 'B2B | ' + categoryValue + ' — MOTHER & ME' : base;
    }
    return code;
  }

  function setType(type, scrollToForm) {
    if (!validTypes[type]) return;
    selectByCode(type);
    syncInboxFields();
    cards.forEach(function (card) {
      var active = card.getAttribute('data-mm-business-card') === type;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    updateConditional(type);
    if (scrollToForm && formAnchor) {
      formAnchor.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      window.setTimeout(function () {
        var first = form && form.querySelector('input:not([type="hidden"]), select, textarea');
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
    return typeCodeFromSelect();
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
      setType(typeCodeFromSelect(), false);
    });
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      if (submitting) {
        event.preventDefault();
        return;
      }
      if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
        return;
      }
      submitting = true;
      syncInboxFields();
      var btn = form.querySelector('[type="submit"]');
      if (btn) {
        btn.setAttribute('aria-busy', 'true');
        btn.disabled = true;
        var idle = btn.querySelector('[data-mm-business-submit-label]');
        var loading = btn.querySelector('.mm-business__submit-loading');
        if (idle) idle.hidden = true;
        if (loading) loading.hidden = false;
      }
    });
  }

  window.addEventListener('pageshow', function (event) {
    if (event.persisted && form) {
      submitting = false;
      var btn = form.querySelector('[type="submit"]');
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        var idle = btn.querySelector('[data-mm-business-submit-label]');
        var loading = btn.querySelector('.mm-business__submit-loading');
        if (idle) idle.hidden = false;
        if (loading) loading.hidden = true;
      }
    }
  });

  if (successEl) {
    try { successEl.focus(); } catch (e) {}
  } else if (errorEl) {
    try { errorEl.focus(); } catch (e) {}
  }

  setType(typeFromUrl(), false);
})();
