import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts,metricActualGrowth} from './teamProfileSelection.js';
const actual=JSON.parse(readFileSync(new URL('../../public/report-data.json',import.meta.url))).products;
const overlay=JSON.parse(readFileSync(new URL('../data/mechanics-metrics-q3-2026.json',import.meta.url)));
const others=['campaign','draft','crosssell','research','funnel-reporting','ux-score'].map(name=>JSON.parse(readFileSync(new URL(`../data/${name}-metrics-q3-2026.json`,import.meta.url))));
const cross=others[2],crossCode='mehaniki.cross_sell';
const metrics=p=>p.metrics.flatMap(b=>b.metrics);
const mechanics=p=>p.metrics.filter(b=>b.code==='mehaniki').flatMap(b=>b.metrics);
const eligible=m=>m.is_applicabble_flg===true&&m.max_value>0&&m.value===m.max_value;

test('the carry overlay accounts for all 213 eligible Q2 mechanics as 195 carry facts and 18 explicit Q3 conflicts, including fractional maxima',()=>{
  assert.equal(overlay.scope,'mechanics-carry-forward');assert.equal(overlay.period,'III кв. 2026');
  const expected=actual.filter(p=>mechanics(p).some(eligible));assert.equal(expected.length,81);assert.equal(overlay.products.length,81);
  let count=0,fractional=0;const types=new Set();
  for(const old of actual){
    const fact=overlay.products.find(p=>p.id===old.id),full=mechanics(old).filter(m=>eligible(m)&&m.code!==crossCode);
    if(!full.length){assert.equal(fact,undefined);continue;}
    assert.equal(fact.name,old.name);assert.equal(fact.unit,old.unit);assert.equal(fact.type,old.type);types.add(fact.type);
    assert.deepEqual(Object.keys(fact.metrics).sort(),full.map(m=>m.code).sort());
    for(const m of full){const entry=fact.metrics[m.code];assert.equal(entry.rawValue,1);assert.equal(entry.source.origin,'priorQuarterCarryForward');assert.equal(entry.source.fromPeriod,'II кв. 2026');assert.equal(entry.source.confirmedBy,'user');assert.equal(entry.source.sourceValue,m.value);assert.equal(entry.source.sourceMaxValue,m.max_value);if(m.max_value<1)fractional++;count++;}
  }
  const candidates=actual.flatMap(p=>mechanics(p).filter(eligible).map(m=>({id:p.id,code:m.code,value:m.value,max:m.max_value})));assert.equal(candidates.length,213);
  assert.equal(overlay.skippedConflicts.length,18);assert.equal(overlay.counts.candidateFacts,213);assert.equal(overlay.counts.facts,195);
  for(const conflict of overlay.skippedConflicts){const candidate=candidates.find(c=>c.id===conflict.id&&c.code===conflict.metricCode);assert.ok(candidate);assert.equal(conflict.priorQuarterValue,candidate.value);assert.equal(conflict.priorQuarterMaxValue,candidate.max);const explicit=cross.products.find(p=>p.id===conflict.id).metrics[crossCode];assert.equal(conflict.metricCode,crossCode);assert.ok([0, 0.5].includes(conflict.existingQ3.rawValue));if(conflict.existingQ3.rawValue!==explicit.rawValue){assert.equal(conflict.existingQ3.rawValue,0);assert.equal(explicit.rawValue,0.5);assert.equal(explicit.source.incomingQualifies,true);assert.ok(explicit.source.incomingCount>1);}assert.ok(!overlay.products.find(p=>p.id===conflict.id)?.metrics[crossCode]);}
  assert.equal(count,195);assert.ok(fractional>0);assert.deepEqual([...types].sort(),['Канал','Продукт','Сегмент'].sort());
});

test('full mechanics retain their Q2 values/maxima and recommendations while partial and NA stay unknown, with no other changes',()=>{
  const beforeData=JSON.stringify(actual),beforeOverlay=JSON.stringify(overlay);
  const baseline=buildTeamProfileProducts(actual,overlay.period);
  const result=buildTeamProfileProducts(actual,overlay.period,overlay);
  let count=0,partial=0,na=0;
  for(const current of result){
    const old=actual.find(p=>p.name===current.name&&p.unit===current.unit&&p.type===current.type),prior=baseline.find(p=>p.name===current.name&&p.unit===current.unit&&p.type===current.type);
    assert.equal(current.indexMaxPoints,prior.indexMaxPoints);
    for(const metric of metrics(current)){
      const source=metrics(old).find(m=>m.code===metric.code),unchanged=metrics(prior).find(m=>m.code===metric.code);
      assert.equal(metric.max_value,source.max_value);
      if(mechanics(old).includes(source)&&eligible(source)&&source.code!==crossCode){
        assert.equal(metric.value,source.value);assert.equal(metricActualGrowth(metric,current.indexMaxPoints,current.period),null);
        assert.deepEqual((metric.recommendation_items||[]).map(i=>[i.recommendation,i.group,i.recommendation_difficulty]),(source.recommendation_items||[]).map(i=>[i.recommendation,i.group,i.recommendation_difficulty]));
        assert.ok((metric.recommendation_items||[]).every(i=>i.gap===0));count++;
      }else{assert.deepEqual(metric,unchanged);if(mechanics(old).includes(source)){assert.equal(metric.value,null);if(source.is_applicabble_flg===false||source.max_value<=0)na++;else partial++;}}
    }
  }
  assert.equal(count,195);assert.ok(partial>0);assert.ok(na>0);assert.equal(JSON.stringify(actual),beforeData);assert.equal(JSON.stringify(overlay),beforeOverlay);
  buildTeamProfileProducts(actual,'II кв. 2026',[overlay,...others]).forEach(p=>assert.equal(p,actual.find(old=>old.id===p.id)));
});

