import {chromium} from '/Users/roman/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {metricDomId} from '../../gravity-app/src/domain/report.js';
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4178');await p.waitForSelector('.dashboard-period');await p.locator('[aria-label="Профиль команды"]').click();
const choose=async(s,n)=>{await p.locator(s).click();await p.getByRole('option',{name:n,exact:true}).click();await p.getByRole('option',{name:n,exact:true}).waitFor({state:'hidden'});};
const select=async(u,n)=>{await choose('.detail-team-unit-filter [role="combobox"]',u);await choose('.detail-team-select [role="combobox"]',n);await p.getByRole('button',{name:'Подробно',exact:true}).click();};
await choose('.detail-period-filter [role="combobox"]','III кв. 2026');
const card=()=>p.locator('.metric-block').filter({has:p.getByRole('heading',{name:'Цели',exact:true})});
const note='Информационные метрики — не входят в индекс';
await select('УБ','БПИФ');assert.equal(await card().getByText(note,{exact:true}).count(),1);
for(const c of ['goals.monitored','goals.forecast','goals.factor_analysis_l1_l2']){const r=card().locator(`[id="${metricDomId(c)}"]`);assert.equal((await r.locator('.metric-status-label').textContent()).trim(),'100%');assert.equal(await r.locator('.metric-info-icon').count(),1);}
for(const c of ['goals.po_monitoring','goals.po_forecast','goals.po_factor_analysis'])assert.equal((await card().locator(`[id="${metricDomId(c)}"] .metric-value-label`).textContent()).trim(),'—');
await card().screenshot({path:'outputs/goals-informational-2026-10-30/desktop.png'});
await p.setViewportSize({width:390,height:844});await card().screenshot({path:'outputs/goals-informational-2026-10-30/mobile.png'});const n=await card().getByText(note,{exact:true}).boundingBox();assert.ok(n.x>=0&&n.x+n.width<=390);
await select('CBP','Конверсия');assert.equal(await card().getByText(note,{exact:true}).count(),1);
await select('CBP','Автокредит');assert.equal(await card().getByText(note,{exact:true}).count(),0);
await select('УБ','БПИФ');await choose('.detail-period-filter [role="combobox"]','II кв. 2026');await p.getByRole('button',{name:'Подробно',exact:true}).click();assert.equal(await p.getByText(note,{exact:true}).count(),0);assert.deepEqual(errors,[]);await b.close();console.log('PASS: UB and CBP Commission info note visible, original scores intact, PO empty, other CBP and Q2 untouched, mobile fits, console clean');
