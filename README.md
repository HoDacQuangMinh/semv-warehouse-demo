# SEMV Warehouse, digital twin and app demo

A static site. No build step, no bundler, no backend, no login, no tracking.

## Running it

Open `index.html` in a browser. That is all it needs.

If your browser blocks local files, serve the folder instead:

    python3 -m http.server 8000

then open http://localhost:8000

`preview-single-file.html` is the same site with every stylesheet and script
inlined into one file. Useful for emailing or for a USB stick at the booth. It
is generated, so do not edit it: change the sources and run

    python3 build-preview.py

With Node.js, the same preview can also be regenerated with `npm run build:preview`.

## Responsive and animation checks

Run `npm run check:responsive` with Microsoft Edge installed on Windows, or set
`BROWSER_PATH` to a Chromium browser executable. The browser checks cover 22
viewport sizes from 320px phones to 3840px displays, including effective browser
zoom sizes up to 400%, both languages and themes,
the three complete station workflows, keyboard and touch navigation, and live
reduced-motion changes. Screenshots and the report are written to
`artifacts/responsive/`. These are browser simulations, not physical device tests.

The home title stays in the lower-left corner of a canvas that fits the screen.
Text and drawing adapt to the available width and height, including browser
zoom, without introducing a scrolling home page. Phones reserve room for the
caption so every station remains accessible.
Drag the isometric map with a mouse or finger; use the wheel, pinch, or the
plus/minus buttons to zoom. Reset shows the whole warehouse. The map starts
closer and cannot zoom out beyond its full view. Keyboard users can focus the
map and use arrow keys, +/−, and Home.

Only Sơn, Ngân, Minh, Trí, and Bách respond to a click or Enter/Space with a
wave and a greeting cycling through “Hello!”, “Xin chào!”, and “I love RMIT!”.
Reduced motion keeps the greeting and skips the wave. `npm run check:interactions`
checks crew targeting, drag-versus-click, zoom, touch, and keyboard controls.
Sơn stands beside Returnables, Minh beside the GR stacks, Trí beside Pallet
Interlocking, and Bách beside PutAway. Ngân patrols the clear strip in front of
the first rack and pauses for hovering, keyboard focus, or a greeting. Tappable
name callouts keep their screen size while the map zooms and move into free
space when a compact layout needs it. The anonymous walker beside the blue
container is painted behind the rack to preserve depth in the alley.
Both navigation links remain available on phones. Operators step and swing their
arms, while the stationary crew shift their weight and gesture. Warehouse motion
pauses when the hall is hidden and stops when reduced motion is requested.

The GR receiving gate shares the truck's 24-second delivery loop: it opens once
the truck docks, stays open for unloading and returns, and closes as the truck
leaves. `npm run check:dock` verifies the timing across two cycles, both themes,
phone and desktop layouts, reduced motion, and the standalone preview.
Both trucks turn through their approach, reverse rear-first to the dock, stop
for loading, then leave cab-first and turn out. The vehicle geometry rotates
in plan coordinates while its vertical surfaces stay upright. Closing the
completion dialog returns directly to the warehouse plan and keeps the three
completed stations. `npm run check:crew` covers name targets, Ngân's pause and
resume behavior, and the shipping truck's manoeuvre.

The floor plan follows the supplied warehouse model: blue and olive container
docks bookend two open orange rack banks for PutAway. Across the central aisle,
two groups of stacked totes mark Goods Received, a yellow wrapping machine and
L-shaped table mark Pallet Interlocking, and green/red/yellow crates mark the
returnables bay. Clicking the racks, GR stacks, or wrapping equipment opens the
corresponding station. Returnables remains a separate physical area.

## What is in it

Five full screen views, no scrolling between them. A forklift drives across as
the transition.

- **Home** is an isometric digital twin of the hall. Hover a bay to see which
  step it is, tap it to open that app.
- **Three station views**, one per app, each with a working terminal.
- **Project detail** holds the problem, the manual challenge, the flow board,
  results, how it is built, the video slot and the team.

## Files

    index.html              the five views
    privacy.html            privacy policy
    terms.html              terms and conditions
    build-preview.py        regenerates preview-single-file.html
    assets/favicon.svg

    css/tokens.css          colour, type, spacing, motion; both themes
    css/base.css            reset and typography
    css/layout.css          header, bands, footer
    css/views.css           the full screen view system and the transition
    css/stage.css           the headline over the hall
    css/twin.css            the isometric hall
    css/components.css      buttons, terminals, rack, dialog
    css/sections.css        project detail sections and the legal pages
    css/animations.css      every keyframe, plus the reduced motion block

    js/i18n.js              every string, Vietnamese and English
    js/twin.js              the isometric hall: geometry, actors, hover cards
    js/camera.js            pointer, touch, and keyboard map controls
    js/vehicles.js          projected truck steering and reversing
    js/router.js            view switching and the forklift transition
    js/state.js             station completion, in memory only
    js/forklift.js          the transition vehicle
    js/demos.js             the three app simulations
    js/challenge.js         the manual matching challenge
    js/main.js              wiring

## The colour rules

Three colours carry meaning and are never decoration:

- **hazard yellow** only where something does not match
- **green** only where something is confirmed
- **scan blue** only during the moment of scanning

Station identity uses a separate set, petrol, oxide and moss, precisely so it
cannot be mistaken for a status. `--machine` yellow is for machinery and floor
paint, kept apart from hazard yellow for the same reason.

## The hall

Everything is generated from plan coordinates in `js/twin.js` and projected
isometrically, so moving something is a coordinate change, not a redraw. Two
rules matter if you edit it:

1. **Depth order.** A larger `x + y` is nearer the viewer and must be painted
   later. `paint()` sorts individual boxes; the rack row is drawn before the
   aisle actors, and the receiving and wrapping equipment after them.
2. **Lanes.** Forklifts use y 30 and 35 in the central aisle. Pedestrians use
   the side corridors at x 18 and 50, the receiving and returnables bays, and
   Ngân's patrol at y 25. Recheck projected clearance as well as floor clearance
   when moving equipment or a figure, and preserve the rack/actor drawing order.

## Before this goes public

Five items block launch:

1. Custom domain connected — **outstanding**
2. Favicon — done, `assets/favicon.svg`
3. "Made with AI" tag removed — none present
4. Privacy policy page — exists, blanks to fill
5. Terms and conditions page — exists, blanks to fill

Content still to fill, marked on the page with a dashed yellow box:

- Three pain point figures and their sources
- Before, after, and hours saved in the results section
- The 2 minute 30 video, pasted into the video slot in `index.html`
- Roles and LinkedIn links for the five team members
- Dates and a contact address on both legal pages

## Known gaps

- **PutAway is illustrative.** The two architecture maps cover Goods Received
  and Pallet Interlocking. No specification for PutAway was supplied, so its
  flow is a reconstruction and is labelled as such on its own view.
- **The three apps are not one chain.** Goods Received is inbound from
  suppliers; Pallet Interlocking is outbound to customers. The site tells a
  single truck-in to truck-out story, which works as a booth narrative but is
  not a claim to make to SEMV without a caveat.
- **Typeface.** The stack asks for IBM Plex and falls back to system fonts,
  with no CDN link, because the booth copy has to run offline. To get IBM Plex,
  drop the woff2 files into `assets/fonts/` and add `@font-face` rules at the
  top of `css/base.css`.

## Adding a language

Add a block to `STRINGS` in `js/i18n.js` with the same keys and call
`I18N.setLanguage('code')`. No string is hard coded anywhere else.
