import {chromium} from '/Users/roman/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {metricDomId} from '../../gravity-app/src/domain/report.js';
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4178');await p.waitForSelector('.dashboard-period');await p.locator('[aria-label="Профиль команды"]').click();
const choose=async(s,n)=>{await p.locator(s).click();await p.getByRole('option',{name:n,exact:true}).click();await p.getByRole('option',{name:n,exact:true}).waitFor({state:'hidden'});};
await choose('.detail-period-filter [role="combobox"]','III кв. 2026');await choose('.detail-team-unit-filter [role="combobox"]','DB');await choose('.detail-team-select [role="combobox"]','Переводы по РФ');await p.getByRole('button',{name:'Подробно',exact:true}).click();
const card=p.locator('.metric-block').filter({has:p.getByRole('heading',{name:'Цели',exact:true})});
const pairs=[['goals.monitored','goals.po_monitoring'],['goals.factor_analysis_l1_l2','goals.po_factor_analysis'],['goals.forecast','goals.po_forecast']];
const row=code=>card.locator(`[id="${metricDomId(code)}"]`);
const copy=async code=>({name:(await row(code).locator('.metric-name-line b').textContent()).trim(),footer:(await row(code).locator('.metric-copy > div > span').textContent()).trim()});
for(const [lt,po]of pairs){assert.deepEqual(await copy(po),await copy(lt));const style=async c=>row(c).locator('.metric-name-line b').evaluate(el=>({font:getComputedStyle(el).font,lineHeight:getComputedStyle(el).lineHeight}));assert.deepEqual(await style(po),await style(lt));}
assert.deepEqual(await card.locator('.metric-row').evaluateAll(rows=>rows.map(row=>row.id)),pairs.map(pair=>metricDomId(pair[0])).concat(pairs.map(pair=>metricDomId(pair[1]))));
await card.screenshot({path:'outputs/po-goals-visual-2026-10-30/desktop.png'});await p.setViewportSize({width:390,height:844});await card.screenshot({path:'outputs/po-goals-visual-2026-10-30/mobile.png'});const box=await card.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);for(const [lt,po]of pairs)assert.deepEqual(await copy(po),await copy(lt));
assert.deepEqual(errors,[]);await b.close();console.log('PASS: PO and LT names/footers/fonts/order identical; desktop/mobile fit, console clean');
