import {chromium} from '/Users/roman/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {metricDomId} from '../../gravity-app/src/domain/report.js';
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:1440,height:1100}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4178');await p.waitForSelector('.dashboard-period');
const choose=async(selector,name)=>{await p.locator(selector).click();await p.getByRole('option',{name,exact:true}).click();await p.getByRole('option',{name,exact:true}).waitFor({state:'hidden'});};
await choose('.dashboard-period [role="combobox"]','III кв. 2026');
const radar=p.locator('.dashboard-radar-card');
await p.locator('.recharts-legend-item-text').filter({hasText:'B2C · II кв. 2026'}).waitFor();
assert.deepEqual((await radar.locator('.recharts-legend-item-text').allTextContents()).sort(),['B2C · III кв. 2026','B2C · II кв. 2026'].sort());
assert.equal(await radar.locator('.recharts-radar').count(),2);
await p.mouse.move(0,0);await p.waitForTimeout(1700);await radar.screenshot({path:'outputs/summary-quarter-2026-10-30/desktop.png'});
const anti=p.locator('.dashboard-antitop-card');assert.ok(!(await anti.textContent()).includes('Гибкое изменение условий продукта'));
if(await anti.getByRole('button',{name:'Показать ещё',exact:false}).count()){
 await anti.getByRole('button',{name:'Показать ещё',exact:false}).click();const list=p.locator('.dashboard-antitop-list-full');await list.waitFor();assert.ok(!(await list.textContent()).includes('Гибкое изменение условий продукта'));await p.keyboard.press('Escape');await list.waitFor({state:'hidden'});
}
await choose('.dashboard-unit-filter [role="combobox"]','УБ');await p.locator('.recharts-legend-item-text').filter({hasText:'УБ · II кв. 2026'}).waitFor();assert.equal(await radar.locator('.recharts-legend-item-text').count(),3);
await choose('.dashboard-unit-filter [role="combobox"]','Все юниты');
await p.setViewportSize({width:390,height:844});await p.waitForTimeout(1700);await radar.screenshot({path:'outputs/summary-quarter-2026-10-30/mobile.png'});const bounds=await radar.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
await choose('.dashboard-period [role="combobox"]','II кв. 2026');assert.deepEqual(await radar.locator('.recharts-legend-item-text').allTextContents(),['B2C · II кв. 2026']);
await p.setViewportSize({width:1440,height:1100});await p.locator('[aria-label="Профиль команды"]').click();await choose('.detail-period-filter [role="combobox"]','III кв. 2026');await choose('.detail-team-unit-filter [role="combobox"]','УБ');await choose('.detail-team-select [role="combobox"]','Залоговое страхование (корпоративное страхование)');await p.getByRole('button',{name:'Подробно',exact:true}).click();const row=p.locator(`[id="${metricDomId('churn.report_completeness')}"]`);assert.equal((await row.locator('.metric-status-label').textContent()).trim(),'100%');await choose('.detail-period-filter [role="combobox"]','II кв. 2026');await p.getByRole('button',{name:'Подробно',exact:true}).click();assert.equal((await row.locator('.metric-status-label').textContent()).trim(),'0%');assert.deepEqual(errors,[]);await b.close();console.log('PASS: real current/past B2C and unit radar series, no invented I-quarter, mobile fit; Q3 flexible row absent in both Summary lists; corporate churn100/Q2old0; console clean');
