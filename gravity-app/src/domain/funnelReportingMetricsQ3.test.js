import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts,metricActualGrowth} from './teamProfileSelection.js';
const actual=JSON.parse(readFileSync(new URL('../../public/report-data.json',import.meta.url))).products;
const overlay=JSON.parse(readFileSync(new URL('../data/funnel-reporting-metrics-q3-2026.json',import.meta.url)));
const others=['campaign','draft','crosssell','research'].map(name=>JSON.parse(readFileSync(new URL(`../data/${name}-metrics-q3-2026.json`,import.meta.url))));
const codes=['attract.nastroena_otchetnostь','attract.regulyarnostь','attract.report_completeness','churn.nastroena_otchetnostь','churn.regulyarnostь','churn.report_completeness'];
const metrics=p=>p.metrics.flatMap(b=>b.metrics);
const eligible=m=>codes.includes(m.code)&&m.is_applicabble_flg===true&&Number(m.max_value)>0&&m.value===m.max_value;

test('143 exact fully earned Q2 reporting facts carry to 52 teams including informational regularity',()=>{
  assert.equal(overlay.scope,'funnel-reporting-carry-forward');assert.equal(overlay.period,'III кв. 2026');
  assert.deepEqual(overlay.counts,{teams:52,facts:143,byMetricCode:Object.fromEntries(codes.map((code,i)=>[code,[36,33,16,29,28,1][i]])),byTeamType:{'Продукт':44,'Сегмент':3,'Канал':5}});
  const expected=actual.filter(p=>metrics(p).some(eligible));assert.equal(expected.length,52);assert.equal(overlay.products.length,52);
  let informational=0,fractional=0;
  for(const prior of actual){
    const fact=overlay.products.find(p=>p.id===prior.id);
    const allowed=metrics(prior).filter(eligible);
    if(!allowed.length){assert.equal(fact,undefined);continue;}
    assert.deepEqual(Object.keys(fact.metrics).sort(),allowed.map(m=>m.code).sort());
    for(const old of allowed){
      const current=fact.metrics[old.code];assert.equal(current.rawValue,1);
      assert.equal(current.source.origin,'priorQuarterCarryForward');assert.equal(current.source.fromPeriod,'II кв. 2026');assert.equal(current.source.confirmedBy,'user');
      assert.equal(current.source.sourceValue,old.value);assert.equal(current.source.sourceMaxValue,old.max_value);assert.equal(current.source.sourceMetricCode,old.code);
      if(old.excluded_from_index||old.dd_calculation_flg===0)informational++;if(old.max_value<1)fractional++;
    }
  }
  assert.ok(informational>0);assert.ok(fractional>0);
});

test('only eligible reporting scores change; Q2, fractional maxima, other Q3 facts and unknown partial/NA scores remain intact',()=>{
  const oldData=JSON.stringify(actual),oldFacts=JSON.stringify(overlay);
  const prior=buildTeamProfileProducts(actual,overlay.period,others);
  const current=buildTeamProfileProducts(actual,overlay.period,[...others,overlay]);
  let applied=0,partial=0,na=0;
  for(const product of current){
    const source=actual.find(p=>p.name===product.name&&p.unit===product.unit&&p.type===product.type);
    const before=prior.find(p=>p.name===product.name&&p.unit===product.unit&&p.type===product.type);
    assert.equal(product.indexMaxPoints,before.indexMaxPoints);
    for(const metric of metrics(product)){
      const old=metrics(source).find(m=>m.code===metric.code),unmodified=metrics(before).find(m=>m.code===metric.code);
      assert.equal(metric.max_value,unmodified.max_value);
      if(eligible(old)){
        assert.equal(metric.value,old.max_value);assert.equal(metric.previousValue,old.value);assert.equal(metric.previousMaxValue,old.max_value);
        assert.equal(metricActualGrowth(metric,product.indexMaxPoints,product.period),null,'Carried full scores do not invent actual growth');
        assert.ok((metric.recommendation_items||[]).every(i=>i.gap===0));applied++;
      }else{
        assert.deepEqual(metric,unmodified,'All unrelated scores, metadata and recommendations are unchanged');
        if(codes.includes(metric.code)){assert.equal(metric.value,null);if(old.is_applicabble_flg===false||old.max_value===0)na++;else partial++;}
      }
    }
  }
  assert.equal(applied,143);assert.ok(partial>0);assert.ok(na>0);
  assert.equal(JSON.stringify(actual),oldData);assert.equal(JSON.stringify(overlay),oldFacts);
  buildTeamProfileProducts(actual,'II кв. 2026',[...others,overlay]).forEach(p=>assert.equal(p,actual.find(old=>old.id===p.id)));
});

test('reporting scope permits exactly six reporting codes across types and cannot import research or campaign facts',()=>{
  for(const type of ['Продукт','Канал','Сегмент']){
    const source={id:type,name:type,type,unit:'DB',period:'II кв. 2026',metrics:[{code:'attract',metrics:[...codes.map(code=>({code,value:.5,max_value:.5,is_applicabble_flg:true})),{code:'hyp.datadriven_rating_7_5',value:0,max_value:1,is_applicabble_flg:true},{code:'attract.campaign_launches',value:0,max_value:1,is_applicabble_flg:true}]}]};
    const facts={period:overlay.period,scope:overlay.scope,metricMaxOverrides:{[codes[0]]:99},products:[{id:type,name:type,type,unit:'DB',metrics:Object.fromEntries(metrics(source).map(m=>[m.code,{rawValue:1,source:{fixture:true}}]))}]};
    const output=metrics(buildTeamProfileProducts([source],overlay.period,facts)[0]);
    for(const metric of output){assert.equal(metric.max_value,metric.code.startsWith('hyp.')||metric.code==='attract.campaign_launches'?1:.5);assert.equal(metric.value,codes.includes(metric.code)?.5:null);}
    const research=buildTeamProfileProducts([source],overlay.period,{...facts,scope:'research-assessment'})[0];assert.equal(metrics(research).find(m=>m.code==='hyp.datadriven_rating_7_5').value,1);assert.equal(metrics(research)[0].value,null);
  }
});
