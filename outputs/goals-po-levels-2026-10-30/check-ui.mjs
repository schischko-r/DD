import {chromium} from '/Users/roman/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {metricDomId} from '../../gravity-app/src/domain/report.js';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4178');await page.waitForSelector('.dashboard-period');await page.locator('[aria-label="Профиль команды"]').click();
const choose=async(selector,name)=>{await page.locator(selector).click();await page.getByRole('option',{name,exact:true}).click();await page.getByRole('option',{name,exact:true}).waitFor({state:'hidden'});};
await choose('.detail-period-filter [role="combobox"]','III кв. 2026');await choose('.detail-team-unit-filter [role="combobox"]','DB');await choose('.detail-team-select [role="combobox"]','Зарплатный продукт');await page.getByRole('button',{name:'Подробно',exact:true}).click();
const card=page.locator('.metric-block').filter({has:page.getByRole('heading',{name:'Цели',exact:true})});
assert.equal(await card.count(),1);assert.deepEqual(await card.locator('.metric-group-title span').allTextContents(),['Уровня ЛЮ/ЛТ','Уровня PO']);
assert.equal((await card.locator('.dd-metric-block-percent').count()),0);
for(const code of ['goals.po_monitoring','goals.po_forecast','goals.po_factor_analysis']){const row=card.locator(`[id="${metricDomId(code)}"]`);assert.equal((await row.locator('.metric-value-label').textContent()).trim(),'—');assert.equal(await row.locator('.metric-digital-trace-confirmation').count(),0);}
const campaign=page.locator('.metric-group-title').filter({hasText:'Кампейнинг'}).first();
const colors=async locator=>locator.evaluate(el=>{const s=getComputedStyle(el);return {color:s.color,background:s.backgroundColor};});
assert.deepEqual(await colors(card.locator('.metric-group-title').first()),await colors(campaign));
await card.screenshot({path:'outputs/goals-po-levels-2026-10-30/desktop.png'});
await page.setViewportSize({width:390,height:844});await card.screenshot({path:'outputs/goals-po-levels-2026-10-30/mobile.png'});const box=await card.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
await choose('.detail-period-filter [role="combobox"]','II кв. 2026');await page.getByRole('button',{name:'Подробно',exact:true}).click();assert.equal(await page.getByRole('heading',{name:'Цели уровня ЛЮ/ЛТ',exact:true}).count(),1);assert.equal(await page.locator(`[id="${metricDomId('goals.po_monitoring')}"]`).count(),0);assert.deepEqual(errors,[]);await browser.close();console.log('PASS: Q3 title/two blue levels/three blank PO, Campaigning colors match, mobile390 fits, Q2 unchanged, console clean');
