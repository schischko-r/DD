import {chromium} from '/Users/roman/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {metricDomId} from '../../gravity-app/src/domain/report.js';
const b=await chromium.launch({headless:true}); const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
try {
 await p.goto('http://127.0.0.1:4178');await p.waitForSelector('.dashboard-period');await p.locator('[aria-label="Профиль команды"]').click();
 const choose=async(s,n)=>{await p.locator(s).click();await p.getByRole('option',{name:n,exact:true}).click();await p.getByRole('option',{name:n,exact:true}).waitFor({state:'hidden'});};
 await choose('.detail-period-filter [role="combobox"]','III кв. 2026');
 const check=async(code,v)=>{const row=p.locator(`[id="${metricDomId(code)}"]`);if(v===null)assert.equal(await row.count(),0,code);else assert.equal((await row.locator('.metric-status-label').textContent()).trim(),`${v*100}%`,code);};
 for(const [u,n,values] of [['CBP','Автокредит',[.5,0,0]],['CBP','Вклады+НС',[.5,0,0]],['DB','Дебетовая карта',[.5,.5,.5]],['CX','СберПрайм',[.5,.5,.5]],['DB','Кредитная карта',[0,null,0]],['DP','Уведомления',[.5,null,.5]]]){
 await choose('.detail-team-unit-filter [role="combobox"]',u);await choose('.detail-team-select [role="combobox"]',n);await p.getByRole('button',{name:'Подробно',exact:true}).click();
 for(const [i,c]of ['goals.po_monitoring','goals.po_forecast','goals.po_factor_analysis'].entries())await check(c,values[i]);
 if(n==='Вклады+НС')await check('attract.chernoviki_v_sbol_70',0);
 }
 assert.deepEqual(errors,[]);console.log('PASS: six Excel teams and deposits drafts render expected grades; no console errors');
} finally {await b.close();}
