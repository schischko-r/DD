import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts, metricActualGrowth} from './teamProfileSelection.js';
import {applyMetricApplicabilityAssessments} from './metricApplicability.js';
import {isDdIndexMetric} from './report.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = read('../../public/report-data.json').products;
const manual = read('../data/metric-applicability-q3-2026.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').filter((key) => !['ab-tests-insurance-visibility-q3-2026.json', 'corporate-flexible-conditions-applicability-q3-2026.json', 'goals-tribe-assessments-q3-2026.json', 'goals-tribe-applicability-q3-2026.json'].includes(imports.get(key.trim()))).map((key) => read(`../data/${imports.get(key.trim())}`));
const metrics = (p) => p.metrics.flatMap((b) => b.metrics);

test('only explicitly assessed teams lose their requested Q3 criteria and denominator weights; Q2 is unchanged', () => {
  const snapshot = JSON.stringify({source, overlays});
  const before = buildTeamProfileProducts(source, manual.period, overlays.filter((o) => o.scope !== manual.scope));
  const after = buildTeamProfileProducts(source, manual.period, overlays);
  assert.deepEqual(manual.products.map(p=>p.name).sort(),['Залоговое страхование (корпоративное страхование)','КАСКО','ОСАГО','Личная защита Плюс','ЦФА',
    'Много денег (НКПЗН)','Сделка вторичка','Сделка ИЖС','Сделка с Первичным жильём','Оплата улыбкой','Трансграничные переводы'].sort());
  for (let i = 0; i < after.length; i++) {
    const current = after[i], prior = before[i];
    const team=manual.products.find(p=>p.name===current.name);
    if (!team) {assert.deepEqual(current, prior); continue;}
    const removed=metrics(prior).filter(m=>team.metrics[m.code]).reduce((sum,m)=>sum+Number(m.max_value),0);
    const expectedRemoved=current.name==='Залоговое страхование (корпоративное страхование)'?3
      : ['Много денег (НКПЗН)','Сделка вторичка','Сделка ИЖС'].includes(current.name)?2
        : current.name==='Сделка с Первичным жильём'?1:1;
    assert.equal(removed,expectedRemoved);
    assert.equal(current.indexMaxPoints, prior.indexMaxPoints - removed);
    for (const m of metrics(current)) {
      if (!team.metrics[m.code]) {assert.deepEqual(m, metrics(prior).find((p) => p.code === m.code)); continue;}
      assert.equal(m.value, null);
      assert.equal(m.max_value, 0);
      assert.equal(m.is_applicabble_flg, false);
      assert.equal(isDdIndexMetric(m), false);
      assert.equal(m.previousValue, undefined);
      assert.equal(metricActualGrowth(m, current.indexMaxPoints, manual.period), null);
    }
    if(current.name==='Залоговое страхование (корпоративное страхование)'){
      const block=current.metrics.find(b=>b.code==='mehaniki');
      assert.equal(block.metrics.filter(isDdIndexMetric).reduce((sum,m)=>sum+m.max_value,0),3.25);
    }
  }
  assert.deepEqual(buildTeamProfileProducts(source, 'II кв. 2026', overlays), source);
  assert.equal(JSON.stringify({source, overlays}), snapshot);
});

test('applicability assessments require exact identity, Q3 and allowed metric codes', () => {
  const team = source.find((p) => p.name === manual.products[0].name);
  const record = structuredClone(manual);
  record.products[0].metrics['attract.benchmarks'] = {applicable: false};
  const result = applyMetricApplicabilityAssessments([team], manual.period, [record])[0];
  assert.deepEqual(metrics(result).find((m) => m.code === 'attract.benchmarks'), metrics(team).find((m) => m.code === 'attract.benchmarks'));
  record.products[0].unit = 'wrong unit';
  assert.deepEqual(applyMetricApplicabilityAssessments([team], manual.period, [record]), [team]);
  assert.deepEqual(applyMetricApplicabilityAssessments([team], 'II кв. 2026', [manual]), [team]);
});

test('Q3 insurance extra initiatives become visible non-applicable criteria only for exact assessed teams and scope',()=>{
  const code='hyp.extra_initiatives';
  const teams=source.filter(p=>['КАСКО','ОСАГО'].includes(p.name));assert.equal(teams.length,2);
  const current=teams.map(p=>({...p,indexMaxPoints:metrics(p).filter(isDdIndexMetric).reduce((sum,m)=>sum+Number(m.max_value),0)}));
  const record={period:'III кв. 2026',scope:'metric-applicability-assessment',products:teams.map(p=>({id:p.id,name:p.name,unit:p.unit,type:p.type,metrics:{[code]:{applicable:false,source:{confirmedBy:'user'}}}}))};
  const snapshot=JSON.stringify({current,record});
  const after=applyMetricApplicabilityAssessments(current,'III кв. 2026',[record]);
  for(let i=0;i<teams.length;i++){
    const before=metrics(current[i]).find(m=>m.code===code),m=metrics(after[i]).find(m=>m.code===code);
    assert.equal(m.value,null);assert.equal(m.max_value,0);assert.equal(m.is_applicabble_flg,false);assert.equal(m.excluded_from_index,true);
    assert.notEqual(m.hidden_from_profile,true);assert.equal(after[i].indexMaxPoints,current[i].indexMaxPoints-before.max_value);
    assert.ok((m.recommendation_items||[]).every(r=>r.value===null&&r.max_value===0&&r.gap===0));
    assert.deepEqual(metrics(after[i]).filter(m=>m.code!==code),metrics(current[i]).filter(m=>m.code!==code));
  }
  assert.deepEqual(applyMetricApplicabilityAssessments(current,'II кв. 2026',[record]),current);
  assert.deepEqual(applyMetricApplicabilityAssessments(current,'III кв. 2026',[{...record,scope:'user-metric-assessment'}]),current);
  for(const key of ['id','name','unit','type']){const bad=structuredClone(record);bad.products[0][key]='other';assert.deepEqual(applyMetricApplicabilityAssessments([current[0]],'III кв. 2026',[bad]),[current[0]]);}
  const notFalse=structuredClone(record);notFalse.products.forEach(p=>p.metrics[code].applicable=true);
  assert.deepEqual(applyMetricApplicabilityAssessments(current,'III кв. 2026',[notFalse]),current);
  assert.equal(JSON.stringify({current,record}),snapshot);
});
