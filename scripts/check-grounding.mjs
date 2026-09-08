import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {mkdir,writeFile} from 'node:fs/promises';
const output='artifacts/grounding';await mkdir(output,{recursive:true});
const capture=process.env.GROUNDING_SCREENSHOTS!=='0';
const browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const reports=[],errors=[];
try {
 for(const file of ['index.html','preview-single-file.html']) {
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:900});
  await page.evaluateOnNewDocument(()=>{
   let frame=0,time=0,queue=new Map();
   window.requestAnimationFrame=fn=>{queue.set(++frame,fn);return frame;};window.cancelAnimationFrame=id=>queue.delete(id);
   window.advance=ms=>{for(let elapsed=0;elapsed<ms;elapsed+=50){time+=50;const pending=queue;queue=new Map();pending.forEach(fn=>fn(time));}};
  });
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.goto('file:///D:/semv-warehouse-demo/'+file);
  await page.evaluate(()=>{document.documentElement.dataset.theme='light';advance(50);});
  const grounding=await page.evaluate(()=>{
   const points=node=>node.getAttribute('points').split(' ').map(s=>s.split(',').map(Number));
   const close=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<.16;
   const origin=points(document.querySelector('.iso-floor-top'))[0];
   const ground=(x,y)=>[origin[0]+(x-y)*.866*6.1,origin[1]+(x+y)*.5*6.1];
   const shadow=document.querySelector('.iso-equipment-shadows');
   const pads=[...document.querySelectorAll('.iso-rack-floor')];
   const feet=[...document.querySelectorAll('.iso-rack-foot')];
   const expected=[23,63].flatMap(x=>[0,10.5,21].flatMap(dx=>[3,17].map(y=>[x+dx-.4,y-.25])));
   const feetTouch=feet.every((foot,i)=>{
    const side=points(foot.querySelector('.iso-steel-left')),[x,y]=expected[i];
    return close(side[2],ground(x+1.6,y+1.6)) && close(side[3],ground(x,y+1.6));
   });
   const toteBases=[...document.querySelectorAll('[data-layout-area="gr"] .iso-rib-left,[data-layout-area="returnables"] .iso-rib-left')];
   const totes=[12,26].flatMap(x=>[47,53].flatMap(y=>[0,5].map(dx=>[x+dx,y,4.6,5.4])))
    .concat([[86,48,4.3,5.2],[91,48,4.3,5.2],[86,54,4.3,5.2]]);
   const totesTouch=toteBases.length===11 && toteBases.every((base,i)=>{
    const side=points(base),[x,y,w,d]=totes[i];return close(side[2],ground(x+w,y+d)) && close(side[3],ground(x,y+d));
   });
   const top=points(document.querySelector('.iso-wrapper-top'));
   const sides=[...document.querySelectorAll('.iso-wrapper-side')];
   let gap=0;
   sides.forEach(side=>{
    const p=points(side);if(!top.some(t=>close(t,p[2])) || !top.some(t=>close(t,p[3])))gap=100;
    // Each visible rim endpoint has a side reaching all the way to the slab.
    for(const [low,high] of [[p[0],p[3]],[p[1],p[2]]]) gap=Math.max(gap,Math.abs((low[1]-high[1])-6.1*(1.75-.7)),Math.abs(low[0]-high[0]));
   });
   return {feet:feet.length,feetTouch,totesTouch,sideFaces:sides.length,maximumSeamError:gap,
    floorBeforeShadows:pads.length===2 && pads.every(p=>!!(p.compareDocumentPosition(shadow)&Node.DOCUMENT_POSITION_FOLLOWING)),
    noFloorOverShadows:!document.querySelector('.iso-rack-bank .iso-pallet-pad'),
    wrapperContact:!!document.querySelector('.iso-wrapper-grounding .iso-contact-shadow')};
  });
  assert.equal(grounding.feet,12);assert.equal(grounding.feetTouch,true);assert.equal(grounding.sideFaces,24);
  assert.equal(grounding.totesTouch,true);
  assert.ok(grounding.maximumSeamError<.16);assert.equal(grounding.floorBeforeShadows,true);assert.equal(grounding.noFloorOverShadows,true);assert.equal(grounding.wrapperContact,true);
  if(file==='index.html' && capture) {
   for(const theme of ['light','dark']) {
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await page.screenshot({path:`${output}/warehouse-${theme}.png`});
   }
   await page.setViewport({width:390,height:844});await page.evaluate(()=>advance(100));
   await page.screenshot({path:`${output}/phone.png`});
  }
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.evaluate(()=>{Router.go('putaway',{instant:true});WarehouseHandoff.play('putaway');advance(10000);});
  assert.equal(await page.$eval('#handoff [data-load]',n=>n.dataset.owner),'wrapping');
  const handoff=await page.evaluate(()=>{
   const points=n=>n.getAttribute('points').split(' ').map(s=>s.split(',').map(Number));
   const top=points(document.querySelector('#handoff .iso-wrapper-top'));
   const sides=[...document.querySelectorAll('#handoff .iso-wrapper-side')];
   return {faces:sides.length,connected:sides.every(n=>{
    const p=points(n);return top.some(t=>Math.hypot(t[0]-p[3][0],t[1]-p[3][1])<.001) && Math.abs(p[0][1]-p[3][1]-4.8)<.001;
   })};
  });
  assert.equal(handoff.faces,24);assert.equal(handoff.connected,true);
  if(file==='index.html' && capture){await page.setViewport({width:1440,height:900});await page.evaluate(()=>document.documentElement.dataset.theme='light');await page.screenshot({path:`${output}/handoff.png`});}
  await page.evaluate(()=>WarehouseHandoff.cancel());
  reports.push({file,...grounding,handoff});await page.close();console.log('Equipment floor contact and handoff supports passed: '+file);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
await writeFile(`${output}/report.json`,JSON.stringify({reports,errors},null,2));
