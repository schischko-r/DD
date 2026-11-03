import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const raw = read('../../public/report-data.json').products;
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(n=>read(`../data/${imports.get(n.trim())}`));
const earlier = overlays.map(o=>o.scope!=='q3-score-correction'?o:{...o,products:o.products.map(p=>({...p,
  metrics:Object.fromEntries(Object.entries(p.metrics).filter(([,f])=>f.source?.correction?.group!=='campaignAudit20261103'))}))});
const build = (period,assessments) => buildDdiPeriodProducts(raw,period,assessments,
  read('../data/salary-products-q3-2026.json'),read('../data/reporting-regularity-missing-q3-2026.json'),
  read('../data/funnel-action-missing-q3-2026.json'),read('../../public/backlog-data.json'));
const success='attract.nalichie_uspeshnyh_biznes_zapuskov',self='attract.nalichie_self_service',launch='attract.campaign_launches';
const expected=new Map([
  ...['БПИФ','Брокерский счет','ДСЖ КК','ДСЖ ПК','Зарплатный продукт','ЗПИФ'].map(n=>[`${n}|${success}`,0]),
  [`ДСЖ ПК|${self}`,0],[`Сейфы|${self}`,1],[`Сейфы|${launch}`,1],
  [`ЗПИФ|${self}`,0],[`ЗПИФ|${launch}`,0],
]);
test('eleven explicit Q3 campaign corrections override older workbook facts without changing other metrics or Q2',()=>{
  const before=build('III кв. 2026',earlier),after=build('III кв. 2026',overlays);
  let checked=0;
  for(const p of after){
    const prior=before.find(t=>t.id===p.id);assert.ok(prior);
    const {metrics,salaryCohorts,...meta}=p,{metrics:oldMetrics,salaryCohorts:oldCohorts,...oldMeta}=prior;assert.deepEqual(meta,oldMeta);
    if(salaryCohorts)for(const cohort of ['b2b','b2c']){
      const child=salaryCohorts[cohort],oldChild=oldCohorts[cohort];
      const {metrics:childMetrics,...childMeta}=child,{metrics:oldChildMetrics,...oldChildMeta}=oldChild;
      assert.deepEqual(childMeta,oldChildMeta);
      for(const m of childMetrics.flatMap(b=>b.metrics)){
        const old=oldChildMetrics.flatMap(b=>b.metrics).find(x=>x.code===m.code);
        if(m.code!==success){assert.deepEqual(m,old);continue;}
        assert.equal(m.value,0);assert.equal(m.max_value,old.max_value);
        assert.equal(m.source.correction.group,'campaignAudit20261103');
      }
    }
    for(const m of metrics.flatMap(b=>b.metrics)){
      const old=oldMetrics.flatMap(b=>b.metrics).find(x=>x.code===m.code);assert.ok(old);
      const key=`${p.name}|${m.code}`;
      if(!expected.has(key)){assert.deepEqual(m,old,`${p.name}/${m.code}`);continue;}
      checked++;
      assert.equal(m.value,expected.get(key)*old.max_value,key);
      for(const field of ['max_value','is_applicabble_flg','excluded_from_index','dd_calculation_flg'])assert.equal(m[field],old[field],`${key}/${field}`);
      if(salaryCohorts){
        assert.equal(m.source.origin,'salaryCohortAverage');
        assert.equal(m.source.cohorts.b2b.value,0);assert.equal(m.source.cohorts.b2c.value,0);
      }else{
        assert.equal(m.source.correction.group,'campaignAudit20261103');
        assert.equal(m.source.previousAssessmentValue,old.value);
      }
    }
  }
  assert.equal(checked,11);
  assert.deepEqual(build('II кв. 2026',overlays),build('II кв. 2026',earlier));
  const dszh=after.find(p=>p.name==='ДСЖ ПК').metrics.flatMap(b=>b.metrics).find(m=>m.code===launch);
  assert.equal(dszh.max_value,0);assert.equal(dszh.is_applicabble_flg,false);
});
