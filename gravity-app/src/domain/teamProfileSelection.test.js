import test from 'node:test';
import assert from 'node:assert/strict';
import {blockActualGrowth,buildTeamProfileProducts,filterTitleRowsByPeriod,resolveTeamProfileSelection} from './teamProfileSelection.js';

import {getReportPeriods} from './reportPeriods.js';
import {scoreFor,groupFor} from './report.js';

const q1='I кв. 2026',q2='II кв. 2026',q3='III кв. 2026';
const make=(id,name,unit,period,type='Продукт')=>({id,name,unit,period,type,metrics:[{code:'attract',metrics:[{value:period===q1?1:2,max_value:3}]}]});
const teams=[make('a1','Альфа','DB',q1),make('d1','Вклады','CBP',q1),make('x1','Только раньше','Data',q1),make('a2',' Альфа  ','DB',q2),make('b2','Бета','DB',q2),make('d2','Вклады+НС','CBP',q2),make('s2','Альфа','DB',q2,'Сегмент')];

test('block uplift is the sum of the metric-level DDI uplifts shown underneath',()=>{
  const metric=(code,value,previousValue,max=1,previousMax=max)=>({code,value,previousValue,max_value:max,previousMaxValue:previousMax,
    previousPeriod:q2,is_applicabble_flg:true,excluded_from_index:false,dd_calculation_flg:1});
  const result=blockActualGrowth({metrics:[metric('one',.5,.4),metric('two',.8,.5),metric('down',.2,.3),metric('flat',.4,.4),
    metric('changed-maximum',.8,.5,2,1)]},10,q3);
  assert.equal(result.indexPctDelta,3);
  assert.ok(Math.abs(result.pointsDelta-.3)<1e-9);
  assert.equal(result.previousValue,1.2);
  assert.equal(result.value,1.5);
  assert.equal(result.previousPeriod,q2);
  assert.equal(result.currentPeriod,q3);
  assert.equal(blockActualGrowth({metrics:[metric('flat',.4,.4)]},10,q3),null);
  assert.ok(Math.abs(blockActualGrowth({metrics:[metric('down',.2,.3)]},10,q3).indexPctDelta+1)<1e-9);
});

test('period change selects the same team identity with its new ID and quarter-specific metric payload',()=>{
  const before=JSON.stringify(teams);
  const old=teams[0];const next=resolveTeamProfileSelection(teams,{period:q2,unit:'DB',selected:old});
  assert.equal(next.product,teams[3]);assert.equal(next.product.id,'a2');assert.equal(next.product.metrics[0].metrics[0].value,2);
  assert.equal(next.period,q2);assert.equal(next.unit,'DB');assert.equal(next.products.length,4);assert.ok(next.products.every(t=>t.period===q2));
  assert.deepEqual(next.periods,[q1,q2,q3]);assert.equal(JSON.stringify(teams),before);
});

test('same ID cannot select another team or confuse identically named product and segment',()=>{
  const adversarial=[...teams,make('a1','Чужая команда','DB',q2)];
  assert.equal(resolveTeamProfileSelection(adversarial,{period:q2,unit:'DB',selected:teams[0]}).product.id,'a2');
  const segment=make('old-segment','Альфа','DB',q1,'Сегмент');
  assert.equal(resolveTeamProfileSelection(adversarial,{period:q2,unit:'DB',selected:segment}).product.id,'s2');
});

test('missing team falls back inside the retained unit and resets a unit absent from the new quarter',()=>{
  const disappeared=make('gone','Прежняя команда','DB',q1);
  const within=resolveTeamProfileSelection(teams,{period:q2,unit:'DB',selected:disappeared});
  assert.equal(within.unit,'DB');assert.equal(within.product.id,'a2');
  const reset=resolveTeamProfileSelection(teams,{period:q2,unit:'Data',selected:teams[2]});
  assert.equal(reset.unit,'');assert.equal(reset.product.id,'a2');assert.equal(reset.product.period,q2);
});

test('unit changes cannot keep a team outside the chosen unit or select another period',()=>{
  const result=resolveTeamProfileSelection(teams,{period:q2,unit:'CBP',selected:teams[3]});
  assert.equal(result.product.id,'d2');assert.equal(result.unit,'CBP');
  assert.deepEqual(result.products.filter(t=>t.unit===result.unit).map(t=>t.id),['d2']);
  assert.ok(!result.products.some(t=>t.id==='d1'));
});

