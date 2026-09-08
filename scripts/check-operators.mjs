import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';

const context=vm.createContext({window:{}});
vm.runInContext(await readFile('js/operators.js','utf8'),context);
const foot=context.window.WarehouseOperators.foot;
for(let travel=0;travel<8;travel+=.01) {
  const a=foot(travel,0,1),b=foot(travel,.5,1);
  assert.ok(a.stance || b.stance,'At least one foot must support the body');
  assert.ok(a.z>=0 && b.z>=0,'Feet must remain above the floor');
  const next=foot(travel+.001,0,1);
  if(a.stance && next.stance) assert.ok(Math.abs(next.y-a.y+.001)<1e-8,'A planted foot must not slide');
  assert.equal(foot(travel,0,0).z,0,'A stopped operator rests on the floor');
}

const output=resolve('artifacts/operators');await mkdir(output,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],reports=[];
try {
  for(const file of ['index.html','preview-single-file.html']) {
    const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.setViewport({width:1440,height:900});
    await page.evaluateOnNewDocument(()=>{
      let frames=new Map(),next=0,time=0,logistics;
      window.requestAnimationFrame=callback=>{frames.set(++next,callback);return next;};
      window.cancelAnimationFrame=id=>frames.delete(id);
      Object.defineProperty(window,'WarehouseLogistics',{get:()=>logistics,set:value=>{
        const create=value.create;value.create=opts=>window.__model=create(opts);logistics=value;
      }});
      window.__advance=seconds=>{
        for(let i=0;i<Math.round(seconds*20);i++) {
          time+=50;
          document.getAnimations().forEach(a=>{a.pause();a.currentTime=time;});
          const callbacks=frames;frames=new Map();callbacks.forEach(callback=>callback(time));
        }
      };
    });
    await page.goto(pathToFileURL(resolve(file)).href);
    console.log('Checking operator motion: '+file);
    await page.evaluate(()=>{document.documentElement.dataset.theme='light';window.__advance(.1);});
    assert.equal(await page.$$eval('.op-rig',nodes=>nodes.length),10);
    const samples=[];
    for(let n=0;n<4;n++) {
      await page.evaluate(()=>window.__advance(.25));
      samples.push(await page.evaluate(()=>[...document.querySelectorAll('.op-rig')].map(body=>{
        const box=body.getBBox();return {svg:body.outerHTML,box:{x:box.x-6,y:box.y-6,width:box.width+12,height:box.height+12}};
      })));
    }
    const feet=await page.$eval('#roamer [data-body-part="boot-0"]',el=>el.innerHTML);
    await page.evaluate(()=>window.__advance(.3));
    assert.notEqual(await page.$eval('#roamer [data-body-part="boot-0"]',el=>el.innerHTML),feet);
    await page.screenshot({path:resolve(output,file==='index.html'?'desktop.png':'preview.png')});
    const directions=new Set();
    for(let n=0;n<30;n++) {
      await page.evaluate(()=>window.__advance(.5));
      directions.add(await page.$eval('#roamer',el=>Math.round(Number(el.dataset.operatorHeading)/30)*30));
    }
    assert.ok(directions.size>=3,'Alley operators must turn through intermediate headings');
    const adminBefore=await page.$eval('[data-member="1"]',el=>el.getAttribute('transform'));
    await page.$eval('[data-crew-button="1"]',el=>el.click());
    await page.evaluate(()=>window.__advance(.7));
    const greetingArm=await page.$eval('[data-member="1"] [data-body-part="hand-1"]',el=>el.innerHTML);
    await page.evaluate(()=>window.__advance(.2));
    assert.notEqual(await page.$eval('[data-member="1"] [data-body-part="hand-1"]',el=>el.innerHTML),greetingArm,'Greeting must articulate the hand');
    assert.equal(await page.$eval('[data-member="1"]',el=>el.getAttribute('transform')),adminBefore,'Greeting pauses travel');
    assert.equal(await page.$eval('[data-member="1"]',el=>el.dataset.operatorAction),'greeting');
    await page.screenshot({path:resolve(output,file==='index.html'?'greeting.png':'preview-greeting.png')});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await page.waitForFunction(()=>document.querySelector('#twin-stage').classList.contains('is-still'),{polling:50});
    await page.evaluate(()=>window.__advance(.2));
    const still=await page.$$eval('.op-rig',nodes=>nodes.map(n=>n.innerHTML));
    await page.evaluate(()=>window.__advance(1));
    assert.ok(JSON.stringify(await page.$$eval('.op-rig',nodes=>nodes.map(n=>n.innerHTML)))===JSON.stringify(still),'Reduced motion freezes all joints');
    await page.setViewport({width:390,height:844});
    await page.evaluate(()=>window.__advance(.2));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth && document.documentElement.scrollHeight===innerHeight));
    await page.screenshot({path:resolve(output,file==='index.html'?'phone.png':'preview-phone.png')});
    if(file==='index.html') {
      await page.setViewport({width:1100,height:1300});
      await page.evaluate(samples=>{
        const ns='http://www.w3.org/2000/svg',gallery=document.createElement('div');
        gallery.style.cssText='display:grid;grid-template-columns:repeat(10,1fr);gap:6px;background:#d9e1e2;padding:20px;';
        samples.forEach(row=>row.forEach(item=>{
          const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',Object.values(item.box).join(' '));
          svg.style.cssText='width:100%;height:220px;background:#e8eded;';svg.innerHTML=item.svg;gallery.appendChild(svg);
        }));
        document.body.replaceChildren(gallery);
      },samples);
      await page.screenshot({path:resolve(output,'stride-study.png')});
    }
    reports.push({file,operators:10,turnHeadings:[...directions],greeting:true,reducedMotion:true,mobile:true});
    await page.close();
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
await writeFile(resolve(output,'report.json'),JSON.stringify({reports,errors},null,2));
console.log('Operator foot contact, turns, greetings, reduced motion, and phone layout passed in both app files.');
