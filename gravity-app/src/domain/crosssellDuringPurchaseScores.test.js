import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
import {buildDdiPeriodProducts} from './quarterProfiles.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const report = read('../../public/report-data.json');
const during = read('../data/crosssell-during-purchase-scores-q3-2026.json');
const crosssellApi = read('../data/crosssell-metrics-q3-2026.json');
const after = read('../data/crosssell-after-purchase-scores-q3-2026.json');
const pc = read('../data/pc-final-scores-q3-2026.json');
const salary = read('../data/salary-products-q3-2026.json');
const included = during.products.filter((team) => team.name !== 'Почта, Диск, Календарь');
const score = (profile) => profile.metrics.flatMap((block) => block.metrics)
  .find((metric) => metric.code === 'mehaniki.cross_sell');

test('user-confirmed full during-purchase Cross-sell scores apply to the listed Q3 teams', () => {
  assert.equal(included.length, 56);
  const input = JSON.stringify(report.products);
  const q3 = buildTeamProfileProducts(report.products, during.period, [crosssellApi, after, during]);
  for (const team of during.products) {
    const product = q3.find((item) => String(item.id).replace(/::empty::.*$/, '') === team.id && item.name === team.name
      && item.unit === team.unit && item.type === team.type);
    const metric = score(product);
    assert.ok(metric, `Missing Cross-sell for ${team.name}`);
    assert.equal(metric.crossSellComponents?.during?.value ?? metric.value,
      team.metrics['mehaniki.cross_sell'].rawValue * (metric.max_value / 2));
    assert.equal(metric.is_applicabble_flg, true);
    assert.equal(metric.value, team.metrics['mehaniki.cross_sell'].rawValue === 1
      ? Math.min(metric.max_value, metric.max_value / 2 + (metric.crossSellComponents?.after?.value || 0))
      : 0);
    assert.equal(metric.source.origin === 'crossSellComponentSum' ? metric.crossSellComponents.during.source.origin
      : metric.source.origin, 'userConfirmedCrossSellDuringPurchase');
  }
  assert.equal(score(q3.find((item) => item.name === 'Почта, Диск, Календарь')).value, 0);
  assert.equal(buildTeamProfileProducts(report.products, 'II кв. 2026', during).length,
    report.products.filter((product) => product.period === 'II кв. 2026').length);
  assert.equal(JSON.stringify(report.products), input);
});

test('manual during-purchase overrides preserve the corresponding LossHunter snapshot for audit', () => {
  const hasLossHunterZero = included.filter((team) => team.metrics['mehaniki.cross_sell'].source.lossHunterSnapshot?.rawValue === 0);
  assert.ok(hasLossHunterZero.length > 0);
  assert.ok(hasLossHunterZero.every((team) => team.metrics['mehaniki.cross_sell'].rawValue === 1));
  assert.equal(during.products.find((team) => team.name === 'Почта, Диск, Календарь').metrics['mehaniki.cross_sell'].rawValue, 0);
});

test('during-purchase scores survive salary merging and final PC scores in the app pipeline', () => {
  const overlays = [crosssellApi, after, during, pc];
  const baseline = buildDdiPeriodProducts(report.products, during.period, [crosssellApi, after, pc], salary);
  const final = buildDdiPeriodProducts(report.products, during.period, overlays, salary);
  const salaryTeams = final.filter((team) => team.name === 'Зарплатный продукт' && team.salaryCohorts);
  assert.equal(salaryTeams.length, 1);
  const selected = [...salaryTeams, final.find((team) => team.name === 'Выписки, справки')];
  for (const team of selected) {
    const metric = score(team);
    const previousMetric = score(baseline.find((item) => item.id === team.id));
    assert.equal(metric.crossSellComponents.during.value, metric.max_value / 2);
    assert.equal(metric.crossSellComponents.during.source.origin, 'userConfirmedCrossSellDuringPurchase');
    assert.deepEqual(metric.crossSellComponents.after, previousMetric.crossSellComponents.after);
    assert.equal(metric.value, Math.min(metric.max_value, metric.crossSellComponents.during.value
      + (metric.crossSellComponents.after.applicable === false ? 0 : metric.crossSellComponents.after.value)));
    assert.deepEqual(team.metrics.flatMap((block) => block.metrics).filter((item) => item.code !== 'mehaniki.cross_sell'),
      baseline.find((item) => item.id === team.id).metrics.flatMap((block) => block.metrics)
        .filter((item) => item.code !== 'mehaniki.cross_sell'));
  }
  for (const cohort of Object.values(salaryTeams[0].salaryCohorts)) {
    const metric = score(cohort);
    assert.equal(metric.crossSellComponents.during.value, metric.max_value / 2);
    assert.equal(metric.crossSellComponents.during.source.origin, 'userConfirmedCrossSellDuringPurchase');
  }
});
