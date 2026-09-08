import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],report=[];
const sizes=[[320,568],[360,800],[390,844],[430,932],[600,960],[768,1024],[820,1180],[1024,1366],[1024,768],[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1440],[3840,2160],[568,320],[844,390],[1280,480],[1536,864],[960,540],[640,360],[480,270]];
try {
 for(const file of ['index.html','preview-single-file.html']) {
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument(()=>{
   let serial=0,time=0,frames=new Map();
   window.requestAnimationFrame=callback=>{frames.set(++serial,callback);return serial;};window.cancelAnimationFrame=id=>frames.delete(id);
   window.advance=ms=>{for(let t=0;t<ms;t+=50){time+=50;const current=frames;frames=new Map();current.forEach(fn=>fn(time));}};
  });
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.goto('file:///D:/semv-warehouse-demo/'+file);
  for(const [width,height] of sizes) {
   await page.setViewport({width,height});
   for(const lang of ['vi','en'])for(const theme of ['light','dark'])for(const view of ['home','more','gr','putaway','interlock']) {
    const fit=await page.evaluate(({lang,theme,view})=>{
     I18N.setLanguage(lang);document.documentElement.dataset.theme=theme;Router.go(view,{instant:true});advance(150);
     const active=document.querySelector('.view.is-active');
     const failures=[];
     if(active.scrollWidth>active.clientWidth+1)failures.push('view overflow');
     if(view==='home' && active.scrollHeight>active.clientHeight+1)failures.push('home scroll');
     for(const el of active.querySelectorAll('button,h1,h2,.terminal,.project-route,.team__card')) {
      if(el.closest('#twin-stage') || !el.getClientRects().length)continue;
      const r=el.getBoundingClientRect();if(r.left < -1 || r.right>innerWidth+1)failures.push(el.className || el.tagName);
     }
     return failures;
    },{lang,theme,view});
    assert.deepEqual(fit,[],`${file} ${width}x${height} ${lang} ${theme} ${view}`);
   }
  }
  console.log(file+': 440 responsive layouts passed');
  await page.setViewport({width:1440,height:900});
  await page.evaluate(()=>{Router.go('more',{instant:true});document.querySelector('#scan-btn').click();});
  assert.equal(await page.$eval('#scan-out',n=>!n.hidden && n.textContent.includes('BX-00001')),true);
  await page.click('#challenge-mount [data-act=start]');
  const choose=async selector=>page.$eval(selector,n=>n.click());
  await choose('[data-carton="BX-00003"]');await choose('[data-line=L1]');
  assert.equal(await page.$eval('[data-carton="BX-00003"]',n=>n.disabled),false,'Wrong docket line must be rejected');
  await choose('[data-line=L3]');
  for(const [box,line] of [['BX-00002','L2'],['BX-00004','L4']]){await choose(`[data-carton="${box}"]`);await choose('#challenge-mount [data-act=flag]');await choose(`[data-line=${line}]`);}
  await choose('[data-carton="BX-00001"]');await choose('[data-line=L1]');
  assert.equal(await page.$$eval('.ch__review .is-good',ns=>ns.length),4);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.evaluate(()=>Router.go('gr',{instant:true}));
  for(const action of ['open','docket','box','dup','box','box','finalize','empty','empty','empty','note','sign','sign','sign']) await choose('#view-gr [data-act='+action+']');
  await page.waitForSelector('#handoff');
  assert.equal(await page.$eval('main',n=>n.inert),true);
  await page.evaluate(()=>advance(3500));
  assert.equal(await page.$eval('#handoff [data-load]',n=>n.dataset.owner),'operator');
  await page.evaluate(()=>advance(3700));
  assert.equal(await page.evaluate(()=>Router.current()),'putaway');
  await choose('#view-putaway [data-act=scan]');await choose('#view-putaway .bin.is-suggested');await choose('#view-putaway [data-act=confirm]');
  await page.evaluate(()=>advance(10000));
  assert.equal(await page.$eval('#handoff [data-load]',n=>n.dataset.owner),'wrapping');
  assert.equal(await page.$eval('#handoff',n=>/NaN|undefined/.test(n.innerHTML)),false);
  await page.evaluate(()=>advance(3300));
  assert.equal(await page.evaluate(()=>Router.current()),'interlock');
  for(const action of ['pallet','hu2','wrong','ean','hu2','ean','hu2','ean','green']) await choose('#view-interlock [data-act='+action+']');
  assert.equal(await page.$eval('#transition',n=>!n.hidden && !!n.querySelector('.tf-body')),true,'Use the detailed forklift for the return');
  await page.waitForFunction(()=>Router.current()==='home',{polling:100});
  await page.waitForFunction(()=>document.querySelector('#transition').hidden,{polling:100});
  assert.equal(await page.evaluate(()=>WarehouseState.allDone()),true);
  assert.equal(await page.$eval('main',n=>n.inert),false);
  // Keyboard skip, live motion preference, and cancellation leave no stale overlay.
  await page.evaluate(()=>{Router.go('gr',{instant:true});WarehouseHandoff.play('gr');advance(250);});
  await page.keyboard.press('Escape');assert.equal(await page.$('#handoff'),null);
  await page.evaluate(()=>{WarehouseHandoff.play('putaway');});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.evaluate(()=>advance(100));
  await page.waitForFunction(()=>!WarehouseHandoff.isActive(),{polling:100});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.evaluate(()=>{WarehouseHandoff.play('gr');Router.go('home',{instant:true});});
  assert.equal(await page.$('#handoff'),null);
  report.push({file,layouts:440,journey:'passed',challenge:'passed'});
  await page.close();
 }
 assert.deepEqual(errors,[]);
} finally {await browser.close();}
await mkdir('artifacts/experience',{recursive:true});await writeFile('artifacts/experience/report.json',JSON.stringify({report,errors},null,2));console.log(JSON.stringify({report,errors},null,2));
