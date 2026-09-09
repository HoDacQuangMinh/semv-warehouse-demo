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
  var swapTimer = null;
  var finishTimer = null;

  function valid(id) {
    var view = document.getElementById('view-' + id);
    return !!view && view.classList.contains('view');
  }

  // Fragments work both on a web server and in the offline single-file demo.
  function locationView() {
    var id = location.hash.slice(1).replace(/^view-/, '');
    return valid(id) ? id : 'home';
  }

  function record(id, replace) {
    var state = Object.assign({}, history.state, { warehouseView: id });
    history[replace ? 'replaceState' : 'pushState'](state, '', '#' + id);
  }

  function cancelTransition() {
    clearTimeout(swapTimer);
    clearTimeout(finishTimer);
    swapTimer = finishTimer = null;
    var layer = document.getElementById('transition');
    layer.classList.remove('is-running');
    layer.hidden = true;
    layer.innerHTML = '';
    busy = false;
  }

  function cancelHandoff() {
    if (global.WarehouseHandoff && global.WarehouseHandoff.isActive()) {
      global.WarehouseHandoff.cancel();
    }
  }

  function restore(force) {
    var id = locationView();
    var interrupted = busy || (global.WarehouseHandoff && global.WarehouseHandoff.isActive());
    cancelTransition();
    cancelHandoff();
    if (location.hash !== '#' + id) { record(id, true); }
    if (force || interrupted || id !== current) { apply(id); }
  }

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
    var heading = document.querySelector('#view-' + id + ' [data-view-heading], #view-' + id + ' h1');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
    listeners.forEach(function (fn) { fn(id); });
  }

  function go(id, options) {
    var opts = options || {};
    if (!valid(id) || (busy && !opts.instant)) { return; }
    if (busy) { cancelTransition(); }
    cancelHandoff();
    if (id === current && locationView() === id) { return; }
    record(id, !!opts.replace);

    if (opts.instant || global.Forklift.prefersReducedMotion()) {
      apply(id);
      return;
    }

    busy = true;
    var layer = document.getElementById('transition');
    layer.innerHTML =
      '<div class="transition__curtain"></div>'
      + '<div class="transition__truck">' + global.TransitionForklift.markup() + '</div>';
    layer.hidden = false;
    void layer.offsetWidth;
    layer.classList.add('is-running');

    swapTimer = setTimeout(function () { apply(id); }, SWAP_AT);
    finishTimer = setTimeout(cancelTransition, TRANSITION_MS);
  }

  function init() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest('[data-goto]');
      if (!link) { return; }
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) { return; }
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

    global.addEventListener('popstate', function () { restore(false); });
    global.addEventListener('hashchange', function () { restore(false); });
    // Returning from another document can restore a suspended animation from
    // the browser cache. Clear transient layers and resume the active view.
    global.addEventListener('pagehide', function () { cancelTransition(); cancelHandoff(); });
    global.addEventListener('pageshow', function (event) { if (event.persisted) { restore(true); } });

    var initial = locationView();
    record(initial, true);
    apply(initial);
  }

  global.Router = {
    init: init,
    go: go,
    current: function () { return current; },
    onChange: function (fn) { listeners.push(fn); }
  };
})(window);
