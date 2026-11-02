import {chromium} from '/Users/roman/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {metricDomId} from '../../gravity-app/src/domain/report.js';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4178/');await page.waitForSelector('.dashboard-period');
await page.locator('[aria-label="Профиль команды"]').click();
await page.waitForSelector('.detail-header h1');
await page.getByRole('button',{name:'Подробно',exact:true}).click();
const choose=async(selector,name)=>{await page.locator(selector).click();await page.getByRole('option',{name,exact:true}).click();};
const row=code=>page.locator(`[id="${metricDomId(code)}"]`);
await choose('.detail-team-unit-filter [role="combobox"]','DB');
await choose('.detail-team-select [role="combobox"]','SberPay NFC');
for(const code of ['attract.campaign_launches','attract.chernoviki_v_sbol_70','attract.nalichie_self_service','attract.nalichie_uspeshnyh_biznes_zapuskov'])assert.equal(await row(code).count(),0);
await choose('.detail-team-unit-filter [role="combobox"]','УБ');
await choose('.detail-team-select [role="combobox"]','ИСЖ');
assert.equal(await row('attract.campaign_launches').count(),1);
assert.equal((await row('attract.campaign_launches').locator('.metric-status-label').textContent()).trim(),'0%');
assert.equal(await row('attract.campaign_launches').locator('.metric-digital-trace-confirmation').count(),0,'A manual zero is not digitally verified');
for(const name of ['ОСАГО','БПИФ']){
 await choose('.detail-team-select [role="combobox"]',name);
 const successful=row('attract.nalichie_uspeshnyh_biznes_zapuskov');
 assert.equal((await successful.locator('.metric-status-label').textContent()).trim(),'100%');
 assert.equal(await successful.locator('.metric-digital-trace-confirmation').count(),0,'Manual successful-launch assessment is not digitally verified');
}
for(const [name,values] of [['ОПИФ',[0,0,0]],['ДСЖ КК',[0,0,100]]]){
 await choose('.detail-team-select [role="combobox"]',name);
 for(const [i,code] of ['attract.campaign_launches','attract.nalichie_self_service','attract.nalichie_uspeshnyh_biznes_zapuskov'].entries()){
  assert.equal((await row(code).locator('.metric-status-label').textContent()).trim(),`${values[i]}%`);
  assert.equal(await row(code).locator('.metric-digital-trace-confirmation').count(),0);
 }
}
await choose('.detail-team-unit-filter [role="combobox"]','CBP');
await choose('.detail-team-select [role="combobox"]','Монеты');
assert.equal(await row('attract.chernoviki_v_sbol_70').count(),0);
assert.equal((await row('attract.campaign_launches').locator('.metric-status-label').textContent()).trim(),'0%');
await choose('.detail-period-filter [role="combobox"]','II кв. 2026');
assert.equal(await row('attract.chernoviki_v_sbol_70').count(),1);
assert.deepEqual(errors,[]);
console.log('PASS: Q3 NA hidden; previous blanks and existing zeros visible as 0%; Q2 NA draft unchanged.');
await browser.close();
