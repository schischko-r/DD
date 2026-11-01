import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {products, overlays, source, salary} from './audit-missing-scores.mjs';
import {buildDdiPeriodProducts} from '../gravity-app/src/domain/quarterProfiles.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const reporting = read('../gravity-app/src/data/reporting-regularity-missing-q3-2026.json');
const actions = read('../gravity-app/src/data/funnel-action-missing-q3-2026.json');
const before = buildDdiPeriodProducts(source.products, salary.period,
  overlays.filter((item) => item.source?.origin !== 'userConfirmedAutoAttractCorrection20261031'), salary, reporting, actions);
const flatten = (product) => product.metrics.flatMap((block) => block.metrics);
const auto = products.find((product) => product.id.startsWith('a482e4ff-'));
const deposits = products.find((product) => product.id.startsWith('7fdb5658-'));
const expected = [
  [deposits, 'attract.chernoviki_v_sbol_70', 0],
  [deposits, 'churn.report_completeness', 0],
  [auto, 'attract.regulyarnostь', 0.5],
  [auto, 'attract.funnel_analysis', 0.5],
  [auto, 'attract.nalichie_self_service', 0],
];
for (const [product, code, fraction] of expected) {
  const metric = flatten(product).find((item) => item.code === code);
  assert.equal(metric.value / metric.max_value, fraction, `${product.name}: ${code}`);
}
let changed = 0;
for (const product of products) {
  const prior = before.find((item) => item.id === product.id);
  assert.equal(product.indexMaxPoints, prior.indexMaxPoints);
  for (const metric of flatten(product)) {
    const old = flatten(prior).find((item) => item.code === metric.code);
    if (product.id === auto.id && ['attract.funnel_analysis', 'attract.nalichie_self_service'].includes(metric.code)) {
      assert.equal(old.value, old.max_value);
      assert.equal(metric.max_value, old.max_value);
      assert.equal(metric.is_applicabble_flg, old.is_applicabble_flg);
      changed++;
    } else assert.deepEqual(metric, old);
  }
}
assert.equal(changed, 2);
assert.deepEqual(buildDdiPeriodProducts(source.products, source.products[0].period, overlays, salary, reporting, actions), source.products);
console.log('Verified: all five requested percentages; exactly two effective changes; other metrics, maxima, applicability and Q2 preserved.');
