/* The forklift that crosses the screen after a station is finished.
   Triggered by a click, never by scroll position. */

(function (global) {
  'use strict';

  var SVG = [
    '<svg viewBox="0 0 300 190" aria-hidden="true" focusable="false">',
    '  <g class="fk-shell">',
    '    <rect class="fk-dark" x="34" y="70" width="18" height="10"/>',
    '    <path class="fk-body" d="M40 80h118v58H40z"/>',
    '    <path class="fk-body" d="M40 80h30v-22h34l14 22z"/>',
    '    <rect class="fk-dark" x="76" y="62" width="26" height="16"/>',
    '    <path class="fk-cage" d="M74 58V26h72v32M74 26h72"/>',
    '    <rect class="fk-beacon" x="102" y="16" width="12" height="10"/>',
    '    <rect class="fk-mast" x="164" y="14" width="9" height="124"/>',
    '    <rect class="fk-mast" x="180" y="14" width="9" height="124"/>',
    '    <g class="fk-carriage">',
    '      <rect class="fk-fork" x="160" y="112" width="34" height="9"/>',
    '      <rect class="fk-fork" x="190" y="124" width="72" height="7"/>',
    '      <rect class="fk-fork" x="190" y="112" width="9" height="19"/>',
    '      <rect class="fk-load" x="198" y="76" width="60" height="34"/>',
    '      <rect class="fk-load" x="198" y="52" width="60" height="24"/>',
    '      <path class="fk-skid" d="M194 110h68v12h-68z"/>',
    '    </g>',
    '  </g>',
    '  <g class="fk-wheel">',
    '    <circle class="fk-tyre" cx="70" cy="150" r="26"/>',
    '    <circle class="fk-hub" cx="70" cy="150" r="9"/>',
    '    <rect class="fk-tyre" x="68" y="126" width="4" height="48"/>',
    '  </g>',
    '  <g class="fk-wheel">',
    '    <circle class="fk-tyre" cx="146" cy="156" r="20"/>',
    '    <circle class="fk-hub" cx="146" cy="156" r="7"/>',
    '    <rect class="fk-tyre" x="144" y="138" width="4" height="36"/>',
    '  </g>',
    '</svg>'
  ].join('');

  var running = false;

  function prefersReducedMotion() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function run() {
    return new Promise(function (resolve) {
      var layer = document.getElementById('forklift-layer');
      if (!layer || running) { resolve(); return; }

      if (prefersReducedMotion()) { resolve(); return; }

      running = true;
      var truck = document.createElement('div');
      truck.className = 'forklift';
      truck.innerHTML = SVG;
      layer.appendChild(truck);

      // Force a reflow so the animation starts from the offscreen position.
      void truck.offsetWidth;
      truck.classList.add('is-driving');

      var finish = function () {
        truck.removeEventListener('animationend', onEnd);
        if (truck.parentNode) { truck.parentNode.removeChild(truck); }
        running = false;
        resolve();
      };

      var onEnd = function (event) {
        if (event.animationName === 'drive') { finish(); }
      };

      truck.addEventListener('animationend', onEnd);
      // Safety net in case the animationend event never fires.
      setTimeout(function () { if (running) { finish(); } }, 4200);
    });
  }

  global.Forklift = {
    run: run,
    markup: function () { return SVG; },
    prefersReducedMotion: prefersReducedMotion
  };
})(window);
