import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts,metricActualGrowth} from './teamProfileSelection.js';
const actual=JSON.parse(readFileSync(new URL('../../public/report-data.json',import.meta.url),'utf8')).products;
const drafts=JSON.parse(readFileSync(new URL('../data/draft-metrics-q3-2026.json',import.meta.url),'utf8'));
const campaign=JSON.parse(readFileSync(new URL('../data/campaign-metrics-q3-2026.json',import.meta.url),'utf8'));
const code='attract.chernoviki_v_sbol_70';
const metrics=p=>p.metrics.flatMap(b=>b.metrics);
// Independent openpyxl extraction: Книга4(1).xlsx / Лист1 A2:B44.
const source={"2": ["Автокредит", 0], "3": ["Автоплатеж", 0], "4": ["БПИФ", 0], "5": ["Брокерский счет", 1], "6": ["ВЗР", 1], "7": ["Вклады, руб.", 0], "8": ["Вклады, юани", 1], "9": ["Дебетовые карты", 0], "10": ["Детская карта", 0], "11": ["Зарплатные проекты", 0], "12": ["ЗЛС", 0], "13": ["ЗПИФ", 0], "14": ["ИИС к БО", 0], "15": ["ИИС УК", 0], "16": ["ИнвестКопилка", 0], "17": ["Как зарплатный", 0], "18": ["КАСКО", 0], "19": ["Кредитные карты", 0], "20": ["Мониторинг кредитной истории", 0], "21": ["Накопительные счета", 0], "22": ["Образовательный кредит", 0], "23": ["ОМС", 0], "24": ["ОПИФ", 1], "25": ["ОСАГО", 1], "26": ["Отчет по кредитной истории ОКБ", 0], "27": ["Пакет СБ1", 0], "28": ["Пакет СБП", 0], "29": ["ПДС", 0], "30": ["Пенсия (назначение)", 0], "31": ["Пенсия (перевод)", 0], "32": ["Потребительское кредитование", 0], "33": ["Прайм", 0], "34": ["Пульс рынка, Первый долевой, Гарант Капитал (ИСЖ)", 0], "35": ["ПУ Страховка с выгодой (до 01.04 -ДСЖ КК)", 0], "36": ["Рефинансирование", 0], "37": ["СберЗдоровье", 0], "38": ["СберМобайл", 0], "39": ["Спортивная защита", 0], "40": ["Страхование жизни при ИК", 0], "41": ["Страхование залога при ИК", 0], "42": ["Трансграничные переводы", 0], "43": ["Увеличение лимита по КК", 0], "44": ["Формула жизни (НСЖ)", 0]};

test('draft source preserves all 43 workbook rows and the user-confirmed deposits override separately',()=>{
  assert.equal(drafts.products.length,30);assert.equal(drafts.unmapped.length,10);
  const cells=drafts.products.flatMap(p=>p.metrics[code].source.cells);
  assert.equal(cells.length,33);const all=[...cells,...drafts.unmapped];assert.equal(all.length,43);assert.equal(new Set(all.map(c=>c.cell)).size,43);
  for(const c of all){const row=Number(c.cell.slice(1));assert.deepEqual([c.sourceName,c.rawValue],source[row]);assert.equal(c.file,'Книга4(1).xlsx');assert.equal(c.sheet,'Лист1');assert.equal(c.nameCell,`A${row}`);assert.equal(c.columnLabel,'max_coverage_q3');}
  const deposits=drafts.products.find(p=>p.name==='Вклады+НС').metrics[code];
  assert.equal(deposits.rawValue,0);assert.deepEqual(deposits.source.cells.map(c=>[c.cell,c.rawValue]),[['B7',0],['B8',1],['B21',0]]);
  assert.equal(deposits.source.overrideHistory[0].rawValue,0);assert.equal(deposits.source.valueOrigin,'userConfirmedPoints');
  assert.equal(deposits.source.override.confirmedBy,'user');assert.equal(deposits.source.override.points,0);assert.ok(deposits.source.override.reason.length>10);
});

