import {chromium} from '/Users/roman/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {metricDomId} from '../../gravity-app/src/domain/report.js';
const priorProducts=JSON.parse(readFileSync(new URL('../../gravity-app/public/report-data.json',import.meta.url))).products;
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
// Exercise initial render before the independently loaded CJXplorer card arrives.
await page.route('**/cjxplorer-credit-card.json',async route=>{await new Promise(resolve=>setTimeout(resolve,200));await route.continue();});
await page.goto('http://127.0.0.1:4178/');
await page.waitForSelector('.dashboard-period');
await page.locator('[aria-label="Профиль команды"]').click();
await page.waitForSelector('.detail-header h1');
await page.getByRole('button',{name:'Подробно',exact:true}).click();
const disclosure=page.locator('.cross-sell-decomposition');
await disclosure.waitFor();
assert.equal(await disclosure.evaluate(n=>n.open),false);
await disclosure.locator('summary').focus();
await page.keyboard.press('Enter');
assert.equal(await disclosure.evaluate(n=>n.open),true);
assert.equal(await disclosure.locator('.metric-row').count(),2);
await disclosure.getByText('Cross-sell во время оформления',{exact:true}).waitFor({state:'visible'});
await disclosure.getByText('Cross-sell после оформления',{exact:true}).waitFor({state:'visible'});
await disclosure.getByText('Предложение другого продукта банка в процессе оформления вашего продукта.',{exact:true}).waitFor({state:'visible'});
await disclosure.getByText('Предложение другого продукта банка как дополнения к уже оформленному продукту.',{exact:true}).waitFor({state:'visible'});
assert.ok(!(await disclosure.textContent()).includes('По ответам команды в опросе'));
assert.ok(!(await disclosure.textContent()).includes('Тырсина Ю.И.'));
for(const [name,explanation,source] of [
  ['во время оформления','В процессе оформления вашего продукта клиент может приобрести другой продукт банка.','Данные собираются по цифровым следам LossHunter.'],
  ['после оформления','Клиенту, уже оформившему ваш продукт, предлагается другой продукт банка как дополнение к нему в рамках настроенной механики кросс-продаж.','Данные собираются из опроса команды.']
]){
  await disclosure.getByLabel(`Критерии оценки: Cross-sell ${name}`,{exact:true}).click();
  await page.getByText(explanation,{exact:true}).waitFor({state:'visible'});
  await page.getByText(source,{exact:true}).waitFor({state:'visible'});
  await page.locator('.mechanics-metric-help-content:visible').screenshot({path:new URL(`./help-${name.startsWith('во')?'during':'after'}.png`,import.meta.url).pathname});
  await page.locator('.detail-header h1').click();
  await page.locator('.mechanics-metric-help-content:visible').waitFor({state:'hidden'});
}
console.log('Q3 renders two Cross-sell components.');
assert.equal(await disclosure.locator('.metric-ai-actions').count(),1);
assert.equal(await disclosure.locator('.metric-row .metric-ai-actions').count(),0);
assert.equal(await disclosure.locator('.cross-sell-after-purchase-responses').count(),0);
assert.equal(await disclosure.getByRole('link',{name:'С кем коллабиться?'}).count(),1);
assert.match(await disclosure.getByRole('link',{name:'С кем коллабиться?'}).getAttribute('href'),/tpl-4836dfe789b8471c/);
assert.ok(await disclosure.evaluate(n=>n.querySelector('.cross-sell-after-purchase').compareDocumentPosition(n.querySelector('.metric-ai-actions')) & Node.DOCUMENT_POSITION_FOLLOWING));
await disclosure.screenshot({path:new URL('./expanded.png',import.meta.url).pathname});
await disclosure.getByRole('button',{name:/Доступные связки/}).click();
await page.getByRole('dialog').waitFor();
assert.ok(await page.getByRole('dialog').getByText('Cross-sell: покрытие и рекомендованные действия').count());
await page.keyboard.press('Escape');
await disclosure.locator('summary').focus();await page.keyboard.press('Space');
assert.equal(await disclosure.evaluate(n=>n.open),false);
await disclosure.screenshot({path:new URL('./collapsed.png',import.meta.url).pathname});
await disclosure.locator('summary').click();
await page.setViewportSize({width:390,height:844});
await disclosure.screenshot({path:new URL('./mobile.png',import.meta.url).pathname});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
await page.setViewportSize({width:1440,height:1000});
const choose=async(selector,name)=>{await page.locator(selector).click();await page.getByRole('option',{name,exact:true}).click();};
for(const [unit,name,total,during,afterLabel] of [['CBP','Монеты','50%','0%','100%'],['УБ','ПДС','50%','0%','100%'],['DB','Дебетовая карта','100%','100%','100%'],['DB','Сценарии оплаты','50%','0%','100%'],['УБ','Страхование залога','75%','100%','50%'],['CBP','Слитки','25%','0%','50%'],['УБ','Страхование путешественников','75%','100%','50%'],['PC','Выписки, справки','0%','0%','Не применимо'],['Data','Почта, Диск, Календарь','0%','0%','0%'],['CBP','Вклады+НС','100%','100%','100%'],['CBP','ОМС','0%','0%','0%'],['DB','Трансграничные переводы','0%','0%','0%']]){
  await choose('.detail-team-unit-filter [role="combobox"]',unit);
  await choose('.detail-team-select [role="combobox"]',name);
  await page.getByRole('heading',{name,exact:true}).waitFor();
  await page.locator('.detail-team-select [role="combobox"]').click();
  assert.equal(await page.getByRole('option',{name:'ДУ',exact:true}).count(),0);
  await page.keyboard.press('Escape');
  await disclosure.waitFor();
  if(!await disclosure.evaluate(n=>n.open))await disclosure.locator('summary').click();
  assert.equal((await disclosure.locator('summary .g-label').textContent()).trim(),total);
  assert.match(await disclosure.locator('summary .g-label').getAttribute('class'),new RegExp(total==='100%'?'success':total==='0%'?'danger':'warning'));
  assert.match(await disclosure.locator('summary .metric-light').getAttribute('class'),new RegExp(total==='100%'?'success':total==='0%'?'danger':'warning'));
  assert.equal((await disclosure.locator('.metric-row:not(.cross-sell-after-purchase) .metric-status-label').textContent()).trim(),during);
  assert.equal((await disclosure.locator('.cross-sell-after-purchase .g-label').textContent()).trim(),afterLabel);
  assert.equal(await disclosure.locator('.metric-index-uplift').count(),0,'Components do not claim an extra independent DDI uplift');
  assert.equal(await disclosure.locator('.metric-row').count(),2);
  const prior=priorProducts.find(p=>p.name===(name==='Страхование путешественников'?'ВЗР':name));
  for(const code of ['mehaniki.gibkoe_izmenenie_usloviy_produkta','hyp.extra_initiatives']){
    const metric=prior.metrics.flatMap(b=>b.metrics).find(m=>m.code===code);
    if(!metric)continue;
    const expected=metric.is_applicabble_flg===false||metric.max_value<=0?'Не применимо':`${Math.round(metric.value/metric.max_value*100)}%`;
    assert.equal((await page.locator(`[id="${metricDomId(code)}"] .metric-status-label`).textContent()).trim(),expected,'Selected Q3 metric must show exactly the Q2 assessment');
  }
  await disclosure.screenshot({path:new URL(`./sum-${name==='Слитки'?'50':name==='Страхование залога'?'100':'travel'}.png`,import.meta.url).pathname});
}
await page.locator('.detail-period-filter [role="combobox"]').click();
await page.getByRole('option',{name:'II кв. 2026',exact:true}).click();
await page.waitForFunction(()=>!document.querySelector('.cross-sell-decomposition'));
assert.equal(await page.locator('.cross-sell-decomposition').count(),0);
assert.ok(await page.getByText('Cross-sell',{exact:true}).count());
await page.locator('.detail-team-select [role="combobox"]').click();
assert.equal(await page.getByRole('option',{name:'ДУ',exact:true}).count(),0);
await page.keyboard.press('Escape');
assert.deepEqual(errors,[]);
console.log('PASS: delayed CJXplorer load, Q3 two children, keyboard expand/collapse, LossHunter preview, mobile width, Q2 unchanged.');
await browser.close();
