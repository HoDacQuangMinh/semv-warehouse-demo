import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const output=resolve('artifacts/chatter');await mkdir(output,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],reports=[];
try {
  for(const file of ['index.html','preview-single-file.html']) {
    const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.setViewport({width:1440,height:900});
    await page.evaluateOnNewDocument(()=>{
      let time=0,next=0,frames=new Map(),seed=42;
      Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      window.requestAnimationFrame=callback=>{frames.set(++next,callback);return next;};
      window.cancelAnimationFrame=id=>frames.delete(id);
      window.__step=()=>{
        time+=500;
        document.getAnimations().forEach(a=>{a.pause();a.currentTime=time;});
        const callbacks=frames;frames=new Map();callbacks.forEach(callback=>callback(time));
        const bubble=document.querySelector('.twin__chatter');
        return {visible:!bubble.hidden,text:bubble.textContent,name:bubble.querySelector('strong')?.textContent,
          count:document.querySelectorAll('.is-speaking').length,
          admin:document.querySelector('[data-member="1"]').getAttribute('transform')};
      };
    });
    await page.goto(pathToFileURL(resolve(file)).href);
    console.log('Checking spontaneous conversation: '+file);
    const speakers=new Set(),phrases=new Set();let last=null,adminMoving=false,captured=false;
    for(let step=0;step<240;step++) {
      const state=await page.evaluate(()=>window.__step());
      assert.ok(state.count<=1,'Only one teammate speaks at a time');
      if(state.visible) {
        speakers.add(state.name);phrases.add(state.text.replace(state.name,''));
        if(state.name==='Ngân' && last?.name==='Ngân' && last.visible && state.admin!==last.admin) adminMoving=true;
        if(!captured) {await page.screenshot({path:resolve(output,file==='index.html'?'desktop.png':'preview.png')});captured=true;}
      }
      last=state;
      if(speakers.size===5 && phrases.size===3 && adminMoving) break;
    }
    assert.deepEqual([...speakers].sort(),['Sơn','Ngân','Minh','Trí','Bách'].sort());
    assert.equal(phrases.size,3);assert.ok(adminMoving,'Ngân keeps walking while chatting');
    await page.click('[data-crew-button="0"]');
    assert.equal(await page.$eval('.twin__chatter',el=>el.hidden),true);
    await page.evaluate(()=>{window.__step();window.__step();});
    assert.ok(await page.$eval('.twin__greeting:not(.twin__chatter)',el=>!el.hidden && el.textContent.includes('Sơn')),'Click greeting has priority');
    await page.evaluate(()=>window.Router.go('gr',{instant:true}));
    for(let i=0;i<30;i++) await page.evaluate(()=>window.__step());
    assert.equal(await page.$eval('.twin__chatter',el=>el.hidden),true,'Conversations stop inside station apps');
    await page.evaluate(()=>window.Router.go('home',{instant:true}));
    await page.setViewport({width:390,height:844});
    await page.mouse.move(2,2);
    await page.evaluate(()=>{document.activeElement.blur();document.documentElement.dataset.theme='dark';});
    let phoneChat=false;
    for(let i=0;i<50;i++) {
      if((await page.evaluate(()=>window.__step())).visible) {phoneChat=true;break;}
    }
    assert.ok(phoneChat,'Random speech resumes on the phone layout');
    const box=await page.$eval('.twin__chatter',el=>el.getBoundingClientRect().toJSON());
    assert.ok(box.left>=0 && box.right<=390 && box.top>=0 && box.bottom<=844,'The bubble stays within the phone screen');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight===innerHeight && document.documentElement.scrollWidth===innerWidth));
    await page.screenshot({path:resolve(output,file==='index.html'?'phone.png':'preview-phone.png')});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await page.waitForFunction(()=>document.querySelector('#twin-stage').classList.contains('is-still'),{polling:50});
    for(let i=0;i<30;i++) await page.evaluate(()=>window.__step());
    assert.ok(await page.$eval('.twin__chatter',el=>el.hidden));
    assert.equal(await page.$$eval('.is-speaking',nodes=>nodes.length),0);
    reports.push({file,speakers:[...speakers],phrases:[...phrases],adminMoving,phoneChat});
    await page.close();
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
await writeFile(resolve(output,'report.json'),JSON.stringify({reports,errors},null,2));
console.log('Random team speech, click priority, moving anchors, app navigation, and phone layout passed.');
