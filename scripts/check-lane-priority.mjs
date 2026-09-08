import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[];
try {
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:1366,height:900});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.evaluateOnNewDocument(()=>{
    let next=0,time=0,frames=new Map();
    window.requestAnimationFrame=callback=>{frames.set(++next,callback);return next;};
    window.cancelAnimationFrame=id=>frames.delete(id);
    window.__tick=()=>{
      time+=100;
      // Advance each vehicle's own clock, preserving an intentional traffic
      // hold. Run the app with live animations, then park browser playback.
      document.getAnimations().forEach(a=>{
        if(a.effect.target.dataset.trafficHold!=='true' && a.effect.target.dataset.loadingHold!=='true') {
          const clock=a.currentTime || 0;a.play();a.currentTime=clock+100;
        }
      });
      const callbacks=frames;frames=new Map();callbacks.forEach(callback=>callback(time));
      document.getAnimations().forEach(a=>a.pause());
    };
  });
  for(const file of ['index.html','preview-single-file.html']) {
    await page.goto(pathToFileURL(resolve(file)).href);
    const result=await page.evaluate(()=>{
      let priority=false,held=false,dropped=false,loaded=false,exited=false,dropAt=0,exitAt=0;
      for(let frame=0;frame<1400;frame++) {
        window.__tick();
        const truck=document.querySelector('#shipping'),fork=document.querySelector('#shuttle');
        priority ||= truck.dataset.lanePriority==='true';
        if(truck.dataset.trafficHold==='true') {
          held=true;
          if(truck.dataset.vehiclePhase!=='away') throw new Error('Truck must wait outside the lane');
        }
        if(!dropped && document.querySelector('[data-owner="green-buffer"]')) {
          dropped=true;dropAt=frame/10;
          if(fork.dataset.cargo!=='') throw new Error('Forklift must release its load inside the container');
        }
        if(document.querySelector('[data-owner="truck-out"]')) loaded=true;
        if(dropped && loaded && Number(fork.dataset.vehicleX)<98 && truck.dataset.trafficHold==='false') {
          exited=true;exitAt=frame/10;break;
        }
      }
      return {priority,held,dropped,loaded,exited,dropAt,exitAt};
    });
    assert.ok(result.priority && result.held && result.dropped && result.loaded && result.exited,JSON.stringify(result));
    assert.ok(result.dropAt<50 && result.exitAt-result.dropAt<85,'The forklift must stage, reload the truck, then clear the lane without deadlocking');
    console.log(file,result);
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
