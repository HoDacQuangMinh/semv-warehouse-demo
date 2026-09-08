import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const output=resolve('artifacts/wrapping');await mkdir(output,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],reports=[];
try {
  for(const file of ['index.html','preview-single-file.html']) {
    const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.setViewport({width:1440,height:900});
    await page.evaluateOnNewDocument(()=>{
      let renderer,next=0,frames=new Map();
      window.requestAnimationFrame=callback=>{frames.set(++next,callback);return next;};
      window.cancelAnimationFrame=id=>frames.delete(id);
      window.__frame=()=>{const callbacks=frames;frames=new Map();callbacks.forEach(callback=>callback(0));};
      // Exercise the real wrapping renderer without advancing unrelated traffic.
      Object.defineProperty(window,'WarehouseLogisticsRenderer',{get:()=>renderer,set:value=>{
        const create=value.create;value.create=(...args)=>{
          const instance=create(...args);window.__wrap=seconds=>instance.draw({dt:seconds*1000,receiving:{progress:.4}});return instance;
        };renderer=value;
      }});
    });
    await page.goto(pathToFileURL(resolve(file)).href);
    console.log('Checking wrapping geometry: '+file);
    await page.evaluate(()=>{document.documentElement.dataset.theme='light';window.__frame();});
    let previous=0;const snapshots=[],angles=[];
    for(const time of [0,.5,1.4,2.5,3.5,4.5,6.5,8.5,9.5,10,12,13,13.9,14,15]) {
      await page.evaluate(seconds=>window.__wrap(seconds),time-previous);previous=time;
      const data=await page.evaluate(()=>{
        const load=document.querySelector('#wrapping-pallet'),web=document.querySelector('#wrapping-web');
        const marker=document.querySelector('[data-node-app="interlock"]'),area=document.querySelector('[data-layout-area="interlock"]');
        const wrapper=document.querySelector('.iso-wrapper'),box=wrapper.getBBox();
        return {angle:Number(load.dataset.vehicleHeading),filmTop:Number(load.dataset.filmTop),loadTop:Number(load.dataset.loadTop),
          bottom:Number(document.querySelector('#wrapping-carriage').dataset.filmBottom),
          contact:[Number(web.dataset.contactX),Number(web.dataset.contactY)],web:web.getAttribute('d'),
          wrapping:web.style.visibility==='visible',markerBehind:!!(marker.compareDocumentPosition(area)&Node.DOCUMENT_POSITION_FOLLOWING),
          svg:wrapper.outerHTML,box:{x:box.x-6,y:box.y-6,width:box.width+12,height:box.height+12}};
      });
      assert.ok(data.filmTop<=data.loadTop+.001,'The film must not rise above the cartons');
      assert.ok(data.bottom>=2.43-.001 && data.bottom+1.55<=data.loadTop+.001,'Roll stays within load height');
      assert.ok(data.markerBehind,'Station ring must remain behind the wrapping machine');
      assert.ok(!/NaN|undefined/.test(data.web));
      if(data.wrapping) {
        assert.ok(Math.abs(data.bottom+1.55-data.filmTop)<.002,'Roll and wrapping band must share the same height');
        const rad=data.angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
        const feed=[68.83,52.15],contact=data.contact;
        const corners=[[-3.13,-3.13],[3.13,-3.13],[3.13,3.13],[-3.13,3.13]].map(([x,y])=>[63+x*c-y*s,53+x*s+y*c]);
        for(const corner of corners) {
          const side=(contact[0]-feed[0])*(corner[1]-feed[1])-(contact[1]-feed[1])*(corner[0]-feed[0]);
          assert.ok(side>=-.002,'The feed must touch an outside tangent, never cut through cartons');
        }
      }
      angles.push(data.angle);
      if([0,1.4,2.5,3.5,4.5,6.5,8.5,10,13].includes(time)) snapshots.push({...data,time});
    }
    assert.ok(angles[1]<30,'Turntable eases into rotation');
    assert.equal(angles[9],1080);assert.equal(angles[10],1080);
    assert.equal(angles[13],0,'The next cycle starts at the same orientation');
    await page.screenshot({path:resolve(output,file==='index.html'?'desktop.png':'preview.png')});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await page.waitForFunction(()=>document.querySelector('#twin-stage').classList.contains('is-still'),{polling:50});
    for(const width of [1440,390]) {
      await page.setViewport({width,height:width===390?844:900});
      await page.evaluate(()=>window.__frame());
      await page.click('.iso-wrapper-top');
      assert.equal(await page.evaluate(()=>window.Router.current()),'interlock','The machine still opens its app');
      await page.evaluate(()=>{window.Router.go('home',{instant:true});window.__frame();});
    }
    await page.screenshot({path:resolve(output,file==='index.html'?'phone.png':'preview-phone.png')});
    if(file==='index.html') {
      await page.setViewport({width:1050,height:1300});
      await page.evaluate(snapshots=>{
        const gallery=document.createElement('div');gallery.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:12px;background:#e1e7e8;';
        snapshots.forEach(item=>{
          const cell=document.createElement('div');cell.style.cssText='background:#edf1f1;padding:8px;font:14px sans-serif;color:#28373d;';
          const label=document.createElement('div');label.textContent=item.time+' s';cell.appendChild(label);
          const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
          svg.setAttribute('viewBox',Object.values(item.box).join(' '));svg.style.cssText='width:100%;height:355px;';svg.innerHTML=item.svg;
          cell.appendChild(svg);gallery.appendChild(cell);
        });document.body.replaceChildren(gallery);
      },snapshots);
      await page.screenshot({path:resolve(output,'cycle.png')});
    }
    reports.push({file,angles,tangentClearance:true,filmHeight:true,stationTargets:true});
    await page.close();
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
await writeFile(resolve(output,'report.json'),JSON.stringify({reports,errors},null,2));
console.log('Wrapping alignment, tangent feed, height limits, smooth cycle, and station targets passed in both app files.');