test('default and cleared period choose a valid quarter and deposits within the selected scope',()=>{
  assert.equal(resolveTeamProfileSelection(teams).product.id,'d1');
  assert.equal(resolveTeamProfileSelection(teams,{period:'',unit:'DB'}).product.id,'a1');
  assert.equal(resolveTeamProfileSelection(teams,{period:q2,unit:'CBP'}).product.id,'d2');
});

test('unavailable and empty periods expose an empty profile instead of stale team data',()=>{
  const missing=resolveTeamProfileSelection(teams,{period:'III кв. 2026',unit:'DB',selected:teams[0]});
  assert.deepEqual(missing.products,[]);assert.equal(missing.product,null);assert.equal(missing.unit,'');assert.equal(missing.period,'III кв. 2026');
  assert.deepEqual(resolveTeamProfileSelection([]),{period:q3,periods:[q3],products:[],unit:'',product:null});
});


test('quarter-scoped title rows give the selected team its own score and group',()=>{
  const products=[make('old','Бета','DB',q1),make('new','Бета','DB',q2)];
  const rows=[{name:'Бета',unit:'DB',period:q1,score:22,group:'Требуют внимания'},{name:'Бета',unit:'DB',period:q2,score:88,group:'Лидеры Data Driven'},{name:'Бета',unit:'DB',score:99,group:'Ambiguous legacy'}];
  const before=JSON.stringify(rows);
  for(const[period,expectedScore,expectedGroup]of [[q1,22,'Требуют внимания'],[q2,88,'Лидеры Data Driven']]){
    const selection=resolveTeamProfileSelection(products,{period,selected:products[0]});
    const scoped=filterTitleRowsByPeriod(rows,products,selection.period);
    assert.equal(scoped.length,1);assert.equal(scoreFor(selection.product,scoped),expectedScore);assert.equal(groupFor(selection.product,scoped),expectedGroup);
  }
  assert.equal(JSON.stringify(rows),before);
});

test('legacy unlabelled title scores stay compatible only when the source quarter is unambiguous',()=>{
  const rows=[{name:'Бета',unit:'DB',score:61,group:'Зрелые'}];
  const one=[make('only','Бета','DB',q1)];
  assert.deepEqual(filterTitleRowsByPeriod(rows,one,q1),rows);
  assert.equal(scoreFor(one[0],filterTitleRowsByPeriod(rows,one,q1)),61);
  assert.deepEqual(filterTitleRowsByPeriod(rows,one,q2),[]);
  assert.deepEqual(filterTitleRowsByPeriod(rows,[...one,make('other','Бета','DB',q2)],q2),[]);
  assert.deepEqual(filterTitleRowsByPeriod(rows,[],''),rows);
});


test('shared period catalog adds empty Q3 once, deduplicates and preserves other actual periods',()=>{
  const products=[make('later','Позже','DB','IV кв. 2027'),make('second','Бета','DB',q2),make('duplicate','Другая','CBP',q2),make('first','Альфа','DB',q1),make('empty','','DB','')];
  const original=JSON.stringify(products);
  assert.deepEqual(getReportPeriods(products),[q1,q2,q3,'IV кв. 2027']);
  assert.deepEqual(getReportPeriods([...products,make('existing-q3','Команда','DB',q3)]),[q1,q2,q3,'IV кв. 2027']);
  assert.deepEqual(getReportPeriods([]),[q3]);assert.equal(JSON.stringify(products),original);
  const empty=resolveTeamProfileSelection(products,{period:q3,unit:'DB',selected:products[1]});
  assert.equal(empty.period,q3);assert.deepEqual(empty.products,[]);assert.equal(empty.product,null);assert.equal(empty.unit,'');
});


