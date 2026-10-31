import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {applyQuarterRetentionAssessments} from './quarterRetentionAssessment.js';
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const source = read('../../public/report-data.json').products;
const data = read('../data/campaigning-quarter-retention-q3-2026.json');
const app = fs.readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k => read(`../data/${imports.get(k.trim())}`));
const args = [read('../data/salary-products-q3-2026.json'), read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json')];
const metrics = p => p.metrics.flatMap(b => b.metrics);

test('campaigning retains exactly three full Q2 criteria at their original weights; all other facts, products and Q2 stay intact', () => {
  const before = buildDdiPeriodProducts(source, data.period, overlays.filter(o => o.source?.origin !== data.source.origin), ...args);
  const after = buildDdiPeriodProducts(source, data.period, overlays, ...args);
  const record = data.products[0];
  const q2 = source.find(p => p.id === record.id);
  let checked = 0;
  for (const p of after) {
    const old = before.find(t => t.id === p.id);
    if (p.id.split('::empty::')[0] !== record.id) {assert.deepEqual(p, old); continue;}
    assert.equal(p.indexMaxPoints, old.indexMaxPoints);
    for (const [code, fact] of Object.entries(record.metrics)) {
      const m = metrics(p).find(m => m.code === code);
      const prior = metrics(q2).find(m => m.code === code);
      assert.equal(m.value, prior.value); assert.equal(m.max_value, prior.max_value);
      assert.equal(m.value / m.max_value, 1); assert.equal(m.previousValue, prior.value);
      assert.equal(m.previousPeriod, 'II кв. 2026');
      assert.equal(m.source.policy, 'campaigningFullCriteria');
      assert.equal(m.source.sourceValue, fact.source.sourceValue);
      assert.ok(m.recommendation_items.every(item => item.gap === 0 && item.value === prior.value));
      checked++;
    }
    assert.deepEqual(metrics(p).filter(m => !record.metrics[m.code]), metrics(old).filter(m => !record.metrics[m.code]));
    assert.equal(metrics(p).find(m => m.code === 'dannye.promyshlenye_dannye').value, .5);
  }
  assert.equal(checked, 3);
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', overlays, ...args), source);
});

test('campaigning policy cannot retain unrelated criteria or cross team identities', () => {
  const old = source.find(p => p.id === data.products[0].id);
  const custom = structuredClone(data);
  custom.products[0].metrics['goals.monitored'] = {rawValue: 1, source: {
    ...Object.values(custom.products[0].metrics)[0].source, sourceValue: 1, sourceMaxValue: 1,
  }};
  const current = {...old, id: old.id+'::empty::'+data.period, period: data.period,
    metrics: old.metrics.map(b => ({...b, metrics: b.metrics.map(m => ({...m, value: null}))}))};
  const result = applyQuarterRetentionAssessments([current], data.period, [custom], [old])[0];
  assert.equal(metrics(result).find(m => m.code === 'goals.monitored').value, null);
  custom.products[0].unit = 'wrong';
  assert.deepEqual(applyQuarterRetentionAssessments([current], data.period, [custom], [old]), [current]);
});
