import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
const root=new URL('../../../',import.meta.url);
const rawReport=readFileSync(new URL('gravity-app/public/report-data.json',root));
const actual=JSON.parse(rawReport).products;
const api=JSON.parse(readFileSync(new URL('crosssell_export.json',root)));
const overlay=JSON.parse(readFileSync(new URL('../data/crosssell-metrics-q3-2026.json',import.meta.url)));
const campaigns=JSON.parse(readFileSync(new URL('../data/campaign-metrics-q3-2026.json',import.meta.url)));
const drafts=JSON.parse(readFileSync(new URL('../data/draft-metrics-q3-2026.json',import.meta.url)));
const code='mehaniki.cross_sell';
const metrics=p=>p.metrics.flatMap(b=>b.metrics);
const pointer=path=>path.split('/').slice(1).reduce((node,key)=>node[key.replaceAll('~1','/').replaceAll('~0','~')],api);

test('Q3 cross-sell preserves own observations and also credits more than one incoming observation',()=>{
  assert.deepEqual(overlay.counts,{positive:21,zero:39,notApplicable:6,missingMetric:1,products:67,unmatched:4});
  assert.equal(overlay.products.length,67);assert.equal(new Set(overlay.products.map(p=>p.id)).size,67);
  let competitorOnlyZeros=0;
  for(const p of overlay.products){
    const original=actual.find(t=>t.id===p.id);assert.equal(original.type,'Продукт');
    const old=metrics(original).find(m=>m.code===code);
    const evidence=p.metrics[code]?.source||p.diagnostics;
    assert.equal(evidence.criterionVersion,'own-observed-or-incoming-v3');
    const own=evidence.pointer?pointer(evidence.pointer):null;
    const normalize=value=>String(value||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');
    const targets=new Set((own?.judgements||[]).filter(j=>j.k==='seen'&&(j.ev||[]).some(e=>['vid','cjx'].includes(e.g)&&e.i&&e.fk&&(e.aid||e.run))).filter(j=>{const pairs=(own?.pairs||[]).filter(p=>normalize(p.target)===normalize(j.t));return !pairs.length||!pairs.every(p=>p.nature==='activation');}).map(j=>normalize(j.t)));
    assert.deepEqual(new Set(evidence.evidence.map(e=>normalize(e.target))),targets);
    assert.equal(evidence.evidence.length,targets.size,'A target is credited once across pair and judgement branches');
    const incomingQualifies=Number(own?.seen_in_n)>1;
    assert.equal(evidence.incomingQualifies,incomingQualifies);
    assert.equal(evidence.qualifyingCount,targets.size+Number(incomingQualifies));
    if(incomingQualifies){
      assert.equal(evidence.incomingEvidence.pointer,`${evidence.pointer}/seen_in_n`);
      assert.equal(evidence.incomingEvidence.value,pointer(evidence.incomingEvidence.pointer));
      assert.equal(evidence.incomingEvidence.rule,'seen_in_n > 1');
    }else assert.equal(evidence.incomingEvidence,null);
    for(const item of evidence.evidence){
      assert.ok(['pair','judgement'].includes(item.kind));
      assert.deepEqual(item.pair||item.judgement,pointer(item.pointer));
      assert.ok(item.ownEvidence.length>0,'Every credited pair has linked own interface evidence');
      for(const proof of item.ownEvidence){
        assert.deepEqual(proof.evidence,pointer(proof.pointer));
        assert.ok(['vid','cjx'].includes(proof.evidence.g));assert.ok(proof.evidence.fk);assert.ok(proof.evidence.aid||proof.evidence.run);
        const judgement=pointer(proof.pointer.replace(/\/ev\/\d+$/,''));assert.equal(judgement.k,'seen');
        assert.equal(normalize(judgement.t),normalize(item.target));
      }
    }
    for(const item of evidence.evidenceExcluded)assert.deepEqual(item.pair||item.judgement||item.candidate,pointer(item.pointer));
    const applicable=old&&old.is_applicabble_flg!==false&&old.max_value>0;
    const qualifies=targets.size>0||incomingQualifies;
    assert.equal(p.status,!old?'missingMetric':!applicable?'notApplicable':qualifies?'positive':'zero');
    if(applicable)assert.equal(p.metrics[code].rawValue,qualifies?.5:0);else assert.deepEqual(p.metrics,{});
    if(!p.matched){assert.equal(own,null);assert.equal(evidence.link,null);assert.ok(evidence.matchWarning);assert.ok(evidence.zeroMeaning.includes('не утверждение'));}
    if(p.status==='zero'&&own?.pairs?.some(pair=>pair.who?.length))competitorOnlyZeros++;
  }
  assert.ok(competitorOnlyZeros>0,'Competitor examples do not create qualifying own pairs');
  assert.ok(overlay.products.find(p=>p.name==='SberID').status==='missingMetric');
  const debit=overlay.products.find(p=>p.name==='Дебетовая карта');assert.ok(debit);assert.equal(debit.metrics[code].rawValue,.5);assert.equal(debit.metrics[code].source.evidence.length,2);
  const auto=overlay.products.find(p=>p.name==='Автокредит').metrics[code];
  assert.equal(auto.rawValue,.5);assert.equal(auto.source.evidence.length,0);assert.equal(auto.source.incomingCount,2);
});

test('Q3 applies 21 half scores and 39 zeros without changing maxima, NA, Q2 or other overlay metrics',()=>{
  assert.equal(createHash('sha256').update(rawReport).digest('hex'),'7bc87923fb0c187cb63c436a279d2434cbba969958359473e2757aed8594322b');
  const original=JSON.stringify(actual),raw=JSON.stringify(overlay);
  const baseline=buildTeamProfileProducts(actual,overlay.period,[campaigns,drafts]);
  const next=buildTeamProfileProducts(actual,overlay.period,[campaigns,drafts,overlay]);
  let positive=0,zero=0,na=0;
  for(const p of actual){
    const match=list=>list.find(t=>t.name===p.name&&t.unit===p.unit&&t.type===p.type);
    const q3=match(next),before=match(baseline),fact=overlay.products.find(t=>t.id===p.id)?.metrics[code];
    assert.equal(q3.indexMaxPoints,before.indexMaxPoints);
    for(const metric of metrics(q3)){
      const prior=metrics(p).find(m=>m.code===metric.code);assert.equal(metric.max_value,metrics(before).find(m=>m.code===metric.code).max_value);
      for(const key of ['is_applicabble_flg','excluded_from_index','dd_calculation_flg'])assert.equal(metric[key],prior[key]);
      if(metric.code!==code){assert.deepEqual(metric,metrics(before).find(m=>m.code===metric.code));continue;}
      if(fact){assert.equal(metric.value,fact.rawValue*prior.max_value);assert.deepEqual(metric.source,{...fact.source,rawValue:fact.rawValue});if(metric.value>0)positive++;else zero++;}
      else{assert.equal(metric.value,null);assert.equal(metric.source,undefined);if(p.type==='Продукт')na++;}
    }
  }
  assert.equal(positive,21);assert.equal(zero,39);assert.equal(na,6);
  const q2=buildTeamProfileProducts(actual,'II кв. 2026',overlay);assert.equal(q2.length,83);q2.forEach(p=>assert.equal(p,actual.find(t=>t.id===p.id)));
  assert.equal(JSON.stringify(actual),original);assert.equal(JSON.stringify(overlay),raw);
});

test('fractional cross-sell fact scales the existing rubric and cannot enable fractional facts for other metrics',()=>{
  const p={id:'fractional',name:'Дробный максимум',type:'Продукт',unit:'DB',period:'II кв. 2026',metrics:[{code:'mehaniki',metrics:[{code,value:0,max_value:.5,is_applicabble_flg:true},{code:'attract.campaign_launches',value:0,max_value:1,is_applicabble_flg:true}]}]};
  const facts={period:'III кв. 2026',products:[{id:p.id,name:p.name,type:p.type,unit:p.unit,metrics:{[code]:{rawValue:.5,source:{criterion:'fixture'}},'attract.campaign_launches':{rawValue:.5,source:{criterion:'invalid-half'}}}}]};
  const q3=buildTeamProfileProducts([p],facts.period,[facts])[0];
  assert.equal(metrics(q3)[0].max_value,.5);assert.equal(metrics(q3)[0].value,.25);
  assert.equal(metrics(q3)[1].max_value,1);assert.equal(metrics(q3)[1].value,null);assert.equal(metrics(q3)[1].source,undefined);
  assert.equal(p.metrics[0].metrics[0].value,0);
});

test('fresh cross-sell recommendations and preview use the same API snapshot as the scoring evidence',()=>{
  const original=JSON.stringify(actual);
  const current=buildTeamProfileProducts(actual,overlay.period,[campaigns,drafts,overlay]);
  for(const team of overlay.products){
    const q3=current.find(p=>p.name===team.name&&p.unit===team.unit&&p.type===team.type);
    if(team.crosssellRecommendations?.length){
      assert.deepEqual(q3.metric_recommendations,team.crosssellRecommendations);
      assert.ok(q3.metric_recommendations.every(r=>r.skill_key==='cross_sell'));
      assert.deepEqual(q3.metrics.find(b=>b.code==='mehaniki').tools,[team.crosssellTool]);
    }else if(!team.matched){assert.equal(q3.metric_recommendations,undefined);assert.ok(!q3.metrics.some(b=>b.tools?.some(t=>t.ai_tool_key==='cross_sell')));}
  }
  const deposit=overlay.products.find(p=>p.name==='Вклады+НС');
  const rec=deposit.crosssellRecommendations[0];
  const source=deposit.metrics[code].source;const marker=api.markers_response.markers.find(m=>m.uid===source.catalogUid);
  assert.deepEqual(rec.crosssell_top_actions,marker.cross_sell.top_actions.map(a=>a.text));
  assert.equal(rec.crosssell_uid,'вклады');assert.equal(rec.dd_crosssell_value,.5);
  assert.equal(source.evidence.length,7);assert.ok(rec.api_seen_out_n>1,'Broad API observation count is separate from strict scoring evidence');
  assert.ok(rec.crosssell_top_actions.length>0);assert.ok(deposit.crosssellTool.button.link.includes('#product='));
  assert.equal(metrics(current.find(p=>p.name==='Вклады+НС')).find(m=>m.code===code).value,.5);
  assert.equal(JSON.stringify(actual),original);
});
