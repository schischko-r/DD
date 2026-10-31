import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const source = read('../../public/report-data.json').products;
const app = fs.readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k => read(`../data/${imports.get(k.trim())}`));
const salary = read('../data/salary-products-q3-2026.json');
const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
const actions = read('../data/funnel-action-missing-q3-2026.json');
const build = (period, batches) => buildDdiPeriodProducts(source, period, batches, salary, reporting, actions);

const code = 'mehaniki.gibkoe_izmenenie_usloviy_produkta';

test('corporate insurance flexible conditions are hidden and excluded only in Q3', () => {
  const filename = 'corporate-flexible-conditions-applicability-q3-2026.json';
  const assessment = read(`../data/${filename}`);
  const before = build('III кв. 2026', overlays.filter(o => o !== overlays.find(x => x.products?.[0]?.metrics?.[code]?.source?.origin === 'userConfirmedCorporateFlexibleConditionsNotApplicable')));
  const after = build('III кв. 2026', overlays);
  const team = assessment.products[0];
  for (const p of after) {
    const old = before.find(t => t.id === p.id);
    if (p.name !== team.name) { assert.deepEqual(p, old); continue; }
    const metrics = p.metrics.flatMap(b => b.metrics);
    const previousMetrics = old.metrics.flatMap(b => b.metrics);
    const m = metrics.find(m => m.code === code);
    const previous = previousMetrics.find(m => m.code === code);
    assert.equal(m.value, null);
    assert.equal(m.max_value, 0);
    assert.equal(m.is_applicabble_flg, false);
    assert.equal(m.excluded_from_index, true);
    assert.equal(m.hidden_from_profile, true);
    assert.equal(p.indexMaxPoints, old.indexMaxPoints - previous.max_value);
    assert.deepEqual(metrics.filter(x => x.code !== code), previousMetrics.filter(x => x.code !== code));
    assert.ok(m.recommendation_items.every(item => item.gap === 0 && item.max_value === 0));
  }
  assert.deepEqual(build('II кв. 2026', overlays), source);
  const catalog = fs.readFileSync(new URL('../features/catalog/Catalog.jsx', import.meta.url), 'utf8');
  assert.match(catalog, /export function isVisibleMetric\(metric\) \{\s*if \(metric.hidden_from_profile === true\) return false;/);
});
