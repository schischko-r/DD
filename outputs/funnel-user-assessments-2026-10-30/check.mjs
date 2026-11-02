import {chromium} from '/Users/roman/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {metricDomId} from '../../gravity-app/src/domain/report.js';
import {buildTeamProfileProducts} from '../../gravity-app/src/domain/teamProfileSelection.js';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const source=read('../../gravity-app/public/report-data.json').products;
const app=readFileSync(new URL('../../gravity-app/src/app/App.jsx',import.meta.url),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read(`../../gravity-app/src/data/${imports.get(k.trim())}`));
const before=buildTeamProfileProducts(source,'III кв. 2026',overlays.filter(o=>o.scope!=='funnel-user-assessment'));
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4178/');await page.waitForSelector('.dashboard-period');
await page.locator('[aria-label="Профиль команды"]').click();await page.waitForSelector('.detail-header h1');
await page.getByRole('button',{name:'Подробно',exact:true}).click();
const choose=async(s,n)=>{await page.locator(s).click();await page.getByRole('option',{name:n,exact:true}).click();};
const row=c=>page.locator(`[id="${metricDomId(c)}"]`);
const value=async(c,v)=>assert.equal((await row(c).locator(v==='—'?'.metric-value-label':'.metric-status-label').textContent()).trim(),v);
const select=async(u,n)=>{await choose('.detail-team-unit-filter [role="combobox"]',u);await choose('.detail-team-select [role="combobox"]',n);await page.getByRole('button',{name:'Подробно',exact:true}).click();};
await select('CBP','Автокредит');
for(const[c,v]of [['churn.funnel_analysis','50%'],['churn.nastroena_otchetnostь','0%'],['churn.report_completeness','0%'],['attract.funnel_analysis','50%'],['attract.nastroena_otchetnostь','100%'],['attract.report_completeness','50%']])await value(c,v);
await row('churn.funnel_analysis').screenshot({path:new URL('./auto-churn.png',import.meta.url).pathname});
await select('Data','Персональная рекомендация');await value('analiz_effektivnostь.nastroena_otchetnostь','50%');await value('analiz_effektivnostь.provedenie_kompleksnogo_analiza_po_metrikam','50%');
await select('DP','СберИнвестор');await value('voronka_onbordinga.nastroena_otchetnostь','100%');await value('attract.nastroena_otchetnostь','50%');
await select('PC','Колл-центр');await value('voronka_vhoda_v_kanal.polnota_otcheta','100%');
await select('DB','Трансграничные переводы');await value('attract.report_completeness','50%');
await select('DB','Трансграничный эквайринг');await value('churn.nastroena_otchetnostь','0%');
for(const[u,name]of [['DB','Зарплатный продукт'],['CBP','ОМС'],['CBP','Слитки']]){
 await select(u,name);
 const prior=before.find(p=>p.name===name).metrics.flatMap(b=>b.metrics);
 for(const code of ['churn.funnel_analysis','churn.nastroena_otchetnostь','attract.funnel_analysis']){
  const m=prior.find(m=>m.code===code);
  const expected=m.value===null?'—':`${Math.round(m.value/m.max_value*100)}%`;
  await value(code,expected);
 }
}
await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
await select('CBP','Автокредит');await choose('.detail-period-filter [role="combobox"]','II кв. 2026');
for(const c of ['churn.funnel_analysis','churn.nastroena_otchetnostь','attract.funnel_analysis']){
 const m=source.find(p=>p.name==='Автокредит').metrics.flatMap(b=>b.metrics).find(m=>m.code===c);
 await value(c,`${Math.round(m.value/m.max_value*100)}%`);
}
assert.deepEqual(errors,[]);await browser.close();
console.log('PASS: Q3 funnel values and aliases; channel directions; weight4; 2newapplicablemetrics; 3excludedteamsunchanged; Q2andmobile.');