test('display-only empty quarter keeps team and metric structure while dropping all previous assessment content',()=>{
  const source={id:'sensitive-q2',name:'Вклады',unit:'DB',type:'Продукт',period:q2,
    score:95,group:'Лидеры',links:{report:'https://private.example.ru/q2'},roadmap:{uplift:8},
    recommendations:['Q2 recommendation'],ai_skill_mappings:[{ai_products:['Q2 funnel']}],crosssell:{seen_out_n:4},
    metrics:[{code:'attract',name:'Воронка привлечения',value:9,max_value:10,links:{report:'Q2block'},tools:[{link:'Q2tool'}],recommendations:['Q2 advice'],metrics:[
      {code:'attract.report',name:'Отчетность',metric_subgroup:'Отчётность',value:1,max_value:2,footer:'Описание метрики',traffic_light:'green',is_applicabble_flg:false,links:{report:'Q2metric'},recommendation_items:[{gap:1}],ai_skill_mappings:[{skill_key:'Q2'}]},
      {code:'attract.regularity',name:'Регулярность (авто)',metric_subgroup:'Отчётность',value:.5,max_value:1,links:{report:'Q2regularity'}}
    ]}]};
  const input=[source,{...source,id:'duplicate-q1',period:q1}];const original=JSON.stringify(input);
  const empty=buildTeamProfileProducts(input,q3);assert.equal(empty.length,1);
  assert.deepEqual(empty[0],{id:`sensitive-q2::empty::${q3}`,name:'Вклады',unit:'DB',type:'Продукт',period:q3,isPlaceholder:true,indexMaxPoints:1,
    metrics:[{code:'attract',name:'Воронка привлечения',metrics:[{code:'attract.report',name:'Отчетность',metric_subgroup:'Отчётность',footer:'Описание метрики',max_value:2,is_applicabble_flg:false,recommendation_items:[],value:null},{code:'attract.regularity',name:'Регулярность (авто)',metric_subgroup:'Отчётность',max_value:1,value:null}]}]});
  assert.equal(JSON.stringify(input),original,'Templates never mutate original period payload');
  assert.deepEqual(filterTitleRowsByPeriod([{name:'Вклады',unit:'DB',score:95}],input,q3),[]);
  const first=resolveTeamProfileSelection(empty,{period:q3,unit:'DB',selected:source});
  assert.equal(first.product,empty[0]);assert.equal(first.unit,'DB');
  const repeated=resolveTeamProfileSelection(empty,{period:q3,unit:first.unit,selected:first.product});
  assert.equal(repeated.product,first.product,'Stable memoized template list makes selection effect converge');
});

test('placeholder team selectors retain all distinct identities but actual data stays authoritative',()=>{
  const empty=buildTeamProfileProducts(teams,q3);
  assert.equal(empty.length,6);assert.ok(empty.every(t=>t.period===q3 && t.isPlaceholder));
  const scope=resolveTeamProfileSelection(empty,{period:q3,unit:'CBP',selected:teams[0]});
  assert.equal(scope.product.unit,'CBP');assert.ok(scope.products.some(t=>t.type==='Сегмент'));
  const actual=buildTeamProfileProducts(teams,q2);assert.equal(actual.length,4);assert.equal(actual[0],teams[3]);assert.ok(actual.every(t=>!t.isPlaceholder));
  assert.deepEqual(buildTeamProfileProducts(teams,'IV кв. 2030'),[]);
  assert.deepEqual(buildTeamProfileProducts([],q3),[]);
});

test('empty-quarter profiles retain sanitized reference URLs and date participant links without treating them as measurements',()=>{
  const source={id:'references',name:'Команда со ссылками',unit:'DB',type:'Продукт',period:q2,roadmap:{uplift:9},ai_skill_mappings:[{skill_key:'old'}],metrics:[{
    code:'alerts',name:'Оповещения',
    actions:[{label:'Справочный отчёт',url:'https://example.ru/help'},{label:'Справочный отчёт',url:'https://example.ru/help'},{label:'Bad JS',url:'javascript:alert(1)'},{label:'Bad noise',url:'not a URL'}],
    tools:[{kind:'instruction',name:'Настройка',button:{label:'Инструкция',link:'https://example.com/instruction'}},{kind:'analytics',button:{label:'Old AI',link:'https://example.ru/old-ai'}}],
    participant_links:[{label:'Ранее приложенный отчёт',url:'https://example.ru/participant'},{label:'Ранее приложенный отчёт',url:'https://example.ru/participant'},{label:'Bad participant',url:'data:text/html,noise'}],
    metrics:[{code:'alerts.business_metrics',name:'Оповещения по метрикам',value:1,max_value:1,recommendation_items:[{gap:1}]}]
  }]};
  const before=JSON.stringify(source);const profile=buildTeamProfileProducts([source],q3)[0];const block=profile.metrics[0];
  assert.deepEqual(new Set(block.reference_links.map(x=>x.url)),new Set(['https://example.ru/help','https://example.com/instruction']));
  assert.deepEqual(block.participant_links,[{label:'Ранее приложенный отчёт',url:'https://example.ru/participant'}]);
  assert.equal(block.referencePeriod,q2);
  assert.equal(block.metrics[0].value,null);assert.equal(block.metrics[0].source,undefined);assert.equal(block.metrics[0].previousValue,undefined);
  assert.equal(profile.roadmap,undefined);assert.equal(profile.ai_skill_mappings,undefined);assert.equal(block.tools,undefined);assert.equal(block.actions,undefined);
  assert.deepEqual(block.metrics[0].recommendation_items,[]);assert.equal(JSON.stringify(source),before);
  assert.equal(buildTeamProfileProducts([source],q2)[0],source,'Measured quarter references and scores remain untouched');
});


