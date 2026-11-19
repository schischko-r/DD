import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {buildDdiPeriodProducts} from '../domain/quarterProfiles.js';

const root=new URL('../../../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const generated=read('gravity-app/src/funnel-report/current-data.json');
const baseline=read('gravity-app/src/funnel-report/report-data.json');
const baselineDetail=read('gravity-app/src/funnel-report/detail-data.json');
const baselineProducts=read('tests/fixtures/ddi/ddi-funnel-analysis-2026-10-20/standalone-data.json').products;
const app=readFileSync(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(match=>[match[1],match[2]]));
const overlayNames=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(name=>name.trim());
const overlays=overlayNames.map(name=>{assert.ok(imports.has(name),`Unresolved overlay ${name}`);return read(`gravity-app/src/data/${imports.get(name)}`);});
const configs=['salaryProductsQ32026','reportingMissingQ32026','funnelActionMissingQ32026'].map(name=>read(`gravity-app/src/data/${imports.get(name)}`));
const currentProducts=buildDdiPeriodProducts(read('gravity-app/public/report-data.json').products,'III кв. 2026',overlays,...configs,read('gravity-app/public/backlog-data.json'));
const classify=score=>score<40?'Плохо':score>80?'Хорошо':'Посередине';
const metricValid=metric=>metric.is_applicabble_flg!==false&&Number.isFinite(metric.value)&&Number.isFinite(metric.max_value)&&metric.max_value>0;
const identity=row=>String(row.sourceTeamId||row.id).replace(/::empty::.*/, '');
const sortedScores=rows=>rows.map(row=>[identity(row),row.pct]).sort(([a],[b])=>a.localeCompare(b));
const scopes=['total','completeness','reporting','analysis','actions','benchmarks','campaigning'];
const codesFor=scope=>scope==='campaigning'?['attract']:['attract','churn'];
const singleMetrics={
  analysis:{attract:'attract.funnel_analysis',churn:'churn.funnel_analysis'},
  actions:{attract:'attract.initiatives_list',churn:'churn.deviation_actions'},
  benchmarks:{attract:'attract.benchmarks',churn:'churn.benchmarks'},
};

function independentlyScoredProducts(code,scope,products=currentProducts){
  return products.flatMap(product=>{
    const block=product.metrics.find(item=>item.code===code);
    if(!block||!block.metrics.some(metric=>metric.is_applicabble_flg!==false))return [];
    if(block.metrics.reduce((sum,metric)=>sum+Number(metric.max_value||0),0)<=0)return [];
    const subgroup=scope==='reporting'?'Отчетность':scope==='campaigning'?'Кампейнинг':null;
    const metrics=scope==='total'?block.metrics:block.metrics.filter(metric=>metricValid(metric)&&(subgroup?metric.metric_subgroup===subgroup:metric.code===(singleMetrics[scope]?.[code]||`${code}.report_completeness`)));
    if(!metrics.length)return [];
    const earned=metrics.reduce((sum,metric)=>sum+Number(metric.value||0),0),maximum=metrics.reduce((sum,metric)=>sum+Number(metric.max_value||0),0);
    return [{id:product.id,sourceTeamId:product.sourceTeamId,pct:Math.max(0,Math.min(100,Math.round(100*earned/maximum)))}];
  });
}

test('comparison keeps original II-quarter cohorts and scores unchanged',()=>{
  assert.deepEqual(generated.thresholds,{poorBelow:40,goodAbove:80});
  assert.equal(generated.periods.baseline,'II кв. 2026');assert.equal(generated.periods.current,'III кв. 2026');
  for(const scope of scopes)for(const code of codesFor(scope)){
    const expected=scope==='total'?baseline.blocks[code].rows:singleMetrics[scope]||scope==='campaigning'?independentlyScoredProducts(code,scope,baselineProducts):baselineDetail.scopes[scope].blocks[code].rows;
    const actual=generated.scopes[scope].blocks[code].baseline;
    assert.deepEqual(sortedScores(actual.rows),sortedScores(expected),`${scope}/${code} baseline`);assert.equal(actual.n,expected.length);
  }
});

test('III-quarter comparisons contain every applicable team after all current application corrections',()=>{
  assert.ok(overlayNames.length>=110,'All currently connected assessment overlays must be loaded');
  for(const scope of scopes)for(const code of codesFor(scope)){
    const expected=independentlyScoredProducts(code,scope),actual=generated.scopes[scope].blocks[code].current;
    assert.deepEqual(sortedScores(actual.rows),sortedScores(expected),`${scope}/${code} current`);
    assert.equal(new Set(actual.rows.map(identity)).size,actual.rows.length,'No duplicate teams');assert.equal(actual.n,expected.length);
  }
});

test('levels use fixed II-quarter boundaries and each period uses its own valid denominator',()=>{
  for(const scope of scopes)for(const code of codesFor(scope))for(const period of ['baseline','current']){
    const summary=generated.scopes[scope].blocks[code][period];
    assert.equal(summary.n,summary.rows.length);assert.deepEqual(summary.levels.map(level=>level.label),['Плохо','Посередине','Хорошо']);
    for(const level of summary.levels){
      const count=summary.rows.filter(row=>classify(row.pct)===level.label).length;
      assert.equal(level.count,count,`${scope}/${code}/${period}/${level.label}`);assert.ok(Math.abs(level.share-(summary.n?100*count/summary.n:0))<1e-10);
    }
    assert.equal(summary.levels.reduce((sum,level)=>sum+level.count,0),summary.n);
    for(const edge of [40,80])for(const row of summary.rows.filter(row=>row.pct===edge))assert.equal(classify(row.pct),'Посередине');
  }
});

test('campaigning aggregates only valid campaign subgroup metrics and exists only for attraction',()=>{
  assert.deepEqual(Object.keys(generated.scopes.campaigning.blocks),['attract']);
  for(const [period,products] of [['baseline',baselineProducts],['current',currentProducts]]){
    const summary=generated.scopes.campaigning.blocks.attract[period];
    const actualById=new Map(summary.rows.map(row=>[identity(row),row]));
    for(const product of products){
      const block=product.metrics.find(item=>item.code==='attract');
      const applicableBlock=block&&block.metrics.some(item=>item.is_applicabble_flg!==false)&&block.metrics.reduce((sum,item)=>sum+Number(item.max_value||0),0)>0;
      const metrics=(block?.metrics||[]).filter(metric=>metric.metric_subgroup==='Кампейнинг'&&metricValid(metric));
      const included=Boolean(applicableBlock&&metrics.length);
      assert.equal(actualById.has(identity(product)),included,`${period}/${product.name} campaign applicability`);
      if(!included)continue;
      const row=actualById.get(identity(product));
      const earned=metrics.reduce((sum,metric)=>sum+metric.value,0),maximum=metrics.reduce((sum,metric)=>sum+metric.max_value,0);
      assert.equal(row.pct,Math.round(100*earned/maximum),`${period}/${product.name} campaign subgroup score`);
      assert.equal(row.earned,earned);assert.equal(row.max,maximum);
      assert.deepEqual([...row.metricCodes].sort(),metrics.map(metric=>metric.code).sort(),'Campaign score must preserve its subgroup lineage');
    }
  }
});

test('analysis, actions and benchmarks each use their exact metric and exclude unavailable or inapplicable scores',()=>{
  for(const [scope,codes] of Object.entries(singleMetrics))for(const [period,products] of [['baseline',baselineProducts],['current',currentProducts]])for(const code of ['attract','churn']){
    const actual=generated.scopes[scope].blocks[code][period],actualIds=new Set(actual.rows.map(identity));
    const universe=products.map(product=>{
      const block=product.metrics.find(item=>item.code===code);
      const metric=block?.metrics.find(item=>item.code===codes[code]);
      const applicableBlock=block&&block.metrics.some(item=>item.is_applicabble_flg!==false)&&block.metrics.reduce((sum,item)=>sum+Number(item.max_value||0),0)>0;
      return {product,metric,included:applicableBlock&&metric&&metricValid(metric)};
    });
    for(const {product,metric,included} of universe){
      assert.equal(actualIds.has(identity(product)),Boolean(included),`${scope}/${period}/${code}/${product.name} applicability`);
      if(included){
        const row=actual.rows.find(item=>identity(item)===identity(product));
        assert.equal(row.pct,Math.round(100*metric.value/metric.max_value),`Other metric scores must not alter ${scope}`);
        assert.deepEqual(row.metricCodes,[codes[code]],'Source lineage must name only the requested metric');
      }
    }
  }
});
