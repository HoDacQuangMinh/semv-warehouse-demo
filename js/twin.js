/* The reference floor plan: two rack banks between container docks, opposite
   Goods Received, the wrapping station, and returnable crates across one aisle.
   SVG geometry keeps the plan sharp while retaining the existing map controls. */

(function (global) {
  'use strict';

  // Isometric projection. Plan coordinates go in, screen coordinates come out.
  var COS = 0.866, SIN = 0.5, SCALE = 6.1, OX = 430, OY = 74;

  function p(x, y, z) {
    var sx = (x - y) * COS * SCALE + OX;
    var sy = (x + y) * SIN * SCALE - (z || 0) * SCALE + OY;
    return sx.toFixed(1) + ',' + sy.toFixed(1);
  }

  function pt(x, y, z) {
    return p(x, y, z).split(',').map(Number);
  }

  function poly(points, cls) {
    return '<polygon class="' + cls + '" points="' + points.join(' ') + '"/>';
  }

  /* A box standing on the floor at height z0, drawn as three faces. */
  function box(x, y, w, d, h, kind, z0) {
    var base = z0 || 0;
    var top = base + h;
    var out = poly([p(x, y, top), p(x + w, y, top), p(x + w, y + d, top), p(x, y + d, top)], 'iso-' + kind + '-top')
      + poly([p(x + w, y, top), p(x + w, y + d, top), p(x + w, y + d, base), p(x + w, y, base)], 'iso-' + kind + '-right')
      + poly([p(x, y + d, top), p(x + w, y + d, top), p(x + w, y + d, base), p(x, y + d, base)], 'iso-' + kind + '-left');
    return /^(rack|container-|tote-|table|film)/.test(kind)
      ? '<g class="iso-material iso-material--' + kind + '">' + out + '</g>' : out;
  }

  var W = 112, D = 66;          // hall footprint in plan units
  var AISLE = 33;               // the aisle everything runs along
  var NODES = [
    { app: 'gr', x: 30, y: 40, num: '01', area: [10, 42, 26, 22] },
    { app: 'putaway', x: 56, y: 27, num: '02', area: [22, 2, 65, 27] },
    { app: 'interlock', x: 58, y: 43, num: '03', area: [38, 42, 42, 22] }
  ];


  /* Paint on the floor: the walking lane, the aisle edges, and hazard
     chevrons across the dock approach. */
  function floorMarks() {
    var out = zone(0, 29, W, 12, 'iso-main-aisle');
    out += zone(45, 0, 11, 29, 'iso-main-aisle');
    out += zone(15, 0, 7, 29, 'iso-main-aisle');
    out += zone(88, 0, 9, 29, 'iso-main-aisle');
    [[22, 19, 23, 3], [59, 19, 28, 3], [10, 62, 27, 3]].forEach(function (a) {
      out += zone(a[0], a[1], a[2], a[3], 'iso-pedestrian-strip');
    });
    out += '<path class="iso-lane" d="M' + p(0, 29, .8) + 'L' + p(W, 29, .8)
      + 'M' + p(0, 41, .8) + 'L' + p(W, 41, .8) + '"/>';
    [[22, 22, 22, 6], [59, 22, 28, 6], [11, 45, 12, 16], [25, 45, 11, 16],
      [85, 47, 11, 15], [98, 47, 11, 15]].forEach(function (a) {
      out += palletPad(a[0], a[1], a[2], a[3]);
    });
    return out;
  }

  function palletPad(x, y, w, d) {
    var out = zone(x, y, w, d, 'iso-pallet-pad');
    var slats = '';
    for (var sy = y + 1; sy < y + d; sy += 1.8) {
      slats += 'M' + p(x + .7, sy, .85) + 'L' + p(x + w - .7, sy, .85);
    }
    return out + '<path class="iso-pallet-slats" d="' + slats + '"/>';
  }

  /* High bay lighting: a fitting overhead and the pool it throws. */
  function lighting() {
    var out = '<defs><radialGradient id="pool" cx="50%" cy="50%" r="50%">'
      + '<stop offset="0%" class="pool-in"/><stop offset="100%" class="pool-out"/>'
      + '</radialGradient></defs>';
    [[20, 20], [56, 20], [92, 20], [20, 48], [56, 48], [92, 48]].forEach(function (c) {
      var s = pt(c[0], c[1], 0.76);
      out += '<ellipse class="iso-pool" cx="' + s[0] + '" cy="' + s[1] + '" rx="86" ry="50"/>';
    });
    return out;
  }

  function floorPlate() {
    var out = box(0, 0, W, D, 0.7, 'floor');
    var lines = [];
    for (var gx = 0; gx <= W; gx += 8) {
      lines.push('M' + p(gx, 0, 0.72) + 'L' + p(gx, D, 0.72));
    }
    for (var gy = 0; gy <= D; gy += 8) {
      lines.push('M' + p(0, gy, 0.72) + 'L' + p(W, gy, 0.72));
    }
    return out + '<path class="iso-grid" d="' + lines.join('') + '"/>';
  }

  function zone(x, y, w, d, cls) {
    return poly([p(x, y, 0.75), p(x + w, y, 0.75), p(x + w, y + d, 0.75), p(x, y + d, 0.75)], cls);
  }

  /* Painter's algorithm: in this projection a larger (x + y) is nearer the
     viewer, so a shape with a larger centre sum must be drawn later or it will
     be painted over by something behind it. */
  function paint(specs) {
    return specs.slice().sort(function (a, b) {
      var ka = (a[0] + a[2] / 2) + (a[1] + a[3] / 2);
      var kb = (b[0] + b[2] / 2) + (b[1] + b[3] / 2);
      if (ka !== kb) { return ka - kb; }
      return (a[6] || 0) - (b[6] || 0);
    }).map(function (s) {
      return box(s[0], s[1], s[2], s[3], s[4], s[5], s[6]);
    }).join('');
  }

  /* A wheel is a circle standing in the x-z plane, so it has to be built from
     projected points rather than an <ellipse>: the two screen axes are not
     perpendicular, so an axis aligned ellipse would look wrong. */
  function discX(cx, cy, cz, r, cls) {
    var pts = [];
    for (var i = 0; i < 18; i++) {
      var a = i / 18 * Math.PI * 2;
      pts.push(p(cx + r * Math.cos(a), cy, cz + r * Math.sin(a)));
    }
    return '<polygon class="' + cls + '" points="' + pts.join(' ') + '"/>';
  }

  function wheels(list) {
    return list.map(function (w) {
      return '<g class="iso-wheel">'
        + discX(w[0], w[1], w[2], w[3], 'iso-tyre-disc')
        + '<g class="iso-wheel-spin">'
        +   discX(w[0], w[1], w[2], w[3] * 0.42, 'iso-hub-disc')
        +   '<path class="iso-spoke" d="M' + p(w[0] - w[3] * 0.7, w[1], w[2])
        +     'L' + p(w[0] + w[3] * 0.7, w[1], w[2]) + '"/>'
        + '</g>'
        + '</g>';
    }).join('');
  }

  var VEH_W = 6;      // across the vehicle
  var VEH_LEN = 13;   // trailer length

  /* A shipping container: ribbed sides, a door pair on the visible end, and a
     corner casting at each end, which is what separates it from a plain box. */
  function containerBody(ox, oy, kind, z0) {
    var base = z0 || 0;
    // Open rear and low rails let the fork enter the bed and the carried
    // pallet remain visible. The truck no longer has a solid cargo block.
    var specs = [[ox,oy,VEH_LEN,VEH_W,.2,kind,base],
      [ox,oy,.35,VEH_W,4.5,kind,base+.2],
      [ox,oy,VEH_LEN,.26,1.2,kind,base+.2],
      [ox,oy+VEH_W-.26,VEH_LEN,.26,1.2,kind,base+.2]];
    for(var i=1;i<9;i++) {
      specs.push([ox+i*1.4,oy+VEH_W-.1,.24,.2,1.1,'rib',base+.2]);
    }
    specs.push([ox,oy+VEH_W-.3,VEH_LEN,.35,.18,'rib',base+1.4]);
    return specs;
  }

  /* A tractor unit plus its trailer. */
  function truck(ox, oy) {
    var specs = [];
    // chassis rail
    specs.push([ox + 0.4, oy + 0.7, VEH_LEN - 0.8, VEH_W - 1.4, 0.7, 'tyre', 1.4]);
    // cab, set slightly narrower than the trailer
    specs.push([ox - 4.7, oy + 0.5, 4.3, VEH_W - 1, 4.7, 'cab', 2.1]);
    specs.push([ox - 4.8, oy + VEH_W - 0.6, 3.5, 0.3, 1.9, 'glass', 4.5]);
    specs.push([ox - 1.5, oy + 0.6, 0.4, VEH_W - 1.2, 2.2, 'tyre', 4.4]);   // exhaust stack
    // trailer
    return {
      specs: specs.concat(containerBody(ox, oy, 'cont', 2.1)),
      wheels: [2.4, 4.4, 10.6, -3.9].map(function (dx) {
        return [ox + dx + 0.85, oy + VEH_W - 0.12, 0.85, 0.85];
      })
    };
  }

  /* A stack of empty returnable crates, waiting to go back on the truck. */
  function emptyStack(x, y, layers) {
    var specs = [[x - 0.1, y - 0.1, 2.8, 2.6, 0.3, 'rib', 0]];
    for (var i = 0; i < layers; i++) {
      specs.push([x, y, 2.6, 2.4, 1.1, 'empties', 0.3 + i * 1.15]);
    }
    return specs;
  }

  /* A pallet with cartons on it. */
  function palletStack(x, y, layers) {
    var specs = [[x - 0.1, y - 0.1, 2.8, 2.6, 0.3, 'rib', 0]];
    for (var i = 0; i < layers; i++) {
      specs.push([x, y, 2.6, 2.4, 1.5, 'load', 0.3 + i * 1.5]);
    }
    return specs;
  }

  /* Ribbed container docks bookend the two open rack banks. The front end
     stays open so the loading aisle and receiving shutter remain visible. */
  function freightContainer(x, kind, receiving) {
    var y = 1, w = 13, d = 26, h = 14;
    var specs = [
      [x, y, w, d, .6, kind, .7],
      [x, y, .65, d, h, kind, .7],
      [x + w - .65, y, .65, d, h, kind, .7],
      [x, y, w, .65, h, kind, .7],
      [x, y, w, d, .6, kind, h + .7]
    ];
    for (var rib = 1.5; rib < d; rib += 1.6) {
      specs.push([x + w - .4, y + rib, .6, .35, h, kind, .7]);
      specs.push([x, y + rib, w, .3, .3, kind, h + 1.3]);
    }
    var out = '<g class="iso-freight-container" data-container="' + (receiving ? 'receiving' : 'shipping') + '">'
      + paint(specs);
    out += box(x - 3.4, y + d - .2, 3.5, .5, h, kind, .7);
    out += box(x + w - .1, y + d - .2, 3.5, .5, h, kind, .7);
    if (receiving) { out += dockGate(x + 2.5, y + d); }
    return out + '</g>';
  }

  function dockGate(x, y) {
    var opening = [p(x, y, 8), p(x + 8, y, 8), p(x + 8, y + .6, 8),
      p(x + 8, y + .6, 0), p(x, y + .6, 0), p(x, y + .6, 8)];
    var slats = '';
    for (var z = 1; z < 8; z++) {
      slats += 'M' + p(x, y + .61, z) + 'L' + p(x + 8, y + .61, z);
    }
    return '<g class="iso-dock-doorway">'
      + '<defs><clipPath id="dock-gate-opening" clipPathUnits="userSpaceOnUse">'
      + poly(opening, '') + '</clipPath></defs>'
      + box(x, y, 8, .6, 8, 'doorway')
      + '<g clip-path="url(#dock-gate-opening)"><g class="iso-dock-gate" id="dock-gate">'
      + box(x, y, 8, .6, 8, 'shadow')
      + '<path class="iso-gate-slat" d="' + slats + '"/></g></g></g>';
  }


  /* Open orange shelves, with separate uprights and diagonal end bracing.
     Keeping the bays hollow makes them read as the reference's racks. */
  function rackBank(x) {
    var y = 3, w = 21, d = 14, h = 16;
    var rear = [], front = [], shelves = '';
    [0, w / 2, w].forEach(function (dx) {
      rear.push([x + dx, y, .7, .7, h, 'rack-post', .7]);
      front.push([x + dx, y + d, .7, .7, h, 'rack-post', .7]);
    });
    [6.7, 10.5, 15.5].forEach(function (z, level) {
      shelves += '<g data-rack-level="' + ['lower','upper','top'][level] + '">';
      [0, w / 2].forEach(function (dx) {
        shelves += box(x + dx + .7, y + .7, w / 2 - .7, d - .7, .4, 'rack', z);
        shelves += box(x + dx, y + d, w / 2, .7, .85, 'rack', z - .4);
      });
      shelves += '</g>';
    });
    var braces = '';
    [x + w].forEach(function (cx) {
      [1.2, 6.2, 11.2].forEach(function (z) {
        braces += 'M' + p(cx + .8, y + .5, z) + 'L' + p(cx + .8, y + d, z + 4.1)
          + 'M' + p(cx + .8, y + d, z) + 'L' + p(cx + .8, y + .5, z + 4.1);
      });
    });
    return '<g class="iso-rack-bank">' + palletPad(x - 1, y - 1, w + 3, d + 3)
      + paint(rear) + shelves + paint(front) + '<path class="iso-rack-brace" d="' + braces + '"/></g>';
  }

  /* Stackable totes have an open rim and side ribs, unlike solid cartons. */
  function toteStack(x, y, layers, kind, w, d) {
    var out = box(x, y, w, d, .45, 'rib', .9);
    for (var layer = 0; layer < layers; layer++) {
      var z = 1.35 + layer * 2.4;
      out += box(x, y, w, d, 1.9, kind, z);
      out += poly([p(x + .5, y + .5, z + 1.91), p(x + w - .5, y + .5, z + 1.91),
        p(x + w - .5, y + d - .5, z + 1.91), p(x + .5, y + d - .5, z + 1.91)], 'iso-tote-opening');
      out += paint([[x, y, w, .32, .4, kind, z + 1.9], [x, y + d - .32, w, .32, .4, kind, z + 1.9],
        [x, y, .32, d, .4, kind, z + 1.9], [x + w - .32, y, .32, d, .4, kind, z + 1.9]]);
      var ribs = '';
      for (var dx = 1; dx < w; dx += 1.5) {
        ribs += 'M' + p(x + dx, y + d + .01, z + .15) + 'L' + p(x + dx, y + d + .01, z + 1.7);
      }
      out += '<path class="iso-tote-rib" d="' + ribs + '"/>';
    }
    return out;
  }

  function goodsReceived() {
    var out = '<g data-layout-area="gr">';
    // Two blocks of stacked totes: pale on the left, dark on the right.
    [[12, 'tote-cream', 5], [26, 'tote-dark', 4]].forEach(function (stack) {
      [47, 53].forEach(function (y) {
        [0, 5].forEach(function (dx) { out += toteStack(stack[0] + dx, y, stack[2], stack[1], 4.6, 5.4); });
      });
    });
    return out + '</g>';
  }

  function returnables() {
    return '<g data-layout-area="returnables">'
      + toteStack(86, 48, 4, 'tote-green', 4.3, 5.2)
      + toteStack(91, 48, 4, 'tote-red', 4.3, 5.2)
      + toteStack(86, 54, 4, 'tote-yellow', 4.3, 5.2)
      + '</g>';
  }

  function table(x, y, w, d) {
    var specs = [[x, y, w, d, .55, 'table', 4.5]];
    [[x + .4, y + .4], [x + w - .9, y + .4], [x + .4, y + d - .9], [x + w - .9, y + d - .9]].forEach(function (leg) {
      specs.push([leg[0], leg[1], .5, .5, 3.8, 'steel', .7]);
    });
    return paint(specs);
  }

  function discZ(x, y, z, radius, cls) {
    var points = [];
    for (var i = 0; i < 48; i++) {
      var a = i * Math.PI / 24;
      points.push(p(x + radius * Math.cos(a), y + radius * Math.sin(a), z));
    }
    return poly(points, cls);
  }

  function packArea() {
    var out = '<g data-layout-area="interlock">';
    out += '<g class="iso-l-table">' + table(40, 49, 4, 13) + table(44, 58, 8, 4) + '</g>';
    // Circular wrapping turntable, tall yellow mast, and the film carriage.
    out += '<g class="iso-wrapper">'
      + discZ(63, 53, 1, 7.2, 'iso-wrapper-base')
      + discZ(63, 53, 1.7, 7.2, 'iso-wrapper-top')
      + discZ(63, 53, 1.72, 2.1, 'iso-wrapper-hub')
      + paint([[70, 49, 5, 8, .8, 'machine', .7], [71, 50, 3.2, 4, 23, 'machine', 1.5],
        [69.8, 50.5, 1, 3, 7, 'steel', 6], [68.7, 51, 1.1, 2.3, 5.8, 'film', 6.6]])
      + '</g></g>';
    return out;
  }

  function layoutLabels(text) {
    var labels = [
      [37, 45, '01 · GR', 'gr'], [57, 19, '02 · PutAway', 'putaway'],
      [63, 64, '03 · Pallet Interlocking', 'interlock'], [97, 65, text('twin.returnables'), 'returnables']
    ];
    return '<g class="iso-area-labels" aria-hidden="true">' + labels.map(function (label) {
      var c = pt(label[0], label[1], 1);
      return '<text class="iso-area-label" data-area-label="' + label[3] + '" x="' + c[0] + '" y="' + c[1] + '">' + escapeHtml(label[2]) + '</text>';
    }).join('') + '</g>';
  }

  function route() {
    var d = 'M' + p(30, 40, .8) + 'L' + p(30, AISLE, .8)
      + 'L' + p(56, AISLE, .8) + 'L' + p(56, 27, .8)
      + 'M' + p(56, AISLE, .8) + 'L' + p(58, AISLE, .8) + 'L' + p(58, 43, .8);
    return '<path class="iso-route" d="' + d + '"/>'
      + '<path class="iso-route-flow" d="' + d + '"/>'
      + '<path class="iso-route-done" id="twin-route-done" d="' + d + '"/>';
  }

  /* A human figure. The arm is its own group so it can be animated on its own,
     which is what makes a scan read as a scan. */
  function figure(ox, oy) {
    var legs = '<g class="op-leg op-leg--back">' + box(ox - 0.62, oy - 0.5, 0.52, 1.0, 1.4, 'trouser') + '</g>'
      + '<g class="op-leg op-leg--front">' + box(ox + 0.10, oy - 0.5, 0.52, 1.0, 1.4, 'trouser') + '</g>';
    var body = paint([
      [ox - 0.85, oy - 0.72, 1.7, 1.44, 1.6, 'vest', 1.4],
      [ox - 0.42, oy - 0.38, 0.84, 0.76, 0.62, 'skin', 3.0],
      [ox - 0.56, oy - 0.5, 1.12, 1.0, 0.34, 'helmet', 3.62]
    ]);
    var arm = box(ox + 0.78, oy - 0.6, 0.22, 1.2, 1.2, 'trouser', 1.6)
      + box(ox + 0.92, oy - 0.2, 0.5, 0.42, 0.3, 'tyre', 2.5);   // the gun
    var backArm = '<g class="op-arm-back">' + box(ox - 1.0, oy - 0.6, 0.22, 1.2, 1.2, 'trouser', 1.6) + '</g>';
    return legs + backArm + body + '<g class="op-arm">' + arm + '</g>';
  }

  // The side alleys are drawn behind their racks/containers. Movement comes
  // from the shared traffic model so a pedestrian can yield mid-route.
  var PATROLS = [
    {id:'roamer',x:18,y:5,route:[[18,5],[18,23]],speed:1.8},
    {id:'operator',x:50,y:5,route:[[50,5],[50,23]],speed:2.1},
    {id:'returns-op',x:93,y:5,route:[[93,5],[93,23]],speed:1.8},
    {id:'gr-scanner',x:37,y:41,route:[[37,41],[39,41],[39,46],[37,46]],speed:1.2}
  ];
  var ADMIN_ROUTE = [[27,25],[50,25],[50,39],[80,39],[98,43],[98,65],
    [76,65],[76,43],[55,43],[37,43],[37,37],[18,37],[18,28],[27,25]];
  function walker(index) {
    var person=PATROLS[index];
    return '<g class="iso-figure iso-roamer" id="' + person.id + '">'
      + '<g class="op-walk">' + figure(person.x,person.y) + '</g></g>';
  }

  /* The five named operators stand in clear spaces beside their work areas. */
  var TEAM = [
    { name: 'Sơn',  x: 82, y: 63, crew: 'crewA', talk: '0s', area: 'returnables' },
    { name: 'Ngân', x: 27, y: 25, crew: 'crewB', talk: '3.4s', ponytail: true, area: 'aisle' },
    { name: 'Minh', x: 36, y: 65, crew: 'crewC', talk: '6.8s', area: 'gr' },
    { name: 'Trí',  x: 56, y: 63, crew: 'crewD', talk: '1.7s', area: 'interlock' },
    { name: 'Bách', x: 89, y: 23, crew: 'crewE', talk: '5.1s' }
  ];

  function crew() {
    return '<g class="iso-team">' + TEAM.map(function (m, index) {
      var y = m.y;
      var specs = [
        [m.x - 0.62, y - 0.5, 0.52, 1.0, 1.4, m.crew, 0],
        [m.x + 0.10, y - 0.5, 0.52, 1.0, 1.4, m.crew, 0],
        [m.x - 0.85, y - 0.72, 1.7, 1.44, 1.6, 'vest', 1.4],
        [m.x - 1.0, y - 0.6, 0.22, 1.2, 1.2, m.crew, 1.6],
        [m.x - 0.42, y - 0.38, 0.84, 0.76, 0.62, 'skin', 3.0]
      ];
      if (m.ponytail) {
        specs.push([m.x - 0.5, y + 0.34, 0.62, 0.34, 0.9, 'hair', 2.7]);
      }
      specs.push([m.x - 0.56, y - 0.5, 1.12, 1.0, 0.34, 'helmet', 3.62]);

      var base = pt(m.x, y, 0);
      var bubbleY = base[1] - 44;      // clear of the hard hat
      var nameY = base[1] - 62;        // and the name clears the bubble
      var bx = base[0] - 11;

      var dots = [0, 1, 2].map(function (n) {
        return '<circle class="iso-chat-dot" cx="' + (bx + 6 + n * 5).toFixed(1)
          + '" cy="' + (bubbleY + 8).toFixed(1) + '" r="1.6"/>';
      }).join('');

      return '<g class="iso-member" data-member="' + index + '" data-work-area="' + (m.area || 'putaway') + '" tabindex="-1" role="button" aria-label="' + m.name + '" style="--gesture-delay:' + m.talk + '">'
        + '<title>' + m.name + '</title>'
        + '<rect class="iso-member-hit" x="' + (base[0] - 14) + '" y="' + (base[1] - 34) + '" width="28" height="40" rx="5"/>'
        + '<g class="iso-member-body">'
        + '<g class="op-leg op-leg--back">' + paint([specs[0]]) + '</g>'
        + '<g class="op-leg op-leg--front">' + paint([specs[1]]) + '</g>' + paint(specs.slice(2))
        +   '<g class="iso-member-arm">' + box(m.x + 0.78, y - 0.6, 0.22, 1.2, 1.2, m.crew, 1.6) + '</g>'
        + '</g>'
        + '<g class="iso-chat" style="animation-delay:' + m.talk + '">'
        +   '<path class="iso-chat-tail" d="M' + (bx + 8).toFixed(1) + ',' + (bubbleY + 14).toFixed(1)
        +     'l5,0l-3,6z"/>'
        +   '<rect class="iso-chat-box" x="' + bx.toFixed(1) + '" y="' + bubbleY.toFixed(1)
        +     '" width="22" height="14" rx="4"/>'
        +   dots
        + '</g>'
        + '<text class="iso-member-name" x="' + base[0].toFixed(1) + '" y="' + nameY.toFixed(1) + '">'
        +   m.name
        + '</text>'
        + '</g>';
    }).join('') + '</g>';
  }

  function nodes(labels, floorOnly) {
    return NODES.map(function (node, index) {
      var c = pt(node.x, node.y, 0.9);
      var area = node.area;
      var name = labels[node.app] || node.app;
      if (floorOnly) {
        return '<g class="iso-area-hit" data-area-app="' + node.app + '">'
          + poly([p(area[0], area[1], .8), p(area[0] + area[2], area[1], .8),
            p(area[0] + area[2], area[1] + area[3], .8), p(area[0], area[1] + area[3], .8)], 'iso-hit') + '</g>';
      }
      return '<g class="iso-node iso-node--' + (index + 1) + '" data-node-app="' + node.app + '"'
        + ' tabindex="0" role="button" aria-label="' + node.num + '. ' + name + '">'
        + '<ellipse class="iso-node-pad" cx="' + c[0] + '" cy="' + c[1] + '" rx="26" ry="15"/>'
        + '<ellipse class="iso-node-ping" cx="' + c[0] + '" cy="' + c[1] + '" rx="26" ry="15"/>'
        + '<circle class="iso-node-dot" cx="' + c[0] + '" cy="' + c[1] + '" r="5"/>'
        + '</g>';
    }).join('');
  }

  function buildTip(mount) {
    var tip = document.createElement('div');
    tip.className = 'twin__tip';
    tip.hidden = true;
    mount.appendChild(tip);
    return tip;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  var DEPART_AT = '-28.8s';  /* 60% of the 48s shipping cycle */

  function create(mount, options) {
    var opts = options || {};
    var labels = opts.labels || { gr: 'Goods Received', interlock: 'Pallet Interlocking', putaway: 'PutAway' };
    var still = opts.reducedMotion;
    var text = opts.text || function (key) { return key; };

    mount.innerHTML =
      '<svg class="twin__svg" viewBox="58 -35 988 662" preserveAspectRatio="xMidYMid meet" role="group" tabindex="0" aria-label="'
      + (opts.description || 'Isometric plan of the hall') + '">'
      + '<g class="twin__hall">'
      +   floorPlate()
      +   lighting()
      +   floorMarks()
      +   route()
      +   nodes(labels, true)
      +   freightContainer(0, 'container-blue', true)
      +   walker(0)
      +   '<g data-layout-area="putaway">' + rackBank(23) + '</g>'
      +   walker(1)
      +   '<g data-layout-area="putaway">' + rackBank(63) + '</g>'
      +   walker(2)
      +   freightContainer(99, 'container-olive', false)
      +   '<g id="dock-truck" class="iso-dock-truck"></g>'
      +   '<g id="shipping" class="iso-shipping"></g>'
      +   '<g class="iso-shuttle" id="aisle-truck"></g>'
      +   '<g class="iso-shuttle" id="shuttle"></g>'
      +   walker(3)
      +   goodsReceived()
      +   packArea()
      +   returnables()
      +   layoutLabels(text)
      +   nodes(labels)
      +   crew()
      + '</g>'
      + '</svg>';

    var tip = buildTip(mount);
    var tipGroup = null;
    var view = mount.closest('.view');
    var svg = mount.querySelector('svg');
    var vehicles = [
      global.WarehouseVehicles.create(mount.querySelector('#dock-truck'), {vehicle:truck(0,0),project:pt,x:6,receiving:true}),
      global.WarehouseVehicles.create(mount.querySelector('#shipping'), {vehicle:truck(0,0),project:pt,x:105,receiving:false})
    ];
    var activity=global.WarehouseLogistics.create({people:PATROLS.concat(TEAM.map(function (m,i) {
      return {id:'member-'+i,x:m.x,y:m.y,route:i===1 ? ADMIN_ROUTE : [],speed:2.6};
    }))});
    var activityRenderer=global.WarehouseLogisticsRenderer.create(mount,pt,activity);
    var hall=mount.querySelector('.twin__hall');
    var teamLayer=mount.querySelector('.iso-team');
    var actorNodes=activity.people.map(function (person) {
      return mount.querySelector(person.id.indexOf('member-')===0 ? '[data-member="'+person.id.slice(7)+'"]' : '#'+person.id);
    });
    var active = true;
    var motionQuery = global.matchMedia('(prefers-reduced-motion: reduce)');
    var greeting = document.createElement('div');
    greeting.className = 'twin__greeting';
    greeting.setAttribute('role', 'status');
    greeting.setAttribute('aria-live', 'polite');
    greeting.hidden = true;
    mount.appendChild(greeting);
    var greeted = null;
    var greetingTimer = null;
    var greetingCount = TEAM.map(function (_, index) { return index % 3; });
    var frameId = 0, previousFrame = 0;
    var nameLayer = document.createElement('div');
    nameLayer.className = 'twin__crew-controls';
    var leaders = document.createElementNS('http://www.w3.org/2000/svg','svg');
    leaders.setAttribute('class','twin__person-leaders');
    leaders.setAttribute('aria-hidden','true');
    nameLayer.appendChild(leaders);
    mount.appendChild(nameLayer);
    var people = TEAM.map(function (member,index) {
      var group = mount.querySelector('[data-member="' + index + '"]');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'twin__person';
      button.dataset.crewButton = index;
      button.innerHTML = '<span>' + escapeHtml(member.name) + '</span>';
      nameLayer.appendChild(button);
      var line = document.createElementNS('http://www.w3.org/2000/svg','line');
      leaders.appendChild(line);
      var person = {group:group,button:button,line:line,hover:false,focus:false};
      [group,button].forEach(function (target) {
        target.addEventListener('pointerenter', function (event) { if (event.pointerType === 'mouse') { person.hover = true; } });
        target.addEventListener('pointerleave', function () { person.hover = false; });
        target.addEventListener('focus', function () { person.focus = true; });
        target.addEventListener('blur', function () { person.focus = false; });
      });
      button.addEventListener('click', function () { sayHello(group); });
      button.addEventListener('keydown', function (event) { if (event.key === 'Escape') { closeGreeting(); } });
      return person;
    });

    function positionPeople() {
      var base = mount.getBoundingClientRect();
      if (!base.width || !base.height) { return; }
      var bodies = people.map(function (person) { return person.group.querySelector('.iso-member-body').getBoundingClientRect(); });
      var blockers = bodies.map(function (b) { return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,weight:1000}; }).concat(Array.from(mount.querySelectorAll('.iso-node-dot')).map(function (dot) {
        var b = dot.getBoundingClientRect();
        return {left:b.left-9,top:b.top-9,right:b.right+9,bottom:b.bottom+9,weight:1000};
      }));
      mount.querySelectorAll('.iso-rack-bank, [data-layout-area="gr"], .iso-l-table, .iso-wrapper, [data-layout-area="returnables"], .iso-freight-container').forEach(function (object) {
        blockers.push(object.getBoundingClientRect());
      });
      document.querySelectorAll('.stage-overlay h1, .stage-overlay .btn').forEach(function (control) { blockers.push(control.getBoundingClientRect()); });
      people.forEach(function (person,index) {
        var body = bodies[index], button = person.button;
        var cx = (body.left + body.right) / 2, cy = (body.top + body.bottom) / 2;
        button.hidden = body.right < base.left || body.left > base.right || body.bottom < base.top || body.top > base.bottom;
        person.line.style.display = button.hidden ? 'none' : '';
        if (button.hidden) { return; }
        var w = button.offsetWidth, h = button.offsetHeight;
        var candidates = [[cx-w/2,body.top-h-2], [body.right+3,cy-h/2], [body.left-w-3,cy-h/2],
          [cx-w/2,body.bottom+2], [body.right+8,body.top-h], [body.left-w-8,body.top-h]];
        // A compact map may need callouts farther from a figure. Search the
        // nearby free floor rather than letting a name steal another tap.
        for (var gy=base.top;gy<=base.bottom-h;gy+=h+2) {
          for (var gx=base.left;gx<=base.right-w;gx+=w+2) { candidates.push([gx,gy]); }
        }
        var held = person.hover || (person.focus && (button.matches(':focus-visible') || person.group.matches(':focus-visible'))) || greeted === person.group;
        var best = held && person.placement ? person.placement : null;
        if (!best) { candidates.forEach(function (candidate,rank) {
          var left = Math.max(base.left,Math.min(candidate[0],base.right-w));
          var top = Math.max(base.top,Math.min(candidate[1],base.bottom-h));
          var score = rank < 6 ? rank : 6 + Math.hypot(left+w/2-cx,top+h/2-cy) * .1;
          blockers.forEach(function (b) {
            score += Math.max(0,Math.min(left+w,b.right)-Math.max(left,b.left))
              * Math.max(0,Math.min(top+h,b.bottom)-Math.max(top,b.top)) * (b.weight || 1);
          });
          if (!best || score < best.score) { best = {left:left,top:top,right:left+w,bottom:top+h,score:score}; }
        }); }
        person.placement = best;
        button.style.left = (best.left-base.left) + 'px';
        button.style.top = (best.top-base.top) + 'px';
        person.line.setAttribute('x1',cx-base.left);
        person.line.setAttribute('y1',body.top-base.top);
        person.line.setAttribute('x2',Math.max(best.left+6,Math.min(cx,best.right-6))-base.left);
        person.line.setAttribute('y2',Math.max(best.top+8,Math.min(body.top,best.bottom-8))-base.top);
        best.weight = 1000;
        blockers.push(best);
      });
    }

    function requestFrame() {
      if (!frameId) { frameId = requestAnimationFrame(renderActivity); }
    }
    function renderActivity(now) {
      frameId = 0;
      if (!active || document.hidden) { previousFrame = 0; return; }
      var dt = previousFrame ? Math.min(100,now-previousFrame) : 0;
      previousFrame = now;
      vehicles.forEach(function (vehicle) { vehicle.update(still); });
      activity.people.forEach(function (person,i) {
        var control=people[i-PATROLS.length];
        person.paused=!!control && (control.hover || (control.focus &&
          (control.button.matches(':focus-visible') || control.group.matches(':focus-visible'))) || greeted===control.group);
      });
      if (!still) { activity.update(dt/1000,{receiving:vehicles[0].state(),shipping:vehicles[1].state()}); }
      activityRenderer.draw({dt:still ? 0 : dt,receiving:vehicles[0].state()});
      activity.people.forEach(function (person,i) {
        var node=actorNodes[i],origin=pt(person.home.x,person.home.y,0),position=pt(person.x,person.y,0);
        node.setAttribute('transform','translate('+(position[0]-origin[0])+','+(position[1]-origin[1])+')');
        node.dataset.planX=person.x.toFixed(2);node.dataset.planY=person.y.toFixed(2);
        node.dataset.yieldingTo=person.yieldTo || '';
        node.classList.toggle('is-walking',!still && person.walking);
        var before=null,parent=hall;
        if(person.y<28 && person.x<23) before=mount.querySelectorAll('[data-layout-area="putaway"]')[0];
        else if(person.y<28 && person.x<63) before=mount.querySelectorAll('[data-layout-area="putaway"]')[1];
        else if(person.y<28 && person.x>88) before=mount.querySelector('[data-container="shipping"]');
        else if(person.y<61) before=mount.querySelector('[data-layout-area="gr"]');
        else parent=teamLayer;
        var layer=before || parent;
        if(node.depthLayer!==layer) { parent.insertBefore(node,before);node.depthLayer=layer; }
      });
      positionPeople();
      if (!still) { requestFrame(); }
    }
    new ResizeObserver(requestFrame).observe(mount);

    function closeGreeting() {
      clearTimeout(greetingTimer);
      if (greeted) { greeted.classList.remove('is-greeting'); }
      people.forEach(function (person) { person.button.classList.remove('is-greeting'); });
      greeted = null;
      greeting.hidden = true;
    }

    function sayHello(group) {
      var index = Number(group.getAttribute('data-member'));
      if (!TEAM[index]) { return; }
      closeGreeting();
      hideTip();
      var phrase = ['Hello!', 'Xin chào!', 'I love RMIT!'][greetingCount[index]++ % 3];
      greeting.innerHTML = '<strong>' + escapeHtml(TEAM[index].name) + '</strong><span>' + escapeHtml(phrase) + '</span>';
      greeting.hidden = false;
      greeted = group;
      people.forEach(function (person) { person.button.classList.toggle('is-greeting',person.group === group); });
      void group.getBoundingClientRect();
      group.classList.add('is-greeting');
      positionPopover(group.querySelector('.iso-member-body'), greeting);
      greetingTimer = setTimeout(closeGreeting, 3200);
    }

    mount.querySelectorAll('[data-member]').forEach(function (group) {
      group.addEventListener('click', function (event) { event.stopPropagation(); sayHello(group); });
      group.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          sayHello(group);
        } else if (event.key === 'Escape') { closeGreeting(); }
      });
    });

    var camera = global.WarehouseCamera.create(mount, svg, {
      text: text,
      onMove: function () {
        hideTip(); closeGreeting();
        people.forEach(function (person) { person.placement = null; });
        requestFrame();
      }
    });

    function labelMembers() {
      mount.querySelectorAll('[data-member]').forEach(function (group) {
        group.setAttribute('aria-label', text('twin.greet', { name: TEAM[Number(group.getAttribute('data-member'))].name }));
      });
      people.forEach(function (person,index) { person.button.setAttribute('aria-label',text('twin.greet', {name:TEAM[index].name})); });
      camera.relabel();
    }
    labelMembers();

    // Keep the paths even without motion: their first point places each actor
    // on the floor. Omitting animateMotion left figures at the SVG origin.
    function syncMotion() {
      var paused = still || !active || document.hidden;
      mount.classList.toggle('is-still', Boolean(still));
      mount.classList.toggle('is-paused', Boolean(paused));
      if (paused) { svg.pauseAnimations(); }
      else { svg.unpauseAnimations(); }
      if (still) { svg.setCurrentTime(0); }
      if (paused) {
        cancelAnimationFrame(frameId); frameId = 0; previousFrame = 0;
      }
      if (active && !document.hidden) { requestFrame(); }
    }
    motionQuery.addEventListener('change', function (event) {
      still = event.matches;
      syncMotion();
    });
    document.addEventListener('visibilitychange', syncMotion);
    syncMotion();

    function showTip(group, app) {
      if (camera.isDragging()) { return; }
      if (!opts.describe) { return; }
      var info = opts.describe(app);
      if (!info) { return; }
      tip.className = 'twin__tip is-' + (NODES.map(function (n) { return n.app; }).indexOf(app) + 1)
        + (info.done ? ' is-done' : '');
      tip.innerHTML =
        '<span class="twin__tip-step">' + escapeHtml(info.step) + '</span>'
        + '<strong class="twin__tip-name">' + escapeHtml(info.name) + '</strong>'
        + '<span class="twin__tip-role">' + escapeHtml(info.role) + '</span>'
        + '<span class="twin__tip-go">' + escapeHtml(info.action) + '</span>';
      tip.hidden = false;
      tipGroup = group;
      positionTip(group);
    }

    function positionTip(group) {
      positionPopover(group.querySelector('.iso-node-dot'), tip);
    }

    function positionPopover(anchor, popover) {
      var box = anchor.getBoundingClientRect();
      var base = mount.getBoundingClientRect();
      var size = popover.getBoundingClientRect();
      var visible = view ? view.getBoundingClientRect() : { top: 0, bottom: global.innerHeight };
      var minTop = Math.max(12, visible.top - base.top + 12);
      var maxBottom = Math.min(base.height - 12, visible.bottom - base.top - 12);
      var center = box.left + box.width / 2 - base.left;
      var left = Math.max(12, Math.min(center - size.width / 2, base.width - size.width - 12));
      var top = box.top - base.top - size.height - 22;
      var below = top < minTop;
      if (below) { top = box.bottom - base.top + 22; }
      top = Math.max(minTop, Math.min(top, maxBottom - size.height));
      popover.classList.toggle('is-below', below);
      popover.style.left = left + 'px';
      popover.style.top = top + 'px';
      popover.style.setProperty('--tip-arrow', Math.max(16, Math.min(center - left, size.width - 16)) + 'px');
    }

    function hideTip() { tip.hidden = true; tipGroup = null; }

    if (view) {
      view.addEventListener('scroll', function () {
        if (tipGroup) { positionTip(tipGroup); }
      }, { passive: true });
    }

    // Floor targets sit below the equipment, so a tall rack or tote always
    // opens its own station instead of the floor projected behind it.
    mount.querySelectorAll('[data-area-app], [data-layout-area]').forEach(function (area) {
      var app = area.getAttribute('data-area-app') || area.getAttribute('data-layout-area');
      var marker = mount.querySelector('[data-node-app="' + app + '"]');
      if (!marker) { return; }
      area.addEventListener('pointerenter', function () { showTip(marker, app); });
      area.addEventListener('pointerleave', hideTip);
      area.addEventListener('click', function () {
        hideTip();
        if (opts.onNodeClick) { opts.onNodeClick(app); }
      });
    });

    mount.querySelectorAll('[data-node-app]').forEach(function (group) {
      var app = group.getAttribute('data-node-app');
      group.addEventListener('pointerenter', function () { showTip(group, app); });
      group.addEventListener('pointerleave', hideTip);
      group.addEventListener('focus', function () { showTip(group, app); });
      group.addEventListener('blur', hideTip);
      if (opts.onNodeClick) {
        group.addEventListener('click', function () { hideTip(); opts.onNodeClick(app); });
        group.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            hideTip();
            opts.onNodeClick(app);
          }
        });
      }
    });

    window.addEventListener('resize', hideTip);

    return {
      /* Light the aisle up to the last finished node. */
      setActive: function (value) {
        active = value;
        if (!active) { closeGreeting(); hideTip(); camera.cancelDrag(); }
        syncMotion();
      },
      setProgress: function (doneApps) {
        mount.querySelectorAll('[data-node-app]').forEach(function (group) {
          group.classList.toggle('is-done', doneApps.indexOf(group.getAttribute('data-node-app')) !== -1);
        });
        var reached = 0;
        NODES.forEach(function (node, i) {
          if (doneApps.indexOf(node.app) !== -1) { reached = Math.max(reached, i + 1); }
        });
        var done = document.getElementById('twin-route-done');
        if (done) {
          var fraction = [0, 0.30, 0.63, 1][reached];
          done.style.strokeDasharray = '1000';
          done.style.strokeDashoffset = String(1000 - 1000 * fraction);
        }
      },
      hideTip: hideTip,
      members: function () { return TEAM.map(function (m) { return m.name; }); },

      /* The shipping lane runs continuously. Finishing the last station jumps
         the cycle to the moment the loaded truck pulls out, so the departure
         reads as a consequence of the pallet rather than a coincidence. */
      departTruck: function () {
        ['shipping'].forEach(function (id) {
          var node = document.getElementById(id);
          if (!node) { return; }
          node.style.animation = 'none';
          void node.getBoundingClientRect();
          node.style.animation = '';
          node.style.animationDelay = DEPART_AT;
        });
      },
      relabel: function (newLabels) {
        closeGreeting();
        labelMembers();
        mount.querySelector('[data-area-label="returnables"]').textContent = text('twin.returnables');
        NODES.forEach(function (node) {
          var group = mount.querySelector('[data-node-app="' + node.app + '"]');
          if (group) { group.setAttribute('aria-label', node.num + '. ' + newLabels[node.app]); }
        });
      }
    };
  }

  global.Twin = { create: create };
})(window);
