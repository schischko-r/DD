import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts,metricActualGrowth} from './teamProfileSelection.js';
const actual=JSON.parse(readFileSync(new URL('../../public/report-data.json',import.meta.url))).products;
const overlay=JSON.parse(readFileSync(new URL('../data/ux-score-metrics-q3-2026.json',import.meta.url)));
const others=['campaign','draft','crosssell','research','funnel-reporting'].map(name=>JSON.parse(readFileSync(new URL(`../data/${name}-metrics-q3-2026.json`,import.meta.url))));
const code='cx.uh_score';
const metrics=p=>p.metrics.flatMap(b=>b.metrics);
const expected={'СберKids':0,'СберИнвестор':.5,'СБОЛ':.5,'Уведомления':1};

test('four exact DP channels receive the explicit Q3 UX scores with no CX or UX-alert substitution',()=>{
  assert.equal(overlay.scope,'ux-score-assessment');assert.equal(overlay.period,'III кв. 2026');
  assert.equal(overlay.products.length,4);assert.deepEqual(overlay.products.map(p=>p.name).sort(),Object.keys(expected).sort());
  for(const team of overlay.products){
    const old=actual.find(p=>p.id===team.id);assert.ok(old);assert.equal(old.name,team.name);assert.equal(team.unit,'DP');assert.equal(team.type,'Канал');assert.deepEqual(Object.keys(team.metrics),[code]);
    const fact=team.metrics[code];assert.equal(fact.rawValue,expected[team.name]);assert.equal(fact.source.points,expected[team.name]);assert.equal(fact.source.confirmedBy,'user');assert.equal(fact.source.metricCode,code);assert.equal(fact.source.origin,'userProvidedAssessment');
    assert.equal(metrics(old).find(m=>m.code===code).max_value,1);
    assert.equal(fact.source.averageScore,undefined);assert.equal(fact.source.averageScoreText,undefined);
  }
});

test('only the four UX values change while Q2, prior overlays, maxima, rubric and source-exact recommendations stay intact',()=>{
  const beforeData=JSON.stringify(actual),beforeOverlay=JSON.stringify(overlay);
  const base=buildTeamProfileProducts(actual,overlay.period,others);
  const next=buildTeamProfileProducts(actual,overlay.period,[...others,overlay]);
  let changed=0;
  for(const current of next){
    const old=actual.find(p=>p.name===current.name&&p.unit===current.unit&&p.type===current.type);
    const prior=base.find(p=>p.name===current.name&&p.unit===current.unit&&p.type===current.type);
    assert.equal(current.indexMaxPoints,prior.indexMaxPoints);
    for(const metric of metrics(current)){
      const previous=metrics(prior).find(m=>m.code===metric.code);
      if(metric.code!==code||!Object.hasOwn(expected,current.name)){assert.deepEqual(metric,previous);continue;}
      const q2=metrics(old).find(m=>m.code===code);assert.equal(metric.value,expected[current.name]);assert.equal(metric.max_value,1);assert.equal(metric.previousValue,q2.value);assert.equal(metric.previousMaxValue,q2.max_value);
      for(const key of ['name','footer','is_applicabble_flg','excluded_from_index','dd_calculation_flg'])assert.equal(metric[key],q2[key]);
      assert.deepEqual(metric.recommendation_items.map(i=>[i.recommendation,i.group,i.recommendation_difficulty]),q2.recommendation_items.map(i=>[i.recommendation,i.group,i.recommendation_difficulty]));
      assert.deepEqual(metric.recommendation_items.map(i=>i.recommendation),['Достигнуть целевого UХ Score']);
      assert.ok(metric.recommendation_items.every(i=>i.value===metric.value&&i.max_value===1&&i.gap===1-metric.value));
      const growth=metricActualGrowth(metric,current.indexMaxPoints,current.period);assert.equal(Boolean(growth),current.name==='Уведомления');changed++;
    }
  }
  assert.equal(changed,4);assert.equal(JSON.stringify(actual),beforeData);assert.equal(JSON.stringify(overlay),beforeOverlay);
  buildTeamProfileProducts(actual,'II кв. 2026',[...others,overlay]).forEach(p=>assert.equal(p,actual.find(old=>old.id===p.id)));
});

test('UX scope accepts fractional UX only and rejects unrelated facts, maxima and mismatched identities',()=>{
  const codes=[code,'cx.score','alerts.ux','hyp.datadriven_rating_7_5','attract.campaign_launches'];
  const old={id:'ux-test',name:'UX fixture',unit:'DP',type:'Канал',period:'II кв. 2026',metrics:[{code:'cx',metrics:codes.map(code=>({code,value:0,max_value:1,is_applicabble_flg:true}))}]};
  const record={id:old.id,name:old.name,unit:old.unit,type:old.type,metrics:Object.fromEntries(codes.map(code=>[code,{rawValue:.5,source:{fixture:true}}]))};
  const fact={period:overlay.period,scope:overlay.scope,metricMaxOverrides:{[code]:99},products:[record]};
  const output=metrics(buildTeamProfileProducts([old],overlay.period,fact)[0]);
  for(const metric of output){assert.equal(metric.max_value,1);assert.equal(metric.value,metric.code===code?.5:null);if(metric.code!==code)assert.equal(metric.source,undefined);}
  for(const key of ['id','name','unit','type']){
    const invalid={...fact,products:[{...record,[key]:'Wrong identity'}]};assert.ok(metrics(buildTeamProfileProducts([old],overlay.period,invalid)[0]).every(m=>m.value===null));
  }
});
