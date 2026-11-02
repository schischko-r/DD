import {chromium} from '/Users/roman/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4178/');
await page.waitForSelector('.dashboard-period');
await page.locator('[aria-label="Профиль команды"]').click();
await page.waitForSelector('.detail-header h1');
await page.getByRole('button',{name:'Подробно',exact:true}).click();
console.log('draft rows',await page.locator('.metric-row').filter({hasText:'Черновики в СБОЛ'}).first().textContent());
const draftRow=page.locator('.metric-row').filter({hasText:'Черновики в СБОЛ'}).first();
await draftRow.waitFor();
assert.equal(await page.locator('.metric-index-uplift:not(.metric-actual-growth)').count(),0);
assert.equal(await page.locator('.metric-name-recommendation-trigger').count(),0);
assert.equal(await draftRow.locator('.metric-status-label').textContent(),'50%');
assert.equal(await draftRow.locator('.metric-actual-growth').count(),1);
assert.equal(await draftRow.locator('.metric-actual-growth-sparkles').count(),1);
await draftRow.locator('.metric-name-line b').hover();
assert.equal(await page.locator('.metric-index-uplift-popup').count(),0);
const measure=async()=>page.locator('.metric-row-status .metric-value-group').evaluateAll(ns=>ns.map(n=>{
 const rect=sel=>{const e=n.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};};
 return {block:n.closest('.metric-block')?.querySelector('h3')?.textContent,value:rect('.metric-status-label'),check:rect('.metric-digital-trace-confirmation'),growth:rect('.metric-actual-growth-wrap')};
}));
for(const width of [1440,390]){
 await page.setViewportSize({width,height:1000});
 assert.ok(await page.locator('.metric-status-label:not(.metric-status-label-text)').count()>0);
 const clipping=await page.locator('.metric-status-label:not(.metric-status-label-text) :is(.g-label__text, .g-label__content)').evaluateAll(ns=>ns.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>({text:n.textContent,client:n.clientWidth,scroll:n.scrollWidth})));
 assert.deepEqual(clipping,[],`${width}: numeric labels must not be ellipsized`);
 const rows=await measure();
 for(const r of rows){
  if(r.check&&r.value){assert.ok(r.check.right<r.value.left);assert.ok(r.value.width>=63);}
  if(r.growth&&r.check)assert.ok(r.growth.right<r.check.left);
 }
 const checked=rows.filter(r=>r.check&&r.value);
 assert.ok(checked.length>1);
 for(const block of new Set(checked.map(r=>r.block))){
  const group=checked.filter(r=>r.block===block);
  assert.ok(Math.max(...group.map(r=>r.value.right))-Math.min(...group.map(r=>r.value.right))<1,`${width}: values align in ${block}`);
  assert.ok(Math.max(...group.map(r=>r.check.left))-Math.min(...group.map(r=>r.check.left))<1,`${width}: checks align in ${block}`);
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await draftRow.screenshot({path:new URL(`./draft-${width}.png`,import.meta.url).pathname});
 await page.locator('.metric-row-status').filter({hasText:'100%'}).first().screenshot({path:new URL(`./full-${width}.png`,import.meta.url).pathname});
}
await page.setViewportSize({width:1440,height:1000});
await page.getByRole('button',{name:'Подробно',exact:true}).click();
assert.equal(await page.locator('.metric-index-uplift:not(.metric-actual-growth)').count(),0);
assert.equal(await page.locator('.metric-name-recommendation-trigger').count(),0);
await page.locator('.detail-period-filter [role="combobox"]').click();
await page.getByRole('option',{name:'II кв. 2026',exact:true}).click();
await page.getByRole('button',{name:'Подробно',exact:true}).click();
await page.locator('.detail-team-unit-filter [role="combobox"]').click();
await page.getByRole('option',{name:'CBP',exact:true}).click();
await page.locator('.detail-team-select [role="combobox"]').click();
await page.getByRole('option',{name:'Автокредит',exact:true}).click();
const ab=page.locator('.metric-row').filter({hasText:'A/B-тесты'}).first();
assert.equal((await ab.locator('.metric-status-label').textContent()).trim(),'Нет плана по A/B');
for(const width of [1440,390]){
 await page.setViewportSize({width,height:1000});
 assert.ok(await page.locator('.metric-status-label-text').count()>0);
 const clipping=await page.locator('.metric-status-label-text :is(.g-label__text, .g-label__content)').evaluateAll(ns=>ns.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>({text:n.textContent,client:n.clientWidth,scroll:n.scrollWidth})));
 assert.deepEqual(clipping,[],`${width}: complete text statuses must not be ellipsized`);
 await ab.screenshot({path:new URL(`./not-applicable-${width}.png`,import.meta.url).pathname});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}
assert.deepEqual(errors,[]);
console.log('PASS actual uplift/check/value order, 50% visible, fixed alignment at desktop/mobile, no metric recommendation popup.');
await browser.close();