test('confirmed Q2 retention restores exact PB fractions and full benchmarks without broadening ordinary assessments',()=>{
  const values=[['mehaniki.uderzhanie_klientov',1.25,1.5],['mehaniki.povyshenie_urovnya_klienta',1.5,2],['mehaniki.vozvrat_klientov',0,1]];
  const pb={id:'pb-retention',name:'PB',unit:'Data',type:'Сегмент',period:q2,metrics:[{code:'mehaniki',metrics:values.map(([code,value,max_value])=>({code,value,max_value,is_applicabble_flg:true,dd_calculation_flg:1,recommendation_items:[{recommendation:'Исходный текст',group:5}]}))},{code:'attract',metrics:[{code:'attract.benchmarks',value:.5,max_value:.5,is_applicabble_flg:true,dd_calculation_flg:1}]}]};
  const fact=(value,max,policy)=>({rawValue:value/max,source:{origin:'userConfirmedQuarterRetention',confirmedBy:'user',fromPeriod:q2,sourceValue:value,sourceMaxValue:max,policy}});
  const overlay={period:q3,scope:'user-confirmed-q2-retention',products:[{id:pb.id,name:pb.name,unit:pb.unit,type:pb.type,metrics:Object.fromEntries([...values.map(([code,v,max])=>[code,fact(v,max,'pbAllMechanics')]),['attract.benchmarks',fact(.5,.5,'fullBenchmarks')]])}]};
  const snapshot=JSON.stringify({pb,overlay});
  const restored=buildTeamProfileProducts([pb],q3,overlay)[0];
  const all=restored.metrics.flatMap(b=>b.metrics);
  for(const [code,v,max]of [...values,['attract.benchmarks',.5,.5]]){const m=all.find(m=>m.code===code);assert.equal(m.value,v);assert.equal(m.max_value,max);assert.equal(m.previousValue,v);assert.equal(m.previousMaxValue,max);}
  assert.equal(restored.indexMaxPoints,5);
  for(const m of all.filter(m=>m.recommendation_items))assert.equal(m.recommendation_items[0].gap,m.max_value-m.value);
  const first=()=>buildTeamProfileProducts([pb],q3,overlay)[0].metrics[0].metrics[0];
  const stored=structuredClone(overlay.products[0].metrics[values[0][0]]);
  for(const mutate of [f=>f.rawValue=.75,f=>f.source.sourceValue=1,f=>f.source.sourceMaxValue=2,f=>f.source.confirmedBy='other',f=>f.source.fromPeriod=q1,f=>f.source.policy='fullBenchmarks']){
    const f=overlay.products[0].metrics[values[0][0]]=structuredClone(stored);mutate(f);assert.equal(first().value,null);
  }
  overlay.products[0].metrics[values[0][0]]=structuredClone(stored);
  for(const field of ['name','unit','type']){const old=overlay.products[0][field];overlay.products[0][field]='wrong';assert.equal(first().value,null);overlay.products[0][field]=old;}
  const oldscope=overlay.scope;overlay.scope='mechanics-user-assessment';assert.equal(first().value,null);overlay.scope=oldscope;
  const notApplicable=structuredClone(pb);notApplicable.metrics[0].metrics[0].is_applicabble_flg=false;
  assert.equal(buildTeamProfileProducts([notApplicable],q3,overlay)[0].metrics[0].metrics[0].value,null);
  const partialBench=structuredClone(pb);partialBench.metrics[1].metrics[0].value=.25;
  overlay.products[0].metrics['attract.benchmarks']=fact(.25,.5,'fullBenchmarks');
  assert.equal(buildTeamProfileProducts([partialBench],q3,overlay)[0].metrics[1].metrics[0].value,null);
  overlay.products[0].metrics['attract.benchmarks']=fact(.5,.5,'fullBenchmarks');
  assert.deepEqual(buildTeamProfileProducts([pb],q2,overlay),[pb]);
  assert.equal(JSON.stringify({pb,overlay}),snapshot);
});

