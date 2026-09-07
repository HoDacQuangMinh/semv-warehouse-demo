import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('artifacts/interactions');
await mkdir(output,{recursive:true});
const browser = await puppeteer.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']});
const errors = [];
let checks = 0;
try {
  const page = await browser.newPage();
  page.on('pageerror',error => errors.push(error.message));
  for (const file of ['index.html','preview-single-file.html']) {
    for (const [width,height] of [[1366,768],[390,844],[480,270]]) {
      await page.setViewport({width,height,deviceScaleFactor:1,isMobile:false,hasTouch:false});
      await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
      await page.goto(pathToFileURL(resolve(file)).href);
      assert.equal(await page.$$eval('[data-member]',nodes => nodes.length),5);
      assert.equal(await page.$$eval('.iso-figure[role="button"]',nodes => nodes.length),0);
      assert.ok(Number(await page.$eval('#twin-stage',el => el.dataset.mapZoom)) > 1);
      checks += 3;
      for (let index = 0; index < 5; index++) {
        const selector = `[data-member="${index}"] .iso-member-body`;
        await page.click(selector);
        assert.equal(await page.evaluate(() => window.Router.current()),'home','Crew click opened a station');
        const popup = await page.$eval('.twin__greeting',el => ({hidden:el.hidden,text:el.textContent,box:el.getBoundingClientRect().toJSON()}));
        assert.equal(popup.hidden,false,`Greeting missing for member ${index} at ${width}px`);
        assert.ok(popup.text.includes(['Sơn','Ngân','Minh','Trí','Bách'][index]),`Wrong greeting for member ${index} at ${width}x${height}: ${popup.text}`);
        assert.ok(popup.box.left >= 0 && popup.box.right <= width && popup.box.top >= 0 && popup.box.bottom <= height);
        assert.equal(await page.$eval(`[data-member="${index}"] .iso-member-arm`,el => getComputedStyle(el).animationName),'none');
        checks += 5;
      }
      const phrases = new Set();
      for (let n = 0; n < 3; n++) {
        await page.$eval('[data-member="0"]',el => el.focus());
        await page.keyboard.press(n % 2 ? 'Space' : 'Enter');
        phrases.add(await page.$eval('.twin__greeting span',el => el.textContent));
      }
      assert.deepEqual([...phrases].sort(),['Hello!','I love RMIT!','Xin chào!'].sort());
      checks++;
      const caption = await page.$eval('.stage-overlay',el => el.getBoundingClientRect().toJSON());
      const before = await page.$eval('.twin__svg',svg => svg.getAttribute('viewBox'));
      const member = await page.$('[data-member="0"] .iso-member-body');
      const box = await member.boundingBox();
      await page.mouse.move(box.x + box.width / 2,box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 45,box.y + box.height / 2 + 25,{steps:8});
      await page.mouse.up();
      assert.notEqual(await page.$eval('.twin__svg',svg => svg.getAttribute('viewBox')),before);
      assert.equal(await page.evaluate(() => window.Router.current()),'home');
      assert.equal(await page.$eval('.twin__greeting',el => el.hidden),true,'Dragging triggered a greeting');
      const after = await page.$eval('.stage-overlay',el => el.getBoundingClientRect().toJSON());
      assert.equal(after.left,caption.left);
      assert.equal(after.bottom,caption.bottom);
      await page.click('[data-map="in"]');
      assert.ok(Number(await page.$eval('#twin-stage',el => el.dataset.mapZoom)) > 1.15);
      await page.click('[data-map="reset"]');
      assert.equal(await page.$eval('.twin__svg',svg => svg.getAttribute('viewBox')),'58 -35 988 662');
      assert.equal(await page.$eval('[data-map="out"]',el => el.disabled),true);
      checks += 8;
      if (width === 390 && file === 'index.html') {
        await page.click('[data-member="1"] .iso-member-body');
        await page.screenshot({path:resolve(output,'greeting-phone.png')});
      }
      console.log(`Crew clicks, keyboard, drag, and zoom passed: ${file}, ${width}x${height}`);
    }

    await page.setViewport({width:1366,height:768,isMobile:false,hasTouch:false});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
    await page.reload();
    await page.click('[data-member="0"] .iso-member-body');
    assert.equal(await page.$eval('[data-member="0"] .iso-member-arm',el => getComputedStyle(el).animationName),'crew-wave');
    await page.screenshot({path:resolve(output,file === 'index.html' ? 'greeting-desktop.png' : 'greeting-preview.png')});
    await page.waitForFunction(() => document.querySelector('.twin__greeting').hidden,{timeout:5000});
    assert.equal(await page.$$eval('.iso-member.is-greeting',nodes => nodes.length),0);
    checks += 3;

    await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await page.reload();
    await page.tap('[data-member="2"] .iso-member-body');
    assert.equal(await page.$eval('.twin__greeting',el => el.hidden),false);
    const stage = await page.$('#twin-stage');
    const stageBox = await stage.boundingBox();
    const cx = stageBox.x + stageBox.width / 2, cy = stageBox.y + stageBox.height / 2;
    const cdp = await page.createCDPSession();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-30,y:cy,id:0},{x:cx+30,y:cy,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-65,y:cy+10,id:0},{x:cx+65,y:cy+10,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(Number(await page.$eval('#twin-stage',el => el.dataset.mapZoom)) > 1.5,'Pinch did not enlarge the map');
    assert.equal(await page.evaluate(() => window.Router.current()),'home');
    assert.equal(await page.$eval('.twin__greeting',el => el.hidden),true);
    checks += 4;
    await cdp.detach();
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors},null,2));
console.log(`${checks} interaction checks passed.`);
