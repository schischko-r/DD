import {chromium} from '/Users/roman/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {metricDomId} from '../../gravity-app/src/domain/report.js';
const b=await chromium.launch({headless:true}),p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
await p.goto('http://127.0.0.1:4178');await p.waitForSelector('.dashboard-period');await p.locator('[aria-label="Профиль команды"]').click();
const choose=async(s,n)=>{await p.locator(s).click();await p.getByRole('option',{name:n,exact:true}).click();await p.getByRole('option',{name:n,exact:true}).waitFor({state:'hidden'});};
await choose('.detail-period-filter [role="combobox"]','III кв. 2026');await choose('.detail-team-unit-filter [role="combobox"]','Data');
for(const name of ['SberID','Единый личный кабинет (ЕЛК)','Почта, Диск, Календарь']){
 await choose('.detail-team-select [role="combobox"]',name);await p.getByRole('button',{name:'Подробно',exact:true}).click();
 const row=c=>p.locator(`[id="${metricDomId(c)}"]`);
 assert.equal((await row('dannye.kontrolь_kachestva_dannyh_kkd').locator('.metric-status-label').textContent()).trim(),'50%');
 if(name==='Единый личный кабинет (ЕЛК)')assert.equal((await row('dannye.promyshlenye_dannye').locator('.metric-status-label').textContent()).trim(),'50%');
 else assert.equal((await row('dannye.promyshlenye_dannye').locator('.metric-value-label').textContent()).trim(),'—');
}
await choose('.detail-team-unit-filter [role="combobox"]','CX');await choose('.detail-team-select [role="combobox"]','Рабочий возраст');await p.getByRole('button',{name:'Подробно',exact:true}).click();assert.equal((await p.locator(`[id="${metricDomId('general.dolya_rynka_fot')}"] .metric-status-label`).textContent()).trim(),'100%');assert.deepEqual(errors,[]);console.log('PASS: four survey scores50%, two unanswered industrial blanks, Working Age FOT100%, no console errors');
}finally{await b.close();}