test('full product-knowledge carry accepts only the two exact full Q2 metrics, preserving NA and partial unknowns',()=>{
  const codes=['general.klienty_s_produktom','general.mau_produkta','general.mau_u_vashego_kanala','general.mau_ios','general.aktivnaya_klientskaya_baza'];
  const team={id:'knowledge',name:'Команда',unit:'Data',type:'Канал',period:q2,metrics:[{code:'general',metrics:codes.map(code=>({code,value:.2,max_value:.2,is_applicabble_flg:true,dd_calculation_flg:1}))}]};
  const source={origin:'userConfirmedQuarterRetention',confirmedBy:'user',fromPeriod:q2,sourceValue:.2,sourceMaxValue:.2,policy:'fullProductKnowledge'};
  const overlay={period:q3,scope:'user-confirmed-q2-retention',products:[{id:team.id,name:team.name,unit:team.unit,type:team.type,metrics:Object.fromEntries(codes.map(code=>[code,{rawValue:1,source:{...source}}]))}]};
  const snapshot=JSON.stringify({team,overlay});
  const current=()=>buildTeamProfileProducts([team],q3,overlay)[0].metrics[0].metrics;
  assert.deepEqual(current().map(m=>m.value),[.2,.2,null,null,null]);
  assert.ok(current().every(m=>m.max_value===.2));
  const target=overlay.products[0].metrics[codes[0]];
  target.rawValue=.5;target.source.sourceValue=.1;team.metrics[0].metrics[0].value=.1;
  assert.equal(current()[0].value,null,'Partial Q2 values do not qualify even with consistent provenance');
  target.rawValue=1;target.source.sourceValue=.2;team.metrics[0].metrics[0].value=.2;
  team.metrics[0].metrics[0].is_applicabble_flg=false;assert.equal(current()[0].value,null);
  team.metrics[0].metrics[0].is_applicabble_flg=true;
  overlay.scope='user-metric-assessment';assert.equal(current()[0].value,null);overlay.scope='user-confirmed-q2-retention';
  assert.deepEqual(buildTeamProfileProducts([team],q2,overlay),[team]);
  assert.equal(JSON.stringify({team,overlay}),snapshot);
});

test('direct Q3 business alert zero applies with exact identity and cannot alter system alerts or Q2', () => {
  const metric = code => ({code, name: code, value: 1, max_value: 1, is_applicabble_flg: true, dd_calculation_flg: 1});
  const team = {id: 'debit', name: 'Дебетовая карта', unit: 'DB', type: 'Продукт', period: q2,
    metrics: [{code: 'alerts', metrics: [metric('alerts.business_metrics'), metric('alerts.system_failures')]}]};
  const other = {...team, id: 'other', name: 'Другая карта'};
  const record = {id: team.id, name: team.name, unit: team.unit, type: team.type,
    metrics: {'alerts.business_metrics': {rawValue: 0, source: {confirmedBy: 'user'}},
      'alerts.system_failures': {rawValue: 0, source: {confirmedBy: 'user'}}}};
  const overlay = {scope: 'q3-score-correction', period: q3, products: [record]};
  const before = buildTeamProfileProducts([team, other], q3), after = buildTeamProfileProducts([team, other], q3, overlay);
  assert.equal(after[0].metrics[0].metrics[0].value, 0);
  assert.equal(after[0].metrics[0].metrics[0].max_value, 1);
  assert.deepEqual(after[0].metrics[0].metrics[1], before[0].metrics[0].metrics[1]);
  assert.deepEqual(after[1], before[1]);
  assert.deepEqual(buildTeamProfileProducts([team, other], q2, overlay), [team, other]);
});
