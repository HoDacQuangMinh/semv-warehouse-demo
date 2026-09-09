import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const root = new URL('../', import.meta.url);
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
    const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png' }[path.split('.').pop()];
    res.setHeader('Content-Type', mime || 'application/octet-stream');
    res.end(await readFile(new URL(path, root)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const errors = [], report = [];
const output = new URL('../artifacts/navigation/', import.meta.url);
await mkdir(output, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  for (const base of [root.href, `http://127.0.0.1:${server.address().port}/`]) {
    for (const file of ['index.html', 'preview-single-file.html']) {
      const page = await browser.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.evaluateOnNewDocument(() => {
        let serial = 0, time = 0, frames = new Map();
        window.requestAnimationFrame = callback => { frames.set(++serial, callback); return serial; };
        window.cancelAnimationFrame = id => frames.delete(id);
        window.advance = ms => {
          for (let t = 0; t < ms; t += 50) { time += 50; const batch = frames; frames = new Map(); batch.forEach(fn => fn(time)); }
        };
      });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.goto(base + file);
      const route = async expected => {
        await page.waitForFunction(id => Router.current() === id && location.hash === '#' + id, { polling: 50 }, expected);
        const status = await page.evaluate(() => ({
          active: [...document.querySelectorAll('.view.is-active')].map(n => n.id),
          inert: document.querySelector('main').inert || document.querySelector('header').inert,
          covered: !document.querySelector('#transition').hidden || !!document.querySelector('#handoff')
        }));
        assert.deepEqual(status, { active: ['view-' + expected], inert: false, covered: false });
      };
      const go = async id => { await page.evaluate(id => Router.go(id), id); await route(id); };
      await route('home');
      await page.click('[data-home-step="gr"]'); await route('gr');
      await page.click('#view-gr [data-act="open"]');
      const receiving = await page.$eval('#terminal-gr [data-mount]', n => n.textContent);
      await page.goBack(); await route('home');
      await page.goForward(); await route('gr');
      assert.equal(await page.$eval('#terminal-gr [data-mount]', n => n.textContent), receiving, 'Back/Forward preserves demo progress');
      await go('putaway'); await go('interlock'); await go('more');
      for (const id of ['interlock', 'putaway', 'gr', 'home']) { await page.goBack(); await route(id); }
      for (const id of ['gr', 'putaway', 'interlock', 'more']) { await page.goForward(); await route(id); }
      // Brand links return inside the same document, including the offline file.
      await page.click('.brand--partner'); await route('home');
      assert.equal(new URL(page.url()).pathname, new URL(base + file).pathname);
      await page.goBack(); await route('more');
      await page.click('.topbar__school'); await route('home');
      await page.evaluate(() => { location.hash = 'putaway'; }); await route('putaway');
      await page.reload(); await route('putaway');
      await page.evaluate(() => { location.hash = 'invalid-screen'; }); await route('home');
      await go('more');
      // Real document navigation and return must leave every control usable.
      await page.goto(base + 'privacy.html');
      await page.goBack(); await route('more');
      await page.click('#scan-btn');
      assert.equal(await page.$eval('#scan-out', n => !n.hidden), true);
      await go('home');
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      for (const elapsed of [100, 950]) {
        await page.evaluate(() => Router.go('gr'));
        await pause(elapsed);
        await page.goBack(); await route('home');
        await pause(1750);
        await route('home'); // No stale midpoint callback may reopen GR.
        await page.goForward(); await route('gr');
        await page.evaluate(() => Router.go('home', { instant: true }));
      }
      await page.evaluate(() => Router.go('gr', { instant: true }));
      await page.evaluate(() => { window.handoffResult = null; WarehouseHandoff.play('gr').then(result => { window.handoffResult = result; }); advance(600); });
      await page.goBack(); await route('home');
      assert.equal(await page.evaluate(() => window.handoffResult), false);
      await page.evaluate(() => advance(16000)); await route('home');
      // Recover even if the browser restores a suspended transition from cache.
      await page.evaluate(() => {
        Router.go('more');
        dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
        dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      });
      await route('more');
      await page.evaluate(() => Router.go('home', { instant: true }));
      const moving = await page.evaluate(() => {
        advance(1000); const first = document.querySelector('#twin-stage').innerHTML;
        advance(2000); return first !== document.querySelector('#twin-stage').innerHTML;
      });
      assert.equal(moving, true, 'Warehouse resumes after history restoration');
      const language = await page.evaluate(() => I18N.getLanguage());
      await page.click('#lang-toggle');
      assert.notEqual(await page.evaluate(() => I18N.getLanguage()), language);
      const themeBefore = await page.$eval('html', n => n.dataset.theme);
      await page.click('#theme-toggle');
      assert.notEqual(await page.$eval('html', n => n.dataset.theme), themeBefore);
      // Both original images must load without relying on the source folders.
      assert.equal(await page.$$eval('.topbar img, .topbar svg image', async nodes => {
        const loaded = await Promise.all(nodes.map(async n => { const img = new Image(); img.src = n.tagName === 'IMG' ? n.src : n.href.baseVal; await img.decode(); return img.naturalWidth > 0; }));
        return loaded.length === 2 && loaded.every(Boolean);
      }), true);
      if (file.startsWith('preview')) assert.equal(await page.$$eval('.topbar img, .topbar svg image', nodes => nodes.every(n => (n.tagName === 'IMG' ? n.src : n.href.baseVal).startsWith('data:image/png;base64,'))), true);
      const sizes = [[320,568],[360,800],[390,844],[540,720],[568,320],[640,360],[768,1024],[1024,768],[1250,800],[1280,720],[1440,900],[1920,1080],[3840,2160],[480,270]];
      for (const [width, height] of sizes) {
        await page.setViewport({ width, height });
        for (const lang of ['vi', 'en']) for (const theme of ['light', 'dark']) {
          await page.evaluate(({lang,theme}) => { I18N.setLanguage(lang); document.documentElement.dataset.theme = theme; advance(150); }, {lang,theme});
          const issues = await page.evaluate(() => {
            const issues = [], bar = document.querySelector('.topbar'), home = document.querySelector('#view-home');
            const elements = [...bar.querySelectorAll('.brand--partner,.topbar__school,.topbar__nav,.topbar__tools')];
            const boxes = elements.map(n => n.getBoundingClientRect());
            boxes.forEach((r,i) => { if (r.left < -1 || r.right > innerWidth + 1) issues.push('header overflow: ' + elements[i].className); });
            for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
              const a = boxes[i], b = boxes[j];
              if (Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1) issues.push('header overlap');
            }
            if (home.scrollWidth > home.clientWidth + 1 || home.scrollHeight > home.clientHeight + 1) issues.push('home overflow');
            if (bar.getBoundingClientRect().bottom > home.getBoundingClientRect().top + 1) issues.push('header covers home');
            for (const button of home.querySelectorAll('.stage-overlay button')) {
              if (!button.getClientRects().length) continue;
              const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
              if (hit !== button && !button.contains(hit)) issues.push('home button covered: ' + button.textContent);
            }
            for (const n of [elements[0],elements[1]]) if (getComputedStyle(n).backgroundColor !== 'rgba(0, 0, 0, 0)') issues.push('logo background');
            const darkInk = getComputedStyle(document.querySelector('.brand__rmit-dark')).display !== 'none';
            if (darkInk !== (document.documentElement.dataset.theme === 'dark')) issues.push('RMIT theme contrast');
            return issues;
          });
          assert.deepEqual(issues, [], `${base}${file} ${width}x${height} ${lang} ${theme}`);
        }
      }
      if (base.startsWith('file:') && file === 'index.html') {
        await page.evaluate(() => { I18N.setLanguage('en'); advance(1000); });
        for (const [width,height] of [[1440,900],[390,844],[320,568],[480,270]]) for (const theme of ['light','dark']) {
          await page.setViewport({width,height});
          await page.evaluate(theme => { document.documentElement.dataset.theme=theme; advance(100); },theme);
          await page.screenshot({ path: new URL(`header-${width}-${theme}.png`,output).pathname.slice(1) });
        }
      }
      report.push({base,file,history:'passed',headerLayouts:sizes.length*4});
      console.log(`${base}${file}: history, animation cancellation, logo loading and 56 header layouts passed`);
      await page.close();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('report.json', output), JSON.stringify({report,errors},null,2));
} finally { await browser.close(); server.close(); }
