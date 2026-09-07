import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output=resolve('artifacts/crew-routes');
await mkdir(output,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let checks=0;
try {
  const page=await browser.newPage();
  for(const file of ['index.html','preview-single-file.html']) {
    for(const [width,height] of [[1366,768],[390,844],[480,270]]) {
      await page.setViewport({width,height});
      await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
      await page.goto(pathToFileURL(resolve(file)).href);
      for(let index=0;index<5;index++) {
        const selector=`[data-crew-button="${index}"]`;
        await page.click(selector);
        assert.equal(await page.evaluate(()=>window.Router.current()),'home');
        assert.ok(await page.$eval('.twin__greeting',(el,name)=>!el.hidden && el.textContent.includes(name),['Sơn','Ngân','Minh','Trí','Bách'][index]));
        const box=await page.$eval(selector,el=>el.getBoundingClientRect().toJSON());
        assert.ok(box.width>=32 && box.height>=28 && (height<300 || box.height>=44));
        checks+=3;
      }
      await page.screenshot({path:resolve(output,`${file==='index.html'?'main':'preview'}-${width}.png`)});
    }
    await page.setViewport({width:1366,height:768});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
    await page.reload();
    await page.mouse.move(5,5);
    const read=()=>page.$eval('[data-member="1"]',el=>el.getAttribute('transform'));
    const initial=await read();
    await delay(450);
    assert.notEqual(await read(),initial,'Ngân should walk when the plan is active');
    await page.hover('[data-crew-button="1"]');
    const hovering=await read();
    await delay(350);
    assert.equal(await read(),hovering,'Ngân should pause for a pointer');
    await page.click('[data-crew-button="1"]');
    await page.mouse.move(5,5);
    const greeting=await read();
    await delay(350);
    assert.equal(await read(),greeting,'Ngân should stay put while greeting');
    await page.waitForFunction(()=>document.querySelector('.twin__greeting').hidden,{timeout:5000});
    const afterGreeting=await read();
    await delay(450);
    assert.notEqual(await read(),afterGreeting,'Ngân should resume after the greeting');
    checks+=4;

    // The shipping truck must turn as well, with a fixed heading while backing.
    for(const [percent,phase] of [[8,'turning'],[16,'reversing'],[40,'loading'],[74,'turning-out']]) {
      const state=await page.evaluate(async percent=>{
        const truck=document.getElementById('shipping');
        const animation=truck.getAnimations()[0];
        animation.pause(); animation.currentTime=percent/100*animation.effect.getTiming().duration;
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        return {...truck.dataset};
      },percent);
      assert.equal(state.vehiclePhase,phase);
      if(phase==='turning') assert.ok(Number(state.vehicleHeading)<0 && Number(state.vehicleHeading)>-90);
      if(phase==='reversing') assert.equal(Number(state.vehicleHeading),-90);
      if(phase==='loading') assert.equal(Number(state.vehicleY),37);
      await page.screenshot({path:resolve(output,`shipping-${percent}.png`)});
      checks++;
    }
  }
} finally {await browser.close();}
await writeFile(resolve(output,'report.json'),JSON.stringify({checks,issues:[]},null,2));
console.log(`${checks} crew route and shipping manoeuvre checks passed.`);
