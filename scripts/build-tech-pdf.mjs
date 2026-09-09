import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const root = new URL('../', import.meta.url);
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({width:1000,height:1200});
  await page.goto(new URL('docs/technical-guide.html',root).href);
  assert.equal(await page.$$eval('h2',ns=>ns.length),21);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.$$eval('td',ns=>ns.some(n=>n.scrollWidth>n.clientWidth+1)),false,'Document table text fits');
  await page.pdf({
    path: new URL('docs/SEMV-Warehouse-Technical-Guide.pdf',root).pathname.slice(1), format:'A4', printBackground:true,
    margin:{top:'17mm',right:'16mm',bottom:'20mm',left:'16mm'}, displayHeaderFooter:true,
    headerTemplate:'<span></span>',footerTemplate:'<div style="font:9px Arial;color:#62736e;width:100%;padding:0 16mm;text-align:right">SEMV Warehouse · Technical Guide &nbsp; | &nbsp; <span class="pageNumber"></span> / <span class="totalPages"></span></div>'
  });
  await mkdir(new URL('artifacts/documentation/',root),{recursive:true});
  await page.screenshot({path:new URL('artifacts/documentation/guide-preview.png',root).pathname.slice(1)});
  const pdf=await readFile(new URL('docs/SEMV-Warehouse-Technical-Guide.pdf',root));
  assert.equal(pdf.subarray(0,4).toString(),'%PDF');
  console.log(`PDF exported (${pdf.length.toLocaleString()} bytes, ${(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length} pages).`);
} finally {await browser.close();}
