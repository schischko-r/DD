import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {compareRows} from './comparison-model.js';
const root = new URL('../../../', import.meta.url);
const path = 'outputs/ddi-funnel-q3-2026-11-03/';
const read = file => readFileSync(new URL(file, root), 'utf8');
const json = file => JSON.parse(read(file));
const current = json(path+'report-data.json'), detail = json(path+'detail-data.json');
const baseline = json(path+'baseline-report-data.json'), oldDetail = json(path+'baseline-detail-data.json');
const comparison = json(path+'comparison-data.json'), snapshot = json(path+'current-snapshot.json');
const key = r => String(r.sourceTeamId || r.id).replace(/::empty::.*/, '');
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);
const mean = values => values.reduce((a,b)=>a+b,0)/values.length;
const median = values => {const a=[...values].sort((a,b)=>a-b); return (a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2;};

test('baseline copies remain byte identical, source hash and 76 unique Q3 teams reconcile', () => {
  for (const name of ['report-data.json','detail-data.json']) assert.equal(read(path+'baseline-'+name),read('gravity-app/src/funnel-report/'+name));
  assert.equal(current.totalTeams,76); assert.equal(snapshot.products.length,76);
  assert.equal(new Set(snapshot.products.map(key)).size,76);
  assert.ok(snapshot.products.every(p=>p.period==='III кв. 2026'));
  assert.equal(current.sha256,createHash('sha256').update(read(path+'current-snapshot.json')).digest('hex'));
});

test('all six Q3 slices independently reconcile against literal snapshot metrics, including missing values', () => {
  for(const scope of ['total','reporting','completeness']) for(const code of ['attract','churn']) {
    const block=scope==='total'?current.blocks[code]:detail.scopes[scope].blocks[code];
    assert.equal(block.rows.length+block.excluded.length,76);
    const included=new Map(block.rows.map(r=>[key(r),r]));
    for(const product of snapshot.products) {
      const b=product.metrics.find(b=>b.code===code);
      const applicable=b && b.metrics.some(m=>m.is_applicabble_flg!==false) && b.metrics.reduce((s,m)=>s+Number(m.max_value||0),0)>0;
      const candidates=(b?.metrics||[]).filter(m=>scope==='total'||(scope==='reporting'?m.metric_subgroup==='Отчетность':m.code===`${code}.report_completeness`));
      const metrics=scope==='total'?candidates:candidates.filter(m=>m.is_applicabble_flg!==false&&Number.isFinite(m.value)&&Number.isFinite(m.max_value)&&m.max_value>0);
      const expected=applicable&&(scope==='total'||metrics.length>0);
      assert.equal(included.has(key(product)),Boolean(expected),`${scope}/${code}/${product.name}`);
      if(!expected)continue;
      const row=included.get(key(product));
      const earned=metrics.map(m=>Number(m.value||0)).reduce((a,b)=>a+b,0);
      const max=metrics.map(m=>Number(m.max_value||0)).reduce((a,b)=>a+b,0);
      near(row.earned,earned); near(row.max,max); near(row.rawPct,100*earned/max);
      assert.equal(row.pct,Math.max(0,Math.min(100,Math.round(100*earned/max))));
      const missing=candidates.filter(m=>m.is_applicabble_flg!==false&&m.max_value>0&&!Number.isFinite(m.value)).map(m=>m.code);
      assert.deepEqual(row.missingMetricCodes,missing);
    }
  }
  assert.deepEqual(current.blocks.attract.levels.map(l=>l.count),[9,46,15]);
  assert.deepEqual(current.blocks.churn.levels.map(l=>l.count),[17,38,13]);
});

test('six backend and UI comparisons agree with independent ID intersections, means, medians and growth', () => {
  for(const scope of ['total','reporting','completeness'])for(const code of ['attract','churn']) {
    const before=scope==='total'?baseline:oldDetail.scopes[scope],after=scope==='total'?current:detail.scopes[scope];
    const old=new Map(before.blocks[code].rows.map(r=>[key(r),r]));
    const pairs=after.blocks[code].rows.filter(r=>old.has(key(r))).map(r=>[old.get(key(r)),r]);
    const actual=comparison.scopes[scope].blocks[code], ui=compareRows(before,after,code);
    assert.equal(actual.counts.matched,pairs.length);assert.equal(ui.pairs.length,pairs.length);
    assert.equal(actual.counts.baselineOnly+pairs.length,before.blocks[code].rows.length);
    assert.equal(actual.counts.currentOnly+pairs.length,after.blocks[code].rows.length);
    assert.deepEqual(new Set(actual.pairs.map(p=>p.sourceTeamId)),new Set(pairs.map(([,r])=>key(r))));
    for(const p of actual.pairs){const [a,b]=pairs.find(([,r])=>key(r)===p.sourceTeamId);assert.equal(p.deltaPp,b.pct-a.pct);assert.equal(p.relativePct,a.pct===0?null:100*(b.pct-a.pct)/a.pct);}
    const a=pairs.map(([r])=>r.pct),b=pairs.map(([,r])=>r.pct);
    near(actual.meanChangePp,mean(b)-mean(a));near(ui.metrics[0].deltaPp,mean(b)-mean(a));
    near(actual.medianChangePp,median(b)-median(a));near(ui.metrics[1].deltaPp,median(b)-median(a));
    for(const [i,accept]of [v=>v<40,v=>v>=40&&v<=80,v=>v>80].entries()){
      const delta=100*(b.filter(accept).length-a.filter(accept).length)/pairs.length;
      near(actual.levelShareChanges[i].deltaPp,delta);near(ui.metrics[i+2].deltaPp,delta);
    }
  }
  assert.equal(comparison.scopes.reporting.blocks.attract.counts.currentOnly,1);
  assert.equal(comparison.scopes.total.blocks.churn.counts.baselineOnly,9);
});
