/* The three app simulations.
   Goods Received and Pallet Interlocking follow the real systems described in
   the two architecture maps: an inbound supplier receipt posted to SAP, and an
   outbound pallet verified two labels per carton against its packing list.
   PutAway is illustrative and marked as such, since no specification exists. */

(function (global) {
  'use strict';

  var t = function (key, vars) { return global.I18N.t(key, vars); };

  function esc(value) {
    return String(value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function barcodeBars(seed, count) {
    var out = '';
    var value = seed;
    for (var i = 0; i < count; i++) {
      value = (value * 1103515245 + 12345) % 2147483648;
      out += '<i style="width:' + (1 + (value % 3)) + 'px"></i>';
    }
    return out;
  }

  function scanner(code, flashing, idleKey) {
    return '<div class="scanner' + (flashing ? ' is-scanning' : '') + '">'
      + (code
        ? '<div class="scanner__bars">' + barcodeBars(code.length + 7, 26) + '</div>'
          + '<span class="scanner__code' + (flashing ? ' is-in' : '') + '">' + esc(code) + '</span>'
        : '<span class="scanner__idle">' + esc(t(idleKey)) + '</span>')
      + '</div>';
  }

  function field(labelKey, value, emptyKey) {
    var set = value !== null && value !== undefined && value !== '';
    return '<div class="field"><span class="field__label">' + esc(t(labelKey)) + '</span>'
      + '<span class="field__value ' + (set ? 'is-set' : 'is-empty') + '">'
      + esc(set ? value : t(emptyKey)) + '</span></div>';
  }

  /* ---------------------------------------------------------- Goods Received */

  var GR_LINES = [
    { material: 'C2030-WE', po: '4500912 / 10', spq: 24, boxes: 2 },
    { material: 'A9F5-BL', po: '4500912 / 20', spq: 24, boxes: 1 }
  ];
  /* What the supplier takes back on the same truck. Types are the real
     returnable codes from the box master. */
  var GR_EMPTIES = [
    { code: 'S00', qty: 12 },
    { code: 'K03', qty: 8 },
    { code: 'WPALLET', qty: 2 }
  ];
  var GR_SIGNS = ['receiver', 'guard', 'leader'];

  var GR_BOXES = [
    { sscc: '589352611036539718', line: 0 },
    { sscc: '589352611036539725', line: 0 },
    { sscc: '589352611036539732', line: 1 }
  ];

  function GoodsReceived(mount, onComplete) {
    var s;

    function reset() {
      s = { step: 1, session: null, docket: null, scanned: [], last: null, note: null, flash: false,
            empties: [], noteRef: null, signed: [] };
    }
    reset();

    function receivedOn(index) {
      return s.scanned.filter(function (b) { return b.line === index; }).length;
    }

    function render() {
      var steps = [1, 2, 3, 4, 5].map(function (n) {
        var cls = 'scr__step' + (n === s.step ? ' is-active' : '') + (n < s.step ? ' is-done' : '');
        return '<span class="' + cls + '">' + esc(t('gr.step.' + n)) + '</span>';
      }).join('');

      var lines = s.step === 5 ? s.empties.map(function (e) {
        return '<div class="line">'
          + '<span class="line__code">' + esc(e.code) + '</span>'
          + '<span class="line__qty">' + esc(t('gr.col.boxtype')) + '</span>'
          + '<span class="line__state">' + e.qty + '</span>'
          + '</div>';
      }).join('') : s.docket ? GR_LINES.map(function (line, index) {
        var got = receivedOn(index) * line.spq;
        var want = line.boxes * line.spq;
        return '<div class="line">'
          + '<span class="line__code">' + esc(line.material) + '</span>'
          + '<span class="line__qty">' + esc(line.po) + '</span>'
          + '<span class="line__state' + (got >= want ? '' : ' is-part') + '">' + got + ' / ' + want + '</span>'
          + '</div>';
      }).join('') : '';

      var actions = '';
      if (s.step === 1) {
        actions = '<button class="btn-screen" type="button" data-act="open">' + esc(t('gr.btn.open')) + '</button>';
      } else if (s.step === 2) {
        actions = '<button class="btn-screen" type="button" data-act="docket">' + esc(t('gr.btn.scanDo')) + '</button>';
      } else if (s.step === 3) {
        actions = '<button class="btn-screen" type="button" data-act="box">' + esc(t('gr.btn.scanBox')) + '</button>';
        if (s.scanned.length) {
          actions += '<button class="btn-screen-alt" type="button" data-act="dup">' + esc(t('gr.btn.rescan')) + '</button>';
        }
      } else if (s.step === 4) {
        actions = '<button class="btn-screen" type="button" data-act="finalize">' + esc(t('gr.btn.finalize')) + '</button>';
      } else if (s.empties.length < GR_EMPTIES.length) {
        actions = '<button class="btn-screen" type="button" data-act="empty">' + esc(t('gr.btn.empties')) + '</button>';
      } else if (!s.noteRef) {
        actions = '<button class="btn-screen" type="button" data-act="note">' + esc(t('gr.btn.note')) + '</button>';
      } else {
        actions = '<button class="btn-screen" type="button" data-act="sign">' + esc(t('gr.btn.sign')) + '</button>';
      }

      var signatures = s.noteRef
        ? '<div class="sigs">' + GR_SIGNS.map(function (role) {
            var done = s.signed.indexOf(role) !== -1;
            return '<span class="sig' + (done ? ' is-signed' : '') + '">'
              + '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">'
              + (done
                ? '<path d="M3 8.4l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
                : '<circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" stroke-width="1.6"/>')
              + '</svg>' + esc(t('gr.sig.' + role))
              + '</span>';
          }).join('') + '</div>'
        : '';

      mount.innerHTML =
        '<div class="scr">'
        + '<div class="scr__steps">' + steps + '</div>'
        + '<div class="scr__body">'
        +   field('gr.f.session', s.session, 'gr.empty')
        +   field('gr.f.supplier', s.session ? 'SOVI' : '', 'gr.empty')
        +   field('gr.f.truck', s.session ? '51D-97647' : '', 'gr.empty')
        +   field('gr.f.do', s.docket, 'gr.empty')
        +   scanner(s.last, s.flash, 'gr.scan.idle')
        +   (s.note ? '<p class="scr__note' + (s.note.bad ? ' is-bad' : '') + '">' + esc(s.note.text) + '</p>' : '')
        +   (s.step === 5 ? field('gr.f.note', s.noteRef, 'gr.empty') : '')
        +   '<div class="lines">' + lines + '</div>'
        +   signatures
        + '</div>'
        + '<div class="scr__foot"><p class="scr__hint">'
        +   esc(t('gr.hint.' + (s.step === 5 && s.noteRef ? 6 : s.step))) + '</p>' + actions + '</div>'
        + '</div>';

      s.flash = false;
    }

    mount.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-act]');
      if (!btn) { return; }
      var act = btn.getAttribute('data-act');
      s.note = null;

      if (act === 'open') {
        s.session = 'GR-2601-0148';
        s.step = 2;
      } else if (act === 'docket') {
        s.docket = 'DO-88413';
        s.last = 'DO-88413';
        s.flash = true;
        s.step = 3;
      } else if (act === 'box') {
        var next = GR_BOXES[s.scanned.length];
        if (!next) { return; }
        s.scanned.push(next);
        s.last = next.sscc;
        s.flash = true;
        if (s.scanned.length === GR_BOXES.length) { s.step = 4; }
      } else if (act === 'dup') {
        s.last = s.scanned[s.scanned.length - 1].sscc;
        s.flash = true;
        s.note = { text: t('gr.msg.dup'), bad: true };
      } else if (act === 'finalize') {
        s.step = 5;
      } else if (act === 'empty') {
        var next = GR_EMPTIES[s.empties.length];
        if (!next) { return; }
        s.empties.push(next);
        s.last = next.code;
        s.flash = true;
      } else if (act === 'note') {
        s.noteRef = 'RN-2601-0219';
        s.note = { text: t('gr.msg.note'), bad: false };
      } else if (act === 'sign') {
        s.signed.push(GR_SIGNS[s.signed.length]);
        if (s.signed.length === GR_SIGNS.length) {
          s.note = { text: t('gr.msg.signed'), bad: false };
          render();
          setTimeout(onComplete, 550);
          return;
        }
      }
      render();
    });

    return { render: render, reset: function () { reset(); render(); } };
  }

  /* ------------------------------------------------------ Pallet Interlocking */

  var PALLET_HU = '689352611035827974';
  var PACKING_LIST = [
    { box: '589352611036539718', ean: '19311554004511', product: 'C2030-WE' },
    { box: '589352611036539725', ean: '19311554004528', product: 'C2030-WE' },
    { box: '589352611036539732', ean: '19311554004535', product: 'A9F5-BL' }
  ];
  var WRONG_EAN = '19311554009999';

  function Interlocking(mount, onComplete) {
    var s;

    function reset() {
      s = { pallet: null, done: [], pending: null, last: null, status: null, flash: false, green: false };
    }
    reset();

    function isDone(box) { return s.done.indexOf(box) !== -1; }
    function nextBox() {
      for (var i = 0; i < PACKING_LIST.length; i++) {
        if (!isDone(PACKING_LIST[i].box)) { return PACKING_LIST[i]; }
      }
      return null;
    }

    function render() {
      var step = !s.pallet ? 1 : (s.done.length === PACKING_LIST.length ? 3 : 2);
      var steps = [1, 2, 3].map(function (n) {
        var cls = 'scr__step' + (n === step ? ' is-active' : '') + (n < step ? ' is-done' : '');
        return '<span class="' + cls + '">' + esc(t('il.step.' + n)) + '</span>';
      }).join('');

      var rows = s.pallet ? PACKING_LIST.map(function (item) {
        var state = isDone(item.box) ? 'done' : (s.pending === item.box ? 'await' : 'pending');
        return '<div class="line' + (state === 'done' ? '' : ' is-held') + '">'
          + '<span class="line__code">' + esc(item.box.slice(-8)) + '</span>'
          + '<span class="line__qty">' + esc(item.product) + '</span>'
          + '<span class="line__state">' + esc(t('il.state.' + state)) + '</span>'
          + '</div>';
      }).join('') : '';

      var actions = '';
      if (!s.pallet) {
        actions = '<button class="btn-screen" type="button" data-act="pallet">' + esc(t('il.btn.scanPallet')) + '</button>';
      } else if (s.done.length < PACKING_LIST.length) {
        actions = s.pending
          ? '<button class="btn-screen" type="button" data-act="ean">' + esc(t('il.btn.scanEan')) + '</button>'
            + '<button class="btn-screen-alt" type="button" data-act="wrong">' + esc(t('il.btn.wrong')) + '</button>'
          : '<button class="btn-screen" type="button" data-act="hu2">' + esc(t('il.btn.scanHu2')) + '</button>';
      } else {
        actions = '<button class="btn-screen" type="button" data-act="green">' + esc(t('il.btn.green')) + '</button>';
      }

      mount.innerHTML =
        '<div class="scr">'
        + '<div class="scr__steps">' + steps + '</div>'
        + '<div class="scr__body">'
        +   field('il.f.pallet', s.pallet, 'il.empty')
        +   '<div class="field"><span class="field__label">' + esc(t('il.f.progress')) + '</span>'
        +     '<span class="field__value">' + s.done.length + ' / ' + PACKING_LIST.length + '</span></div>'
        +   scanner(s.last, s.flash, 'gr.scan.idle')
        +   (s.status ? '<p class="scr__note' + (s.status.bad ? ' is-bad' : '') + '">' + esc(s.status.text) + '</p>' : '')
        +   '<div class="lines">' + rows + '</div>'
        + '</div>'
        + '<div class="scr__foot"><p class="scr__hint">' + esc(t('il.hint.' + step)) + '</p>' + actions + '</div>'
        + '</div>';

      s.flash = false;
    }

    mount.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-act]');
      if (!btn) { return; }
      var act = btn.getAttribute('data-act');

      if (act === 'pallet') {
        s.pallet = PALLET_HU;
        s.last = PALLET_HU;
        s.flash = true;
        s.status = null;
      } else if (act === 'hu2') {
        var item = nextBox();
        if (!item) { return; }
        s.pending = item.box;
        s.last = item.box;
        s.flash = true;
        s.status = { text: t('il.st.await'), bad: false };
      } else if (act === 'ean') {
        var match = PACKING_LIST.filter(function (x) { return x.box === s.pending; })[0];
        s.done.push(match.box);
        s.pending = null;
        s.last = match.ean;
        s.flash = true;
        s.status = { text: t('il.st.200'), bad: false };
      } else if (act === 'wrong') {
        s.last = WRONG_EAN;
        s.flash = true;
        s.status = { text: t('il.st.401'), bad: true };
      } else if (act === 'green') {
        if (s.done.length < PACKING_LIST.length) {
          s.status = { text: t('il.green.blocked'), bad: true };
          render();
          return;
        }
        s.green = true;
        onComplete();
        return;
      }
      render();
    });

    return { render: render, reset: function () { reset(); render(); } };
  }

  /* ------------------------------------------------------------------ PutAway */

  var OCCUPIED = ['A-01-01', 'A-02-01', 'A-05-01', 'A-01-03', 'A-04-03'];
  var SUGGESTED = 'A-03-02';

  function PutAway(mount, onComplete) {
    var s = { pallet: null, selected: null, justPlaced: false, flash: false };

    function render() {
      var bins = '';
      for (var level = 3; level >= 1; level--) {
        for (var bay = 1; bay <= 5; bay++) {
          var code = 'A-0' + bay + '-0' + level;
          var occupied = OCCUPIED.indexOf(code) !== -1;
          var cls = 'bin';
          if (occupied) { cls += ' is-occupied'; }
          if (!occupied && s.pallet && code === SUGGESTED && s.selected !== code) { cls += ' is-suggested'; }
          if (s.selected === code) { cls += ' is-selected'; }
          bins += '<button class="' + cls + '" type="button" data-bin="' + code + '"'
            + (occupied || !s.pallet ? ' disabled' : '') + '>' + code
            + (s.selected === code ? '<span class="bin__pallet' + (s.justPlaced ? ' is-in' : '') + '"></span>' : '')
            + '</button>';
        }
      }

      var hint = !s.pallet ? 'pa.hint.1' : (s.selected ? 'pa.hint.3' : 'pa.hint.2');
      var action = !s.pallet
        ? '<button class="btn-screen" type="button" data-act="scan">' + esc(t('pa.btn.scan')) + '</button>'
        : '<button class="btn-screen" type="button" data-act="confirm"' + (s.selected ? '' : ' disabled') + '>'
          + esc(t('pa.btn.confirm')) + '</button>';

      mount.innerHTML =
        '<div class="scr">'
        + '<div class="scr__body">'
        +   field('pa.f.pallet', s.pallet, 'pa.empty')
        +   field('pa.f.bin', s.selected, 'pa.empty')
        +   scanner(s.pallet, s.flash, 'gr.scan.idle')
        +   '<div class="rack">' + bins + '</div>'
        +   '<div class="rack__legend">'
        +     '<span><i></i>' + esc(t('pa.legend.free')) + '</span>'
        +     '<span class="k-suggest"><i></i>' + esc(t('pa.legend.suggested')) + '</span>'
        +     '<span><i class="k-taken"></i>' + esc(t('pa.legend.taken')) + '</span>'
        +   '</div>'
        + '</div>'
        + '<div class="scr__foot"><p class="scr__hint">' + esc(t(hint)) + '</p>' + action + '</div>'
        + '</div>';

      s.flash = false;
      s.justPlaced = false;
    }

    mount.addEventListener('click', function (event) {
      var bin = event.target.closest('[data-bin]');
      if (bin && !bin.disabled) {
        s.selected = bin.getAttribute('data-bin');
        s.justPlaced = true;
        render();
        return;
      }
      var btn = event.target.closest('[data-act]');
      if (!btn || btn.disabled) { return; }
      if (btn.getAttribute('data-act') === 'scan') {
        s.pallet = 'PL-004182';
        s.flash = true;
        render();
      } else if (btn.getAttribute('data-act') === 'confirm') {
        onComplete(s.selected);
      }
    });

    return {
      render: render,
      reset: function () {
        s = { pallet: null, selected: null, justPlaced: false, flash: false };
        render();
      }
    };
  }

  global.Demos = {
    create: function (app, mount, onComplete) {
      if (app === 'gr') { return GoodsReceived(mount, onComplete); }
      if (app === 'interlock') { return Interlocking(mount, onComplete); }
      if (app === 'putaway') { return PutAway(mount, onComplete); }
      return null;
    },
    suggestedBin: SUGGESTED
  };
})(window);
