/* Wiring: theme, language, the opening sequence, the hero scan, the three
   stations, the flow board and the finale. */

(function () {
  'use strict';

  var t = function (key, vars) { return window.I18N.t(key, vars); };
  var State = window.WarehouseState;

  var demos = {};
  var challenge = null;
  var lastBin = window.Demos.suggestedBin;
  var hero = null;

  /* ------------------------------------------------------------- Theme */

  function initTheme() {
    var toggle = document.getElementById('theme-toggle');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');

    toggle.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var toggle = document.getElementById('theme-toggle');
    var label = document.getElementById('theme-label');
    toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    label.setAttribute('data-i18n', theme === 'dark' ? 'theme.toLight' : 'theme.toDark');
    label.textContent = t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark');
    syncToolLabels();
  }

  /* The two header buttons drop their visible labels on narrow screens, where
     there is no room for them beside the brand. Mirror whatever the label
     currently says onto aria-label so the button keeps its name either way. */
  function syncToolLabels() {
    ['theme-toggle', 'lang-toggle'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) { return; }
      var span = btn.querySelector('span');
      if (span && span.textContent.trim()) { btn.setAttribute('aria-label', span.textContent.trim()); }
    });
  }

  /* ---------------------------------------------------------- Language */

  function initLanguage() {
    document.getElementById('lang-toggle').addEventListener('click', function () {
      window.I18N.setLanguage(window.I18N.getLanguage() === 'vi' ? 'en' : 'vi');
    });

    document.addEventListener('languagechange', function () {
      Object.keys(demos).forEach(function (key) { demos[key].render(); });
      if (challenge) { challenge.render(); }
      buildTeam();
      updateProgressLabel();
      updateFinaleBody();
      setTheme(document.documentElement.getAttribute('data-theme'));
      if (hero) { hero.relabel(); }
      if (twin) { twin.relabel(appLabels()); twin.hideTip(); }
      syncToolLabels();
      paintDots();
    });
  }

  /* -------------------------------------------------------- Hero scan */

  function drawCartonLabel() {
    var bars = document.getElementById('carton-bars');
    var matrix = document.getElementById('carton-matrix');
    var out = '';
    var x = 166;
    var seed = 7;
    for (var i = 0; i < 22 && x < 214; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      var w = 1 + (seed % 3);
      out += '<rect x="' + x + '" y="96" width="' + w + '" height="26"/>';
      x += w + 1 + (seed % 2);
    }
    bars.innerHTML = out;

    // A stylised data matrix. It is a graphic, not a readable code.
    var cells = '';
    var value = 91;
    for (var row = 0; row < 8; row++) {
      for (var col = 0; col < 8; col++) {
        value = (value * 1103515245 + 12345) % 2147483648;
        var on = (row === 0 || col === 0 || row === 7 || col === 7)
          ? ((row + col) % 2 === 0)
          : (value % 100 > 46);
        if (on) {
          cells += '<rect x="' + (222 + col * 5) + '" y="' + (96 + row * 5) + '" width="4.4" height="4.4"/>';
        }
      }
    }
    matrix.innerHTML = cells;
  }

  function initHeroScan() {
    var btn = document.getElementById('scan-btn');
    var beam = document.getElementById('scan-beam');
    var status = document.getElementById('scan-status');
    var out = document.getElementById('scan-out');
    var scanned = false;
    var idleTimer = null;

    function sweep() {
      beam.classList.remove('is-on');
      void beam.offsetWidth;
      beam.classList.add('is-on');
    }

    function reveal() {
      scanned = true;
      stopIdle();
      status.setAttribute('data-i18n', 'hero.state.ok');
      status.textContent = t('hero.state.ok');
      status.classList.add('is-verified');
      out.hidden = false;
      out.innerHTML = [
        ['hero.f.asset', 'BX-00001'],
        ['hero.f.item', 'SE-A4021-88'],
        ['hero.f.po', 'PO-4500912'],
        ['hero.f.qty', '24'],
        ['hero.f.state', t('hero.state.ok')]
      ].map(function (pair, i) {
        return '<div class="scanbox__row" style="animation-delay:' + (i * 55) + 'ms">'
          + '<dt>' + t(pair[0]) + '</dt><dd class="mono">' + pair[1] + '</dd></div>';
      }).join('');
      btn.setAttribute('data-i18n', 'hero.again');
      btn.textContent = t('hero.again');
    }

    var reticle = document.querySelector('.reticle');

    function startIdle() {
      if (reticle && !window.Forklift.prefersReducedMotion()) { reticle.classList.add('is-live'); }
      // The label keeps catching the light until someone scans it. It stops
      // for good on the first tap, and never runs under reduced motion.
      if (window.Forklift.prefersReducedMotion()) { return; }
      stopIdle();
      idleTimer = setInterval(function () {
        if (!scanned) { sweep(); }
      }, 6000);
    }

    function stopIdle() {
      if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
      if (reticle) { reticle.classList.remove('is-live'); }
    }

    btn.addEventListener('click', function () {
      stopIdle();
      if (window.Forklift.prefersReducedMotion()) { reveal(); return; }
      status.textContent = t('hero.scanning');
      sweep();
      btn.disabled = true;
      setTimeout(function () {
        btn.disabled = false;
        reveal();
      }, 700);
    });

    hero = {
      sweep: sweep,
      startIdle: startIdle,
      relabel: function () { if (scanned) { reveal(); } }
    };
  }

  /* ------------------------------------------------------- Booth stage */

  var twin = null;

  var PREFIX = { gr: 'gr', interlock: 'il', putaway: 'pa' };

  /* What the hover card says about a station. Words come from the dictionary
     so the card follows the language switch like everything else. */
  function describeStation(app) {
    var p = PREFIX[app];
    if (!p) { return null; }
    return {
      step: t('app.station', { n: State.apps.indexOf(app) + 1 }),
      name: t(p + '.name'),
      role: t(p + '.role'),
      action: t('twin.hint'),
      done: State.isDone(app)
    };
  }

  function appLabels() {
    return { gr: t('gr.name'), interlock: t('il.name'), putaway: t('pa.name') };
  }

  function initStage() {
    var stage = document.getElementById('twin-stage');
    if (!stage) { return; }
    twin = window.Twin.create(stage, {
      text: t,
      labels: appLabels(),
      description: t('twin.alt'),
      reducedMotion: window.Forklift.prefersReducedMotion(),
      onNodeClick: openStation,
      describe: describeStation
    });
  }

  /* A node on the plan drives straight to that station's view. */
  function openStation(app) {
    window.Router.go(app);
  }

  function flashWipe() {
    var wipe = document.getElementById('wipe');
    if (!wipe || window.Forklift.prefersReducedMotion()) { return; }
    wipe.classList.remove('is-on');
    void wipe.offsetWidth;
    wipe.classList.add('is-on');
  }

  /* --------------------------------------------------- Opening sequence */

  function runIntro() {
    if (window.Forklift.prefersReducedMotion()) { return; }

    // One orchestrated moment on load: the hero settles, the label is read,
    // and a forklift crosses the floor. The warehouse actors run independently.
    document.body.classList.add('is-intro');
    setTimeout(function () { hero.sweep(); }, 700);
    setTimeout(function () { window.Forklift.run(); }, 1100);
    setTimeout(function () { hero.startIdle(); }, 2600);

    // The dock runs on its own loop now, so nothing needs starting here.
  }

  /* ------------------------------------------------------- The stations */

  function mountDemo(app) {
    var terminal = document.getElementById('terminal-' + app);
    if (!terminal) { return; }
    var mount = terminal.querySelector('[data-mount]');
    if (!demos[app]) {
      demos[app] = window.Demos.create(app, mount, function (bin) {
        if (app === 'putaway' && bin) { lastBin = bin; }
        finishStation(app);
      });
    }
    demos[app].render();
  }

  function initRouter() {
    window.Router.onChange(function (id) {
      if (twin) { twin.setActive(id === 'home'); }
      if (id === 'gr' || id === 'interlock' || id === 'putaway') { mountDemo(id); }
      paintBoard();
    });
    window.Router.init();
  }

  function finishStation(app) {
    if (!State.complete(app)) { return; }

    var view = document.getElementById('view-' + app);
    var stamp = view && view.querySelector('[data-stamp]');
    if (stamp) {
      stamp.hidden = false;
      stamp.classList.remove('is-in');
      void stamp.offsetWidth;
      stamp.classList.add('is-in');
    }

    flashWipe();

    // Finishing the last station sends the sealed container out of the yard.
    if (app === 'interlock' && twin) { twin.departTruck(); }

    window.Forklift.run().then(function () {
      if (State.allDone()) { openFinale(); }
    });
  }

  /* -------------------------------------------------- Progress and flow */

  function updateProgressLabel() {
    var label = document.getElementById('progress-label');
    var n = State.count();
    label.textContent = n === 0 ? t('progress.none')
      : (n === 3 ? t('progress.all') : t('progress.some', { done: n }));
  }

  function paintDots() {
    var done = State.apps.map(function (app) { return State.isDone(app); });
    document.querySelectorAll('[data-dots]').forEach(function (group) {
      group.innerHTML = done.map(function (isDone) {
        return '<span class="dots__dot' + (isDone ? ' is-filled' : '') + '"></span>';
      }).join('');
    });
    document.querySelectorAll('[data-station-label]').forEach(function (node) {
      node.textContent = t('app.station', { n: node.getAttribute('data-station-label') });
    });
  }

  function paintBoard() {
    paintDots();
    State.apps.forEach(function (app) {
      var done = State.isDone(app);
      var seg = document.querySelector('.progress__seg[data-seg="' + app + '"]');
      if (seg) { seg.classList.toggle('is-filled', done); }

      var step = document.querySelector('.flow__step[data-flow="' + app + '"]');
      if (step) {
        step.classList.toggle('is-done', done);
        var state = step.querySelector('[data-flow-state]');
        state.setAttribute('data-i18n', done ? 'flow.state.done' : 'flow.state.waiting');
        state.textContent = t(done ? 'flow.state.done' : 'flow.state.waiting');
      }
    });
    updateProgressLabel();
    if (twin) {
      twin.setProgress(State.apps.filter(function (app) { return State.isDone(app); }));
    }
  }

  /* --------------------------------------------------------- The finale */

  function updateFinaleBody() {
    document.getElementById('finale-body').textContent = t('finale.body', { bin: lastBin });
  }

  function openFinale() {
    var overlay = document.getElementById('finale');
    updateFinaleBody();
    overlay.hidden = false;
    overlay.classList.remove('is-open');
    void overlay.offsetWidth;
    overlay.classList.add('is-open');
    document.getElementById('finale-close').focus();
    document.addEventListener('keydown', onEscape);
  }

  function closeFinale() {
    var overlay = document.getElementById('finale');
    overlay.hidden = true;
    overlay.classList.remove('is-open');
    document.removeEventListener('keydown', onEscape);
    window.Router.go('home', { instant: true });
  }

  function onEscape(event) {
    if (event.key === 'Escape') { closeFinale(); }
  }

  function resetAll() {
    State.reset();
    Object.keys(demos).forEach(function (app) { demos[app].reset(); });
    document.querySelectorAll('[data-stamp]').forEach(function (stamp) {
      stamp.hidden = true;
      stamp.classList.remove('is-in');
    });
    lastBin = window.Demos.suggestedBin;
    closeFinale();
    ['shipping'].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) { node.style.animationDelay = ''; }
    });
  }

  /* ------------------------------------------------------------- Team */

  function buildTeam() {
    var list = document.getElementById('team-list');
    if (!list) { return; }
    // Real names, not numbered placeholders, and the same five that stand on
    // the plan. Roles and links are still blanks for the team to fill in.
    var names = (twin && twin.members) ? twin.members()
      : ['Sơn', 'Ngân', 'Minh', 'Trí', 'Bách'];
    list.innerHTML = names.map(function (name) {
      return '<li class="team__card">'
        + '<span class="team__slot">' + name + '</span>'
        + '<span class="team__role">' + t('team.role') + '</span>'
        + '<span class="team__link">' + t('team.link') + '</span>'
        + '</li>';
    }).join('');
  }

  /* --------------------------------------------------- Header height */

  /* Every full screen view offsets itself by --topbar-h. CSS declares 62px,
     56px narrow, and the header is styled to fit that. This measures the bar
     as actually rendered and corrects the token if a translation, a font
     fallback or a zoom level makes it taller, so the views can never end up
     tucked underneath it. */
  function trackHeaderHeight() {
    var bar = document.querySelector('.topbar');
    if (!bar) { return; }
    var apply = function () {
      document.documentElement.style.setProperty('--topbar-h', Math.round(bar.getBoundingClientRect().height) + 'px');
    };
    apply();
    if (window.ResizeObserver) { new ResizeObserver(apply).observe(bar); }
    else { window.addEventListener('resize', apply); }
    document.addEventListener('languagechange', apply);
  }

  /* Fit the corner caption inside the canvas without changing its anchor.
     Measuring the translated copy also keeps the diagram clear on phones. */
  function fitHomeCanvas() {
    var canvas = document.getElementById('twin');
    var copy = canvas.querySelector('.stage-overlay');
    var head = canvas.querySelector('.twin__head');
    function fit() {
      if (!canvas.clientWidth || !canvas.clientHeight) { return; }
      var style = getComputedStyle(copy);
      var left = parseFloat(style.left) || 12;
      var bottom = parseFloat(style.bottom) || 12;
      var headHeight = head.offsetTop + head.offsetHeight + left;
      var scale = Math.min(1,
        (canvas.clientWidth - left * 2) / Math.max(1, copy.offsetWidth),
        (canvas.clientHeight - headHeight - bottom) / Math.max(1, copy.offsetHeight));
      scale = Math.max(.05, scale);
      copy.style.setProperty('--copy-scale', scale);
      canvas.style.setProperty('--copy-height', (copy.offsetHeight * scale) + 'px');
      canvas.style.setProperty('--scene-head-height', headHeight + 'px');
    }
    fit();
    if (window.ResizeObserver) {
      var observer = new ResizeObserver(fit);
      [canvas, copy, head].forEach(function (node) { observer.observe(node); });
    } else { window.addEventListener('resize', fit); }
    document.addEventListener('languagechange', fit);
    window.Router.onChange(function (id) { if (id === 'home') { fit(); } });
  }

  /* ------------------------------------------------------------- Start */

  document.addEventListener('DOMContentLoaded', function () {
    window.I18N.setLanguage('vi');
    initTheme();
    initLanguage();
    drawCartonLabel();
    initStage();
    initHeroScan();
    buildTeam();

    challenge = window.Challenge.create(document.getElementById('challenge-mount'));
    challenge.render();

    State.subscribe(paintBoard);
    paintBoard();

    document.getElementById('finale-close').addEventListener('click', closeFinale);
    document.getElementById('finale-again').addEventListener('click', function () {
      resetAll();
      window.Router.go('gr');
    });
    var reset = document.getElementById('reset-all');
    if (reset) { reset.addEventListener('click', resetAll); }

    initRouter();
    trackHeaderHeight();
    fitHomeCanvas();

    runIntro();
  });
})();
