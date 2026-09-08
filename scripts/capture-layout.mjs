import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('artifacts/layout');
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
try {
  const page = await browser.newPage();
  page.on('pageerror', error => { throw error; });
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.goto(pathToFileURL(resolve('index.html')).href);
  for (const [width,height] of [[1920,1080],[1366,768],[390,844]]) {
    await page.setViewport({width,height,deviceScaleFactor:1});
    for (const theme of ['light','dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({path:resolve(output,`${width}-${theme}.png`)});
    }
    for (const [app,selector] of [
      ['gr','[data-layout-area="gr"] .iso-tote-cream-top'],
      ['putaway','.iso-rack-bank .iso-rack-top'],
      ['interlock','.iso-wrapper-top'],
      ['interlock','.iso-l-table .iso-table-top'],
    ]) {
      await page.click(selector);
      assert.equal(await page.evaluate(() => window.Router.current()),app,`${selector} should open ${app} at ${width}px`);
      await page.evaluate(() => window.Router.go('home',{instant:true}));
    }
    await page.click('[data-layout-area="returnables"] .iso-tote-red-top');
    assert.equal(await page.evaluate(() => window.Router.current()),'home','Returnables should not open an unrelated station');
  }
  await page.setViewport({width:1400,height:940});
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
    const svg = document.querySelector('.twin__svg').cloneNode(true);
    svg.setAttribute('viewBox','58 -45 988 690');
    document.body.replaceChildren(svg);
    document.body.classList.remove('is-intro');
    svg.style.cssText = 'width:100vw;height:100vh;max-height:none;background:var(--hall-top)';
    svg.pauseAnimations(); svg.setCurrentTime(0);
  });
  await page.screenshot({path:resolve(output,'plan.png')});
  console.log('Equipment targeting passed on desktop, laptop, and phone; layout screenshots saved.');
} finally { await browser.close(); }