test('combined draft and campaign overlays preserve Q2, authorized Q3 draft maxima and all 129 campaign source facts',()=>{
  const old=JSON.stringify(actual),oldDraft=JSON.stringify(drafts),oldCampaign=JSON.stringify(campaign);
  const combined=buildTeamProfileProducts(actual,drafts.period,[campaign,drafts]);const campaignOnly=buildTeamProfileProducts(actual,campaign.period,campaign);
  let count=0,positive=0;
  for(const p of actual){
    const q3=combined.find(x=>x.name===p.name&&x.unit===p.unit&&x.type===p.type),prior=campaignOnly.find(x=>x.name===p.name&&x.unit===p.unit&&x.type===p.type);
    const oldDraft=metrics(p).find(m=>m.code===code);const delta=p.type==='Продукт'&&oldDraft?.is_applicabble_flg!==false&&oldDraft?.max_value>0?1-oldDraft.max_value:0;assert.equal(q3.indexMaxPoints,prior.indexMaxPoints+delta);
    const fact=drafts.products.find(x=>x.id===p.id);const current=metrics(q3).find(m=>m.code===code),previous=metrics(p).find(m=>m.code===code);
    if(fact){assert.equal(p.type,'Продукт');assert.ok(previous.max_value>0&&previous.is_applicabble_flg!==false);assert.equal(current.max_value,1);assert.equal(current.value,fact.metrics[code].rawValue);assert.deepEqual(current.source,{...fact.metrics[code].source,rawValue:fact.metrics[code].rawValue});count++;if(current.value>0)positive++;}
    else if(current){assert.equal(current.value,null);assert.equal(current.source,undefined);}
    for(const metric of metrics(q3)){
      const original=metrics(p).find(m=>m.code===metric.code);assert.equal(metric.max_value,metric.code===code&&p.type==='Продукт'&&original.is_applicabble_flg!==false&&original.max_value>0?1:original.max_value);
      if(metric.code!==code)assert.deepEqual(metric,metrics(prior).find(m=>m.code===metric.code),'Draft overlay cannot replace any campaign metric');
    }
  }
  assert.equal(count,30);assert.equal(positive,13);
  const deposits=combined.find(p=>p.name==='Вклады+НС');assert.equal(metrics(deposits).find(m=>m.code===code).value,0);
  const growth=metrics(deposits).filter(m=>metricActualGrowth(m,deposits.indexMaxPoints,deposits.period));assert.deepEqual(growth.map(m=>m.code),['attract.nalichie_uspeshnyh_biznes_zapuskov']);
  assert.equal(buildTeamProfileProducts(actual,'II кв. 2026',[campaign,drafts]).length,83);
  assert.equal(JSON.stringify(actual),old);assert.equal(JSON.stringify(drafts),oldDraft);assert.equal(JSON.stringify(campaign),oldCampaign);
});

test('Q3 draft max is one for applicable products including unknown facts; Q2 and NA retain their rubric',()=>{
  const make=(id,type,app)=>({id,name:id,type,unit:'DB',period:'II кв. 2026',metrics:[{code:'attract',name:'Воронка',metrics:[{code,name:'Черновики',value:0,max_value:.5,is_applicabble_flg:app,dd_calculation_flg:1}]}]});
  const inputs=[make('fraction','Продукт',true),make('NA','Продукт',false),make('channel','Канал',true),make('segment','Сегмент',true)];
  const overlay={period:'III кв. 2026',metricMaxOverrides:{[code]:1},products:inputs.map(p=>({id:p.id,name:p.name,type:p.type,unit:p.unit,metrics:{[code]:{rawValue:1,source:{file:'fixture'}}}}))};
  const result=buildTeamProfileProducts(inputs,overlay.period,[campaign,overlay]);
  for(const p of result){const metric=metrics(p)[0];assert.equal(metric.max_value,p.name==='fraction'?1:.5);assert.equal(metric.value,p.name==='fraction'?1:null);if(p.type!=='Продукт')assert.equal(metric.source,undefined);}
  const unknown=buildTeamProfileProducts([inputs[0]],overlay.period,drafts)[0];assert.equal(metrics(unknown)[0].max_value,1);assert.equal(metrics(unknown)[0].value,null);assert.equal(unknown.indexMaxPoints,1);
  const salary=buildTeamProfileProducts(actual,drafts.period,drafts).find(p=>p.name==='Зарплатный продукт');assert.equal(metrics(salary).find(m=>m.code===code).max_value,1);assert.equal(metrics(salary).find(m=>m.code===code).value,.5);
  assert.equal(metrics(inputs[0])[0].max_value,.5);assert.equal(buildTeamProfileProducts([inputs[0]],'II кв. 2026')[0],inputs[0]);
});