test('explicit Q3 cross-sell facts, including zeros, win over prior full mechanics and all other Q3 metrics remain intact',()=>{
  const baseline=buildTeamProfileProducts(actual,overlay.period,others),next=buildTeamProfileProducts(actual,overlay.period,[overlay,...others]);
  let overridden=0,zeros=0;
  for(const current of next){
    const old=actual.find(p=>p.name===current.name&&p.unit===current.unit&&p.type===current.type),before=baseline.find(p=>p.name===current.name&&p.unit===current.unit&&p.type===current.type);
    const explicit=cross.products.find(p=>p.id===old.id)?.metrics[crossCode];assert.equal(current.indexMaxPoints,before.indexMaxPoints);
    for(const metric of metrics(current)){
      const source=metrics(old).find(m=>m.code===metric.code),prior=metrics(before).find(m=>m.code===metric.code);
      if(metric.code===crossCode&&explicit){assert.deepEqual(metric,prior);assert.equal(metric.value,explicit.rawValue*source.max_value);if(eligible(source)){overridden++;if(explicit.rawValue===0)zeros++;}}
      else if(mechanics(old).includes(source)&&eligible(source))assert.equal(metric.value,source.value);
      else assert.deepEqual(metric,prior);
    }
    assert.deepEqual(current.metric_recommendations,before.metric_recommendations);
  }
  assert.equal(overridden,18);assert.ok(zeros>0,'A Q3 explicit zero must override a Q2 full cross-sell score');
  const old=actual.find(p=>p.name==='БПИФ');const identity={id:old.id,name:old.name,unit:old.unit,type:old.type};
  const carry={period:overlay.period,scope:overlay.scope,products:[{...identity,metrics:{[crossCode]:{rawValue:1,source:{origin:'priorQuarterCarryForward'}}}}]};
  for(const rawValue of [0,.5]){const explicit={period:overlay.period,products:[{...identity,metrics:{[crossCode]:{rawValue,source:{origin:'explicitQ3Fixture'}}}}]};const result=metrics(buildTeamProfileProducts([old],overlay.period,[carry,explicit])[0]).find(m=>m.code===crossCode);assert.equal(result.value,rawValue);assert.equal(result.source.origin,'explicitQ3Fixture');}
  const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');assert.match(app,/const Q3_OVERLAYS = \[mechanicsMetricsQ32026,[^\]]*crosssellMetricsQ32026/,'The app applies explicit Q3 cross-sell after the carry overlay');
});

test('mechanics scope stays inside mechanics for every team type and never imports unrelated facts or max overrides',()=>{
  const selected=['mehaniki.monitoring_mehanik','mehaniki.doprodazhi_up_sell'];
  for(const type of ['Продукт','Канал','Сегмент']){
    const old={id:type,name:type,unit:'DB',type,period:'II кв. 2026',metrics:[{code:'mehaniki',metrics:[{code:selected[0],value:.25,max_value:.25,is_applicabble_flg:true},{code:selected[1],value:.5,max_value:.5,is_applicabble_flg:true},{code:'hyp.datadriven_rating_7_5',value:0,max_value:1,is_applicabble_flg:true},{code:'attract.campaign_launches',value:0,max_value:1,is_applicabble_flg:true}]}]};
    const fact={period:overlay.period,scope:overlay.scope,metricMaxOverrides:{[selected[0]]:99},products:[{id:type,name:type,unit:'DB',type,crosssellRecommendations:[{skill_key:'cross_sell',recommendations:['Must not leak']}],metrics:Object.fromEntries(metrics(old).map(m=>[m.code,{rawValue:1,source:{fixture:true}}]))}]};
    const current=buildTeamProfileProducts([old],overlay.period,fact)[0];assert.equal(metrics(current)[0].value,.25);assert.equal(metrics(current)[0].max_value,.25);assert.equal(metrics(current)[1].value,.5);assert.equal(metrics(current)[2].value,null);assert.equal(metrics(current)[3].value,null);assert.equal(current.metric_recommendations,undefined);
  }
});
