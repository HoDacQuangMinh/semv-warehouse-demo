/* Full screen views with a forklift transition between them.
   Only one view is in the document flow at a time, so nothing scrolls to reach
   another station. The truck drives across pushing a curtain; the view is
   swapped behind the curtain at the halfway point, so the change is never
   seen. */

(function (global) {
  'use strict';

  var TRANSITION_MS = 1700;
  var SWAP_AT = 780;

  var current = 'home';
  var busy = false;
  var listeners = [];

  function views() {
    return Array.prototype.slice.call(document.querySelectorAll('.view'));
  }

  function apply(id) {
    views().forEach(function (view) {
      var active = view.id === 'view-' + id;
      view.classList.toggle('is-active', active);
      view.hidden = !active;
    });
    document.body.setAttribute('data-view', id);
    document.querySelectorAll('.topbar__nav [data-goto]').forEach(function (link) {
      if (link.getAttribute('data-goto') === id) { link.setAttribute('aria-current', 'page'); }
      else { link.removeAttribute('aria-current'); }
    });
    current = id;
    if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); }
    var heading = document.querySelector('#view-' + id + ' [data-view-heading]');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus(); }
    listeners.forEach(function (fn) { fn(id); });
  }

  function go(id, options) {
    var opts = options || {};
    if (busy || id === current) { return; }
    if (!document.getElementById('view-' + id)) { return; }

    if (opts.instant || global.Forklift.prefersReducedMotion()) {
      apply(id);
      return;
    }

    busy = true;
    var layer = document.getElementById('transition');
    layer.innerHTML =
      '<div class="transition__curtain"></div>'
      + '<div class="transition__truck">' + global.Forklift.markup() + '</div>';
    layer.hidden = false;
    void layer.offsetWidth;
    layer.classList.add('is-running');

    setTimeout(function () { apply(id); }, SWAP_AT);
    setTimeout(function () {
      layer.classList.remove('is-running');
      layer.hidden = true;
      layer.innerHTML = '';
      busy = false;
    }, TRANSITION_MS);
  }

  function init() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest('[data-goto]');
      if (!link) { return; }
      event.preventDefault();
      go(link.getAttribute('data-goto'));
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && current !== 'home') {
        var overlay = document.getElementById('finale');
        if (overlay && !overlay.hidden) { return; }
        go('home');
      }
    });

    apply('home');
  }

  global.Router = {
    init: init,
    go: go,
    current: function () { return current; },
    onChange: function (fn) { listeners.push(fn); }
  };
})(window);
