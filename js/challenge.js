/* The manual challenge, web version. Match cartons to docket lines by hand,
   against a clock, with two discrepancies planted. */

(function (global) {
  'use strict';

  var t = function (key, vars) { return global.I18N.t(key, vars); };

  var LINES = [
    { id: 'L1', item: 'SE-A4021-88', qty: 24 },
    { id: 'L2', item: 'SE-B1190-04', qty: 12 },
    { id: 'L3', item: 'SE-C7745-20', qty: 30 },
    { id: 'L4', item: 'SE-D3308-11', qty: 6 }
  ];

  // Two of these do not agree with the docket: BX-00004 is short by two units
  // and BX-00002 carries a transposed item code.
  var CARTONS = [
    { code: 'BX-00003', item: 'SE-C7745-20', qty: 30, line: 'L3', bad: false },
    { code: 'BX-00002', item: 'SE-B1190-40', qty: 12, line: 'L2', bad: true },
    { code: 'BX-00004', item: 'SE-D3308-11', qty: 4, line: 'L4', bad: true },
    { code: 'BX-00001', item: 'SE-A4021-88', qty: 24, line: 'L1', bad: false }
  ];

  function esc(value) {
    return String(value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function clock(ms) {
    var total = Math.round(ms / 1000);
    var mins = Math.floor(total / 60);
    var secs = total % 60;
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function create(mount) {
    var s = {
      phase: 'idle',
      startedAt: 0,
      elapsed: 0,
      picked: null,
      flagMode: false,
      assigned: {},
      message: null
    };
    var ticker = null;
    var active=false,lastTick=0;
    function focus(selector) { var node=mount.querySelector(selector);if(node)node.focus({preventScroll:true}); }
    function syncClock() {
      clearInterval(ticker);ticker=null;lastTick=Date.now();
      if(active && !document.hidden && s.phase==='play') ticker=setInterval(tick,250);
    }
    document.addEventListener('visibilitychange',syncClock);

    function assignedCount() { return Object.keys(s.assigned).length; }

    function missedCount() {
      return CARTONS.filter(function (carton) {
        var record = s.assigned[carton.code];
        return carton.bad && (!record || !record.flagged);
      }).length;
    }

    function render() {
      if (s.phase === 'idle') {
        mount.innerHTML =
          '<div class="ch ch--idle">'
          + '<button class="btn btn-primary" type="button" data-act="start">' + esc(t('challenge.start')) + '</button>'
          + '</div>';
        return;
      }

      if (s.phase === 'done') {
        var missed = missedCount();
        var score=CARTONS.filter(function(c){return s.assigned[c.code].flagged===c.bad;}).length;
        var review=CARTONS.map(function(c){
          var correct=s.assigned[c.code].flagged===c.bad;
          return '<li class="'+(correct?'is-good':'')+'"><strong>'+esc(c.code)+' · '+esc(correct?t('challenge.correct'):t('challenge.flag'))+'</strong>'
            +esc(t(c.code==='BX-00002'?'challenge.error.item':c.code==='BX-00004'?'challenge.error.qty':'challenge.error.clear'))+'</li>';
        }).join('');
        mount.innerHTML =
          '<div class="ch ch--result">'
          + '<h3>' + esc(t('challenge.done.title')) + '</h3>'
          + '<p class="ch__verdict">' + esc(t('challenge.done.time', { time: clock(s.elapsed) })) + '</p>'
          + '<p class="ch__verdict ' + (missed ? 'is-bad' : 'is-good') + '">'
          +   esc(missed ? t('challenge.done.missed', { n: missed }) : t('challenge.done.caught'))
          + '</p>'
          + '<p><strong>' + esc(t('challenge.score',{n:score})) + '</strong></p><ul class="ch__review">'+review+'</ul>'
          + '<p>' + esc(t('challenge.done.note')) + '</p>'
          + '<button class="btn btn-primary" type="button" data-goto="gr">'+esc(t('gr.name'))+'</button> '
          + '<button class="btn btn-ghost" type="button" data-act="reset">' + esc(t('challenge.reset')) + '</button>'
          + '</div>';
        return;
      }

      var boxes = CARTONS.map(function (carton) {
        var record = s.assigned[carton.code];
        var cls = 'ch-box';
        if (record) { cls += record.flagged ? ' is-flagged' : ' is-matched'; }
        if (s.picked === carton.code) { cls += ' is-picked'; }
        return '<button class="' + cls + '" type="button" data-carton="' + carton.code + '"' + (record ? ' disabled' : '') + '>'
          + '<span class="ch-box__code mono">' + esc(carton.code) + '</span>'
          + '<span class="ch-box__item mono">' + esc(carton.item) + '</span>'
          + '<span class="ch-box__qty mono">' + carton.qty + '</span>'
          + '</button>';
      }).join('');

      var rows = LINES.map(function (line) {
        var taken = Object.keys(s.assigned).some(function (code) { return s.assigned[code].line === line.id; });
        return '<button class="ch-line' + (taken ? ' is-taken' : '') + '" type="button" data-line="' + line.id + '"'
          + (taken || !s.picked ? ' disabled' : '') + '>'
          + '<span class="mono">' + esc(line.id) + '</span>'
          + '<span class="mono">' + esc(line.item) + '</span>'
          + '<span class="mono">' + line.qty + '</span>'
          + '</button>';
      }).join('');

      mount.innerHTML =
        '<div class="ch">'
        + '<div class="ch__bar">'
        +   '<span class="ch__time mono" data-time>' + esc(t('challenge.time')) + ' ' + clock(s.elapsed) + '</span>'
        +   '<button class="btn-flag' + (s.flagMode ? ' is-on' : '') + '" type="button" data-act="flag" aria-pressed="'+s.flagMode+'">'
        +     esc(t(s.flagMode ? 'challenge.flagged' : 'challenge.flag')) + '</button>'
        + '</div>'
        + '<p class="ch__hint" role="status">' + esc(s.message || t('challenge.pick')) + '</p>'
        + '<div class="ch__grid">'
        +   '<div><p class="ch__cap">' + esc(t('challenge.boxes')) + '</p><div class="ch__boxes">' + boxes + '</div></div>'
        +   '<div><p class="ch__cap">' + esc(t('challenge.paper')) + '</p><div class="ch__paper">' + rows + '</div></div>'
        + '</div>'
        + '</div>';
    }

    function tick() {
      var now=Date.now();
      if(active && !document.hidden && s.phase==='play') s.elapsed+=now-lastTick;
      lastTick=now;
      var node = mount.querySelector('[data-time]');
      if (node) { node.textContent = t('challenge.time') + ' ' + clock(s.elapsed); }
    }

    function start() {
      s.phase = 'play';
      s.startedAt = Date.now();
      s.elapsed = 0;
      s.assigned = {};
      s.picked = null;
      s.flagMode = false;
      s.message = null;
      render();
      syncClock();focus('[data-carton]:not(:disabled)');
    }

    function stop() {
      clearInterval(ticker);
      ticker = null;
      tick();
      s.phase = 'done';
      render();
      mount.querySelector('h3').tabIndex=-1;focus('h3');
    }

    mount.addEventListener('click', function (event) {
      var act = event.target.closest('[data-act]');
      if (act) {
        var name = act.getAttribute('data-act');
        if (name === 'start') { start(); return; }
        if (name === 'reset') { s.phase = 'idle'; syncClock();render();focus('[data-act=start]');return; }
        if (name === 'flag') { s.flagMode = !s.flagMode; render();focus('[data-act=flag]');return; }
      }

      var box = event.target.closest('[data-carton]');
      if (box && !box.disabled) {
        s.picked = box.getAttribute('data-carton');
        s.message = t('challenge.picked', { code: s.picked });
        render();
        focus('[data-act=flag]');
        return;
      }

      var line = event.target.closest('[data-line]');
      if (line && !line.disabled && s.picked) {
        if(CARTONS.find(function(c){return c.code===s.picked;}).line!==line.dataset.line) {
          s.message=t('challenge.wrongLine');render();focus('[data-line="'+line.dataset.line+'"]');return;
        }
        s.assigned[s.picked] = { line: line.getAttribute('data-line'), flagged: s.flagMode };
        s.message = t('challenge.matched', { code: s.picked });
        s.picked = null;
        s.flagMode=false;
        if (assignedCount() === CARTONS.length) { stop(); return; }
        render();
        focus('[data-carton]:not(:disabled)');
      }
    });

    return {
      render: render,
      setActive:function(value){tick();active=value;syncClock();},
      reset: function () { clearInterval(ticker); s.phase = 'idle'; render(); }
    };
  }

  global.Challenge = { create: create };
})(window);
