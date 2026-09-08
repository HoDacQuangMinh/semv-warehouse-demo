import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('artifacts/dock-cycle');
await mkdir(output, {recursive:true});
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless:true,
});
const files = ['index.html','preview-single-file.html'];
const errors = [];
let checks = 0;
const near = (value, expected) => Math.abs(value - expected) < 0.05;
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const file of files) {
    for (const [width,height] of [[390,844],[1366,768]]) {
      await page.setViewport({width,height,deviceScaleFactor:1});
      for (const theme of ['light','dark']) {
        await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
        await page.goto(pathToFileURL(resolve(file)).href);
        await page.evaluate(theme => {
          window.I18N.setLanguage('en');
          document.documentElement.dataset.theme = theme;
        }, theme);
        const timing = await page.evaluate(() => ['dock-truck'].map(id => {
          const animation = document.getElementById(id).getAnimations()[0];
          return {start:animation.startTime,duration:animation.effect.getTiming().duration};
        }));
        assert.ok(timing.every(item => item.duration === 24000), 'The receiving clock must run every 24 seconds');
        checks++;

        // Inspect the actual rendered transforms across two delivery cycles.
        for (const percent of [0,6,10,12,14,17,20,30,40,62,68,73,80,84,100,117,140,173,184]) {
          const pose = await page.evaluate(async percent => {
            document.getAnimations().forEach(animation => {
              animation.pause();
              animation.currentTime = percent / 100 * 24000;
            });
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const read = id => {
              const style = getComputedStyle(document.getElementById(id));
              const transform = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
              return {x:transform.e,y:transform.f,opacity:Number(style.opacity),clearance:Number(document.getElementById(id).dataset.clearanceLift || 0),progress:Number(document.getElementById(id).dataset.dockProgress || 0)};
            };
            const truck=document.getElementById('dock-truck');
            return {gate:read('dock-gate'),truck:{...read('dock-truck'),planX:Number(truck.dataset.vehicleX),planY:Number(truck.dataset.vehicleY),heading:Number(truck.dataset.vehicleHeading),phase:truck.dataset.vehiclePhase}};
          }, percent);
          const phase = percent % 100;
          const context = `${file} ${width}px ${theme} at ${percent}%`;
          assert.ok(near(pose.gate.progress,phase/100),`${context}: gate must read the truck's actual clock`);
          if (phase <= 14 || phase >= 78) assert.ok(near(pose.gate.y,-83*pose.gate.clearance), `${context}: gate should close unless a forklift needs clearance`);
          if (phase >= 20 && phase <= 68) assert.ok(near(pose.gate.y,-83), `${context}: gate should be fully open`);
          if (phase === 17 || phase === 73) assert.ok(near(pose.gate.y,-83*Math.max(.5,pose.gate.clearance)), `${context}: gate must follow the truck clock and preserve forklift clearance`);
          if (phase >= 14 && phase <= 68) assert.ok(near(pose.truck.planX,6) && near(pose.truck.planY,37) && near(pose.truck.heading,-90), `${context}: truck must remain docked with its rear towards the gate`);
          if (phase === 6) assert.ok(pose.truck.heading > -180 && pose.truck.heading < -90 && pose.truck.phase === 'turning',`${context}: truck must turn before reversing`);
          if (phase === 10 || phase === 12) assert.ok(pose.truck.planY > 37 && near(pose.truck.heading,-90) && pose.truck.phase === 'reversing',`${context}: truck must reverse towards its dock`);
          if (phase === 73) assert.ok(pose.truck.planY > 37, `${context}: gate should close as truck departs cab first`);
          if (phase === 80) assert.ok(pose.truck.heading > -90 && pose.truck.heading < 0 && pose.truck.phase === 'turning-out',`${context}: truck must turn out of its lane`);
          if (phase === 84) assert.ok(near(pose.truck.opacity,0), `${context}: departure should finish with gate closed`);
          checks++;
          if (file === 'index.html' && width === 1366 && theme === 'dark' && [0,6,12,40,73,80].includes(phase) && percent < 100) {
            await page.screenshot({path:resolve(output,`dock-${phase}.png`)});
          }
        }

        // Restore normal browser timing after manually seeking the animations.
        await page.reload();
        await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
        await page.waitForFunction(() => document.getElementById('twin-stage').classList.contains('is-still'));
        assert.ok(await page.$eval('#dock-gate', gate => {
          const transform = new DOMMatrixReadOnly(getComputedStyle(gate).transform);
          return gate.getAnimations().length === 0 && transform.f === -83;
        }), 'Reduced motion should leave the gate open beside the parked truck');
        checks++;

        await new Promise(resolve => setTimeout(resolve,100));
        await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
        await page.waitForFunction(() => !document.getElementById('twin-stage').classList.contains('is-still'));
        await page.evaluate(() => window.Router.go('gr',{instant:true}));
        assert.ok(await page.$eval('#twin-stage', mount => mount.classList.contains('is-paused')));
        await page.evaluate(() => window.Router.go('home',{instant:true}));
        assert.ok(await page.evaluate(() => {
          const animations = ['dock-truck'].map(id => document.getElementById(id).getAnimations()[0]);
          return animations.every(animation => animation && animation.playState === 'running' && animation.startTime === animations[0].startTime);
        }), 'All dock actors must resume together after navigation');
        checks++;
      }
    }
    console.log(`Dock timing, repeat, reduced-motion, and navigation checks passed: ${file}`);
  }
  assert.deepEqual(errors,[]);
} finally {
  await browser.close();
}
await writeFile(resolve(output,'report.json'),JSON.stringify({checks,files,errors},null,2));
console.log(`${checks} dock checks passed.`);
