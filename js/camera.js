/* Pan and zoom the isometric SVG without moving the corner caption. */
(function (global) {
  'use strict';

  function create(mount, svg, options) {
    var opts = options || {};
    var base = { x: 58, y: -35, width: 988, height: 662 };
    var zoom = 1.04;
    var frame = { x: 552 - base.width / zoom / 2, y: 298 - base.height / zoom / 2 };
    var pointers = new Map();
    var start = null;
    var pinch = null;
    var dragging = false;
    var suppressClick = false;
    var controls = document.createElement('div');
    controls.className = 'twin-map-controls';
    controls.setAttribute('role', 'group');
    controls.innerHTML = '<button type="button" data-map="in">+</button>'
      + '<button type="button" data-map="out">−</button>'
      + '<button type="button" data-map="reset">↺</button>';
    mount.parentElement.appendChild(controls);

    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

    function draw() {
      var width = base.width / zoom, height = base.height / zoom;
      // Keep part of the building in view, even after a very long drag.
      frame.x = clamp(frame.x, base.x - width * .15, base.x + base.width - width * .85);
      frame.y = clamp(frame.y, base.y - height * .15, base.y + base.height - height * .85);
      svg.setAttribute('viewBox', [frame.x, frame.y, width, height].join(' '));
      mount.setAttribute('data-map-zoom', zoom.toFixed(2));
      controls.querySelector('[data-map="in"]').disabled = zoom >= 3;
      controls.querySelector('[data-map="out"]').disabled = zoom <= 1;
    }

    function moving() {
      if (opts.onMove) { opts.onMove(); }
    }

    function zoomAt(next, clientX, clientY) {
      next = clamp(next, 1, 3);
      var matrix = svg.getScreenCTM();
      if (!matrix || next === zoom) { return; }
      var point = svg.createSVGPoint();
      point.x = clientX; point.y = clientY;
      point = point.matrixTransform(matrix.inverse());
      var ratio = zoom / next;
      frame.x = point.x - (point.x - frame.x) * ratio;
      frame.y = point.y - (point.y - frame.y) * ratio;
      zoom = next;
      moving();
      draw();
    }

    function changeZoom(factor) {
      var box = svg.getBoundingClientRect();
      zoomAt(zoom * factor, box.left + box.width / 2, box.top + box.height / 2);
    }

    function reset() {
      zoom = 1; frame.x = base.x; frame.y = base.y;
      moving(); draw();
    }

    controls.addEventListener('click', function (event) {
      var button = event.target.closest('[data-map]');
      if (!button) { return; }
      var action = button.getAttribute('data-map');
      if (action === 'reset') { reset(); }
      else { changeZoom(action === 'in' ? 1.2 : 1 / 1.2); }
    });

    function beginPinch() {
      var pair = Array.from(pointers.values());
      var matrix = svg.getScreenCTM();
      var point = svg.createSVGPoint();
      point.x = (pair[0].x + pair[1].x) / 2;
      point.y = (pair[0].y + pair[1].y) / 2;
      pinch = {
        distance: Math.max(1, Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y)),
        zoom: zoom, anchor: point.matrixTransform(matrix.inverse()),
        left: matrix.e + matrix.a * frame.x,
        top: matrix.f + matrix.d * frame.y,
        scale: matrix.a
      };
      dragging = true; suppressClick = true;
      mount.classList.add('is-dragging');
      moving();
    }

    svg.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' && event.button !== 0) { return; }
      if (!pointers.size) { suppressClick = false; }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        var matrix = svg.getScreenCTM();
        start = { x: event.clientX, y: event.clientY, viewX: frame.x, viewY: frame.y, scale: matrix.a };
      } else if (pointers.size === 2) { beginPinch(); }
    });

    global.addEventListener('pointermove', function (event) {
      if (!pointers.has(event.pointerId)) { return; }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2 && pinch) {
        var pair = Array.from(pointers.values());
        var distance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        zoom = clamp(pinch.zoom * distance / pinch.distance, 1, 3);
        var scale = pinch.scale * zoom / pinch.zoom;
        frame.x = pinch.anchor.x - ((pair[0].x + pair[1].x) / 2 - pinch.left) / scale;
        frame.y = pinch.anchor.y - ((pair[0].y + pair[1].y) / 2 - pinch.top) / scale;
        draw();
      } else if (start) {
        var dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (!dragging && Math.hypot(dx, dy) < 6) { return; }
        if (!dragging) { moving(); }
        dragging = true; suppressClick = true;
        mount.classList.add('is-dragging');
        // Capture only after the drag threshold. A tap keeps its original
        // target, including a named crew member or station underneath it.
        if (!svg.hasPointerCapture(event.pointerId)) { svg.setPointerCapture(event.pointerId); }
        frame.x = start.viewX - dx / start.scale;
        frame.y = start.viewY - dy / start.scale;
        draw();
      }
      if (event.cancelable) { event.preventDefault(); }
    }, { passive: false });

    function release(event) {
      if (!pointers.has(event.pointerId)) { return; }
      pointers.delete(event.pointerId);
      if (svg.hasPointerCapture(event.pointerId)) { svg.releasePointerCapture(event.pointerId); }
      pinch = null;
      if (pointers.size === 1) {
        var point = Array.from(pointers.values())[0];
        start = { x: point.x, y: point.y, viewX: frame.x, viewY: frame.y, scale: svg.getScreenCTM().a };
      } else {
        start = null; dragging = false;
        mount.classList.remove('is-dragging');
      }
    }
    global.addEventListener('pointerup', release);
    global.addEventListener('pointercancel', release);

    svg.addEventListener('click', function (event) {
      if (suppressClick) {
        event.preventDefault(); event.stopImmediatePropagation();
        suppressClick = false;
      }
    }, true);

    svg.addEventListener('wheel', function (event) {
      // Ctrl/Command+wheel still belongs to the browser's page zoom.
      if (event.ctrlKey || event.metaKey) { return; }
      event.preventDefault();
      var delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      zoomAt(zoom * Math.exp(-clamp(delta, -300, 300) * .0015), event.clientX, event.clientY);
    }, { passive: false });

    svg.addEventListener('keydown', function (event) {
      if (event.target !== svg || event.ctrlKey || event.metaKey || event.altKey) { return; }
      if (event.key === '+' || event.key === '=') { changeZoom(1.2); }
      else if (event.key === '-') { changeZoom(1 / 1.2); }
      else if (event.key === '0' || event.key === 'Home') { reset(); }
      else if (/^Arrow(Left|Right|Up|Down)$/.test(event.key)) {
        var step = 45 / zoom;
        if (event.key === 'ArrowLeft') { frame.x -= step; }
        if (event.key === 'ArrowRight') { frame.x += step; }
        if (event.key === 'ArrowUp') { frame.y -= step; }
        if (event.key === 'ArrowDown') { frame.y += step; }
        moving(); draw();
      } else { return; }
      event.preventDefault();
    });

    function cancelDrag() {
      pointers.forEach(function (_, id) { if (svg.hasPointerCapture(id)) { svg.releasePointerCapture(id); } });
      pointers.clear(); start = null; pinch = null; dragging = false; suppressClick = false;
      mount.classList.remove('is-dragging');
    }
    global.addEventListener('blur', cancelDrag);
    global.addEventListener('resize', function () { cancelDrag(); moving(); });
    draw();
    return {
      isDragging: function () { return dragging; },
      cancelDrag: cancelDrag,
      relabel: function () {
        controls.setAttribute('aria-label', opts.text('twin.mapControls'));
        [['in','twin.zoomIn'],['out','twin.zoomOut'],['reset','twin.resetMap']].forEach(function (pair) {
          var button = controls.querySelector('[data-map="' + pair[0] + '"]');
          button.setAttribute('aria-label', opts.text(pair[1]));
          button.title = opts.text(pair[1]);
        });
      }
    };
  }
  global.WarehouseCamera = { create: create };
})(window);