test('15 user-confirmed absolute draft points use the authorized Q3 maximum and auditable raw Excel facts',()=>{
  const expected={'Брокерский счет':1,'ВЗР':0,'ОПИФ':1,'ОСАГО':1,'Вклады+НС':0,'Зарплатный продукт':.5,'ИнвестКопилка':.5,'КАСКО':.5,'ПДС':.5,'Пенсионный продукт':.5,'Потребительский кредит':.5,'СберПрайм':.5,'Страхование жизни':1,'Страхование залога':1,'Детская карта':.5};
  const current=buildTeamProfileProducts(actual,drafts.period,drafts);
  const overrides=drafts.products.filter(p=>p.metrics[code].source.override);
  assert.equal(overrides.length,15);assert.equal(drafts.metricMaxOverrides[code],1);assert.equal(drafts.period,'III кв. 2026');
  for(const [name,points] of Object.entries(expected)){
    const fact=drafts.products.find(p=>p.name===name).metrics[code];
    const prior=metrics(actual.find(p=>p.name===name)).find(m=>m.code===code);
    const metric=metrics(current.find(p=>p.name===name)).find(m=>m.code===code);
    assert.equal(metric.value,points,name);assert.equal(metric.max_value,1);
    assert.equal(fact.rawValue,points);assert.equal(fact.source.override.points,points);
    assert.equal(fact.source.override.baselineMaxValue,prior.max_value);assert.equal(fact.source.override.derivedRawValue,fact.rawValue);assert.equal(fact.source.override.maxValue,1);assert.equal(fact.source.override.effectiveMaxValue,1);
    assert.equal(fact.source.override.confirmedBy,'user');assert.equal(fact.source.valueOrigin,'userConfirmedPoints');
    for(const cell of fact.source.cells)assert.deepEqual([cell.sourceName,cell.rawValue],source[Number(cell.cell.slice(1))]);
  }
  for(const team of drafts.products)assert.equal(team.metrics[code].rawValue,expected[team.name]??0,'Only the approved current facts are applied');
  for(const [name,points,coverage,oldPoints] of [['Детская карта',.5,16,0],['Страхование жизни',1,75,.5],['Страхование залога',1,90,.5]]){
    const fact=drafts.products.find(p=>p.name===name).metrics[code];assert.equal(fact.rawValue,points);assert.equal(fact.source.coveragePct,coverage);assert.equal(fact.source.override.coveragePct,coverage);
    assert.equal(fact.source.cells[0].rawValue,0,'Literal workbook zero remains unchanged');
    if(oldPoints)assert.equal(fact.source.overrideHistory.at(-1).points,oldPoints,'Superseded user point remains auditable');
  }
  for(const [name,cell] of [['Страхование жизни','B40'],['Страхование залога','B41']]){
    assert.ok(drafts.products.find(p=>p.name===name).metrics[code].source.cells.some(c=>c.cell===cell));assert.ok(!drafts.unmapped.some(c=>c.cell===cell));
  }
});

test('Q3 recommendations retain exact Q2 wording, group and difficulty while updating only current value, max and gap',()=>{
  const before=JSON.stringify(actual);
  const current=buildTeamProfileProducts(actual,drafts.period,[campaign,drafts]);
  let compared=0;
  for(const product of current){
    const old=actual.find(p=>p.name===product.name&&p.unit===product.unit&&p.type===product.type);
    for(const metric of metrics(product)){
      const source=metrics(old).find(m=>m.code===metric.code);
      if(!metric.source)continue;
      const expected=(source.recommendation_items||[]).filter(i=>typeof i.recommendation==='string');
      assert.deepEqual((metric.recommendation_items||[]).map(i=>[i.recommendation,i.group,i.recommendation_difficulty]),expected.map(i=>[i.recommendation,i.group,i.recommendation_difficulty]),`${product.name}: ${metric.code}`);
      for(const item of metric.recommendation_items||[]){assert.equal(item.value,metric.value);assert.equal(item.max_value,metric.max_value);assert.equal(item.gap,metric.value===null?null:metric.max_value-metric.value);compared++;}
    }
  }
  assert.ok(compared>100);assert.equal(JSON.stringify(actual),before);
  const deposit=current.find(p=>p.name==='Вклады+НС');
  assert.deepEqual(metrics(deposit).find(m=>m.code===code).recommendation_items.map(i=>i.recommendation),['Увеличить покрытие черновиков']);
  const fixture={id:'no-source-advice',name:'Без исходной рекомендации',unit:'DB',type:'Продукт',period:'II кв. 2026',metrics:[{code:'attract',metrics:[{code,name:'Черновики',value:0,max_value:1,is_applicabble_flg:true}]}]};
  const measured={period:drafts.period,products:[{id:fixture.id,name:fixture.name,unit:fixture.unit,type:fixture.type,metrics:{[code]:{rawValue:0,source:{file:'fixture'}}}}]};
  const noAdvice=metrics(buildTeamProfileProducts([fixture],drafts.period,measured)[0])[0];
  assert.equal(noAdvice.value,0);assert.equal(noAdvice.recommendation_items,undefined);assert.equal(noAdvice.recommendation,undefined);
});
