import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('artifacts/responsive');
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--no-first-run', '--disable-gpu'],
});
const issues = [];
let checks = 0;
// The final four sizes also cover the effective CSS viewports of a 1920x1080
// display at 125%, 200%, 300%, and 400% browser zoom.
const sizes = [[320,568],[360,800],[390,844],[430,932],[600,960],[768,1024],[820,1180],[1024,1366],[1024,768],[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1440],[3840,2160],[568,320],[844,390],[1280,480],[1536,864],[960,540],[640,360],[480,270]];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => issues.push({ error: error.message }));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(pathToFileURL(resolve(process.env.APP_FILE || 'index.html')).href);
  for (const [width,height] of sizes) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    for (const lang of ['en','vi']) {
      await page.evaluate(lang => window.I18N.setLanguage(lang), lang);
      for (const view of ['home','gr','putaway','interlock','more']) {
        await page.evaluate(view => window.Router.go(view, { instant: true }), view);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const problems = await page.evaluate(async () => {
          const problems = [];
          const active = document.querySelector('.view.is-active');
          const elements = [...document.querySelectorAll('.topbar *'), ...active.querySelectorAll('*')];
          for (const el of elements) {
            if (el instanceof SVGElement || el.closest('svg') || !el.getClientRects().length) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width && (rect.left < -1 || rect.right > innerWidth + 1)) {
              problems.push('overflow: ' + el.tagName + '.' + el.className);
            }
          }
          const nav = document.querySelector('.topbar__nav');
          if (!nav.getClientRects().length) problems.push('project navigation hidden');
          if (active.id === 'view-home') {
            const title = document.querySelector('.stage-overlay h1').getBoundingClientRect();
            const head = document.querySelector('.topbar').getBoundingClientRect();
            if (title.top < head.bottom - 1) problems.push('hero title clipped by header');
            const cta = document.querySelector('.stage-overlay .btn').getBoundingClientRect();
            if (cta.bottom > innerHeight && active.scrollHeight <= active.clientHeight) problems.push('hero button unreachable');
            const canvas = document.getElementById('twin').getBoundingClientRect();
            const copy = document.querySelector('.stage-overlay');
            const copyBox = copy.getBoundingClientRect();
            const style = getComputedStyle(copy);
            if (active.scrollHeight > active.clientHeight + 1 || active.scrollWidth > active.clientWidth + 1) problems.push('home requires scrolling');
            if (Math.abs(copyBox.left - canvas.left - parseFloat(style.left)) > 1 || Math.abs(canvas.bottom - copyBox.bottom - parseFloat(style.bottom)) > 1) problems.push('caption moved away from the lower-left anchor');
            if (copyBox.top < head.bottom || copyBox.right > innerWidth || copyBox.bottom > innerHeight) problems.push('caption does not fit on screen');
            for (const dot of document.querySelectorAll('.iso-node-dot')) {
              const box = dot.getBoundingClientRect();
              const target = document.elementFromPoint(box.x + box.width / 2,box.y + box.height / 2);
              if (!target || !target.closest('[data-node-app], [data-area-app], [data-layout-area]')) problems.push('station marker is covered or offscreen');
            }
          }
          return [...new Set(problems)];
        });
        checks++;
        if (problems.length) issues.push({ width, height, lang, theme, view, problems });
        if (view === 'home' && [320,390,480,768,1280,1366,1920,844].includes(width)) {
          await page.screenshot({ path: resolve(output, `home-${width}x${height}${lang === 'vi' ? '-vi' : ''}${theme === 'dark' ? '-dark' : ''}.png`) });
        }
      }
    }
    }
    console.log(`Layout checked: ${width}x${height}, both languages and themes`);
  }

  // Exercise real buttons through every station, including rejected scans.
  const scenarios = {
    gr: ['open','docket','box','dup','box','box','finalize','empty','empty','empty','note','sign','sign','sign'],
    putaway: ['scan','bin','confirm'],
    interlock: ['pallet','hu2','wrong','ean','hu2','ean','hu2','ean','green'],
  };
  for (const [width,height] of [[320,568],[844,390],[1366,768]]) {
    await page.setViewport({ width,height,deviceScaleFactor: 1 });
    for (const lang of ['en','vi']) {
      await page.reload();
      await page.evaluate(lang => window.I18N.setLanguage(lang), lang);
      for (const [view,actions] of Object.entries(scenarios)) {
        await page.evaluate(view => window.Router.go(view, {instant:true}), view);
        for (const action of actions) {
          const selector = `#view-${view} ` + (action === 'bin' ? '.bin.is-suggested' : `[data-act="${action}"]`);
          await page.$eval(selector, el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await page.click(selector);
          const clipping = await page.evaluate(() => {
            const active = document.querySelector('.view.is-active');
            return [...active.querySelectorAll('.scanner, .scanner__code, .field, .line, .scr__body, .scr__foot, .terminal')]
              .filter(el => el.scrollWidth > el.clientWidth + 1)
              .map(el => el.className);
          });
          checks++;
          if (clipping.length) issues.push({ width,height,lang,view,action,clipping });
        }
        await page.waitForFunction(view => window.WarehouseState.isDone(view), {}, view);
        if (width === 320) await page.screenshot({ path: resolve(output, `${view}-${width}-${lang}.png`) });
      }
      await page.waitForFunction(() => window.Router.current() === 'home');
      if (await page.evaluate(() => window.Router.current()) !== 'home') issues.push({width,height,lang,error:'Completing the journey did not return to the warehouse plan'});
      checks++;
      await page.click('.topbar__nav [data-goto="home"]');
      await page.waitForFunction(() => window.Router.current() === 'home');
      await page.evaluate(() => document.getElementById('view-home').scrollTo({top:0,behavior:'instant'}));
      for (const app of ['gr','putaway','interlock']) {
        const selector = `[data-node-app="${app}"]`;
        await page.$eval(selector, el => el.focus());
        const tipFits = await page.$eval('.twin__tip', el => {
          const box = el.getBoundingClientRect();
          return box.left >= 0 && box.right <= innerWidth && box.top >= document.querySelector('.topbar').getBoundingClientRect().bottom;
        });
        checks++;
        if (!tipFits) issues.push({width,height,lang,app,error:'Tooltip outside visible area'});
        await page.keyboard.press('Enter');
        await page.waitForFunction(app => window.Router.current() === app, {}, app);
        await page.click('.view.is-active .back-link');
      }
    }
    console.log(`Station workflows checked: ${width}x${height}, both languages`);
  }

  for (const [width,height] of [[390,844],[844,390]]) {
    await page.setViewport({width,height,deviceScaleFactor:3,isMobile:true,hasTouch:true});
    await page.reload();
    for (const app of ['gr','putaway','interlock']) {
      await page.evaluate(() => document.getElementById('view-home').scrollTo({top:0,behavior:'instant'}));
      const dot = await page.$(`[data-node-app="${app}"] .iso-node-dot`);
      await dot.scrollIntoView();
      const box = await dot.boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(app => window.Router.current() === app, {}, app);
      await page.tap('.view.is-active .back-link');
      checks++;
    }
    await page.tap('.topbar__nav [data-goto="more"]');
    await page.waitForFunction(() => window.Router.current() === 'more');
    await page.tap('.topbar__nav [data-goto="home"]');
    checks++;
  }

  // Compare rendered positions over time, then verify pause/resume and live
  // reduced-motion changes. This also catches actors parked at the SVG origin.
  await page.setViewport({width:1366,height:768,deviceScaleFactor:1,isMobile:false,hasTouch:false});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.reload();
  const snapshot = () => page.evaluate(() => {
    const ids = ['gr-scanner','returns-op','operator','roamer'];
    return {
      paused: document.querySelector('.twin__svg').animationsPaused(),
      actors: ids.map(id => {
        const el = document.getElementById(id);
        const box = el.getBoundingClientRect();
        return {id,x:box.x,y:box.y,transform:el.getScreenCTM().toString()};
      }),
      parts: [...document.querySelectorAll('.iso-figure .op-leg, .iso-member-body, .iso-member-arm')].map(el => getComputedStyle(el).transform),
    };
  });
  const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
  const first = await snapshot();
  await delay(450);
  const second = await snapshot();
  checks++;
  if (first.paused || first.actors.some((actor,i) => actor.x === second.actors[i].x && actor.y === second.actors[i].y) || JSON.stringify(first.parts) === JSON.stringify(second.parts)) {
    issues.push({error:'Warehouse actors or body parts did not animate',first,second});
  }
  await page.evaluate(() => window.Router.go('gr',{instant:true}));
  const pauseTime = await page.$eval('.twin__svg', svg => svg.getCurrentTime());
  await delay(250);
  checks++;
  if (await page.$eval('.twin__svg', (svg,time) => !svg.animationsPaused() || svg.getCurrentTime() !== time, pauseTime)) issues.push({error:'Offscreen animation did not pause'});
  await page.evaluate(() => window.Router.go('home',{instant:true}));
  checks++;
  if (await page.$eval('.twin__svg', svg => svg.animationsPaused())) issues.push({error:'Returning home did not resume animation'});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await delay(100);
  const still = await snapshot();
  await delay(250);
  const stillLater = await snapshot();
  checks++;
  if (!still.paused || JSON.stringify(still) !== JSON.stringify(stillLater) || still.actors.some(actor => actor.x < 150 || actor.y < 100)) issues.push({error:'Reduced-motion pose is moving or misplaced',still,stillLater});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await delay(100);
  checks++;
  if (await page.$eval('.twin__svg', svg => svg.animationsPaused())) issues.push({error:'Live motion preference did not resume animation'});
  console.log('Animation, pause/resume, and reduced-motion checks complete');
} catch (error) {
  issues.push({error:error.stack});
} finally {
  await browser.close();
}
await writeFile(resolve(output, 'report.json'), JSON.stringify({ checks, sizes, issues }, null, 2));
console.log(JSON.stringify({ checks, issues }, null, 2));
if (issues.length) process.exitCode = 1;
