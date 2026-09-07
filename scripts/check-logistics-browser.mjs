import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const output=resolve('artifacts/logistics');await mkdir(output,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],reports=[];
try {
  for(const file of ['index.html','preview-single-file.html']) {
    const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.setViewport({width:1366,height:900});
    // Control only the test page's clock, without exposing test controls in the app.
    await page.evaluateOnNewDocument(()=>{
      let next=0,time=0,frames=new Map(),logistics;
      window.requestAnimationFrame=callback=>{frames.set(++next,callback);return next;};
      window.cancelAnimationFrame=id=>frames.delete(id);
      Object.defineProperty(window,'WarehouseLogistics',{get:()=>logistics,set:value=>{
        const create=value.create;value.create=opts=>window.__model=create(opts);logistics=value;
      }});
      window.__advance=seconds=>{
        for(let i=0;i<seconds*10;i++) {
          time+=100;
          document.getAnimations().forEach(a=>{a.pause();a.currentTime=time;});
          const callbacks=frames;frames=new Map();callbacks.forEach(callback=>callback(time));
          const forklift=window.__model?.forklifts[0];
          if(forklift && forklift.x<12 && forklift.y>=26 && forklift.y<29 && forklift.phase==='move') {
            const lift=new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#dock-gate')).transform).f;
            if(lift>-48) throw new Error('A moving forklift reached the receiving gate before it opened');
          }
        }
      };
    });
    await page.goto(pathToFileURL(resolve(file)).href);
    await page.evaluate(()=>{document.documentElement.dataset.theme='light';window.__advance(.2);});
    let previous=0,extent={x:0,y:0},phases=new Set(),owners=new Set(),heights=new Set();
    for(const time of [1,4,8,12,20,32,44,60,80,100,140,180,220]) {
      await page.evaluate(seconds=>window.__advance(seconds),time-previous);previous=time;
      const data=await page.evaluate(()=>{
        const model=window.__model,admin=model.people.find(p=>p.id==='member-1');
        const green=document.querySelector('#returns-op');
        return {admin:{x:admin.x,y:admin.y},forks:model.forklifts.map(({x,y,lift,phase,cargo})=>({x,y,lift,phase,cargo})),
          stats:model.stats(),pallets:Array.from(document.querySelectorAll('[data-pallet]')).map(el=>({id:el.dataset.pallet,owner:el.dataset.owner})),
          green:{x:Number(green.dataset.planX),y:Number(green.dataset.planY),behind:!!(green.compareDocumentPosition(document.querySelector('[data-container="shipping"]')) & Node.DOCUMENT_POSITION_FOLLOWING)},
          wrapper:{phase:document.querySelector('#wrapping-pallet').dataset.wrappingPhase,angle:Number(document.querySelector('#wrapping-pallet').dataset.vehicleHeading),film:document.querySelector('#wrapping-film').getBBox().height,operator:document.querySelector('#wrapping-operator').classList.contains('is-wrapping')}};
      });
      assert.equal(new Set(data.pallets.map(p=>p.id)).size,data.pallets.length);
      assert.equal(data.green.x,93);assert.ok(data.green.behind,'Green alley operator must be behind the container');
      assert.ok(data.green.y>=5 && data.green.y<=23);
      // A carried pallet outside the rack must be drawn out in the aisle,
      // rather than staying hidden under a shelf after the forks reverse.
      assert.ok(await page.evaluate(()=>window.__model.cargo().every(p=>{
        if(p.owner!=='shuttle' || p.y<18.5) return true;
        return !document.querySelector('[data-pallet="'+p.id+'"]').closest('.iso-rack-bank');
      })));
      extent.x=Math.max(extent.x,data.admin.x);extent.y=Math.max(extent.y,data.admin.y);
      phases.add(data.wrapper.phase);heights.add(data.wrapper.film.toFixed(1));data.pallets.forEach(p=>owners.add(p.owner));
      if(file==='index.html' && [1,4,8,20,44,60,100].includes(time)) await page.screenshot({path:resolve(output,`activity-${time}s.png`)});
      if(time===220) {
        assert.ok(data.stats.delivered>=2,'Visible warehouse must finish multiple deliveries');
        reports.push({file,stats:data.stats,extent,owners:[...owners],wrappingPhases:[...phases]});
      }
    }
    assert.ok(extent.x>95 && extent.y>60,'Ngân must patrol beyond PutAway');
    assert.equal(phases.size,2);assert.ok(heights.size>4,'Film must build up while the pallet spins');
    assert.ok(owners.has('green-buffer') && owners.has('rack-ground') && owners.has('shuttle'));
    await page.setViewport({width:390,height:844});
    await page.evaluate(()=>window.__advance(.5));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth && document.documentElement.scrollHeight===innerHeight));
    await page.screenshot({path:resolve(output,`${file==='index.html'?'main':'preview'}-phone.png`)});
    await page.close();
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
await writeFile(resolve(output,'browser-report.json'),JSON.stringify({reports,errors},null,2));
console.log('Pallet transfers, wrapping, alley depth, admin patrol, and mobile layout passed in both app files.');
