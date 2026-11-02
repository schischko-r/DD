import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const source = read('../../public/report-data.json').products;
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`));
const corrections = overlays.find((item) => item.scope === 'cx-user-corrections');
const profiles = buildDdiPeriodProducts(source, 'III кв. 2026', overlays,
  read('../data/salary-products-q3-2026.json'), read('../data/reporting-regularity-missing-q3-2026.json'),
  read('../data/funnel-action-missing-q3-2026.json'));
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);

test('CX Q3 user corrections apply exact metric scores and exclude non-relevant metrics', () => {
  assert.ok(corrections);
  const expectedCount = Object.values(corrections.products).reduce((sum, team) => sum + Object.keys(team.metrics).length, 0);
  assert.equal(expectedCount, 51);
  for (const team of corrections.products) {
    const product = profiles.find((item) => item.name === team.name && item.unit === 'CX' && item.type === team.type);
    assert.ok(product, team.name);
    for (const [code, fact] of Object.entries(team.metrics)) {
      const metric = metrics(product).find((item) => item.code === code);
      if (!metric && team.name === 'СберСпасибо' && code === 'churn.benchmarks') continue;
      assert.ok(metric, `${team.name}: ${code}`);
      if (fact.applicable === false) {
        assert.equal(metric.value, null, `${team.name}: ${code}`);
        assert.equal(metric.max_value, 0, `${team.name}: ${code}`);
        assert.equal(metric.is_applicabble_flg, false, `${team.name}: ${code}`);
        assert.equal(metric.source.origin, 'userConfirmedCxCorrections20261102');
      } else {
        assert.equal(metric.value / metric.max_value, fact.rawValue, `${team.name}: ${code}`);
        assert.equal(metric.source.origin, 'userConfirmedCxCorrections20261102');
      }
    }
  }
  const thanks = profiles.find((item) => item.name === 'СберСпасибо' && item.unit === 'CX');
  assert.ok(!metrics(thanks).some((metric) => metric.code === 'churn.benchmarks'), 'churn benchmarks are absent from this product rubric');
});
