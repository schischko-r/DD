import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {isDdIndexMetric} from './report.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const assessment = read('../data/crossborder-acquiring-reporting-applicability-q3-2026.json');
const source = read('../../public/report-data.json').products;
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
const build = (period, facts) => buildDdiPeriodProducts(source, period, facts, read('../data/salary-products-q3-2026.json'),
  read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json'));

test('only cross-border acquiring Q3 hides and excludes the six reporting metrics in attraction and churn', () => {
  const before = build(assessment.period, overlays.filter(o => o.source?.origin !== assessment.source.origin));
  const after = build(assessment.period, overlays);
  const record = assessment.products[0];
  let checked = 0;
  for (let i = 0; i < after.length; i++) {
    const p = after[i], prior = before[i];
    if (p.id.replace(/::empty::.*/, '') !== record.id) {assert.deepEqual(p, prior); continue;}
    const previous = prior.metrics.flatMap(block => block.metrics);
    let removed = 0;
    for (const m of p.metrics.flatMap(block => block.metrics)) {
      const old = previous.find(entry => entry.code === m.code);
      if (!record.metrics[m.code]) {assert.deepEqual(m, old); continue;}
      checked++;
      if (isDdIndexMetric(old)) removed += old.max_value;
      assert.equal(m.value, null);
      assert.equal(m.max_value, 0);
      assert.equal(m.is_applicabble_flg, false);
      assert.equal(m.excluded_from_index, true);
      assert.equal(m.hidden_from_profile, true);
      assert.equal(isDdIndexMetric(m), false);
      assert.equal(m.previousValue, undefined);
      for (const item of m.recommendation_items || []) {
        assert.equal(item.value, null); assert.equal(item.max_value, 0); assert.equal(item.gap, 0);
      }
    }
    assert.equal(p.indexMaxPoints, prior.indexMaxPoints - removed);
    assert.ok(p.metrics.filter(b => ['attract', 'churn'].includes(b.code))
      .every(block => block.metrics.some(m => !m.hidden_from_profile && m.code.endsWith('.funnel_analysis'))));
  }
  assert.equal(checked, 6);
  assert.deepEqual(build('II кв. 2026', overlays), source);
});
