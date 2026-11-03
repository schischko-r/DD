import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyFrozenCrossSellScores} from './frozenCrossSellScores.js';
import {buildDdiPeriodProducts} from './quarterProfiles.js';

const profile = (name, value, cohortValue = value) => ({
  id: name, name, unit: 'DB', type: 'Продукт', indexMaxPoints: 1,
  metrics: [{code: 'mehaniki', metrics: [{code: 'mehaniki.cross_sell', value, max_value: 1,
    is_applicabble_flg: true, excluded_from_index: false, dd_calculation_flg: 1, source: {origin: 'api'}}]}],
  ...(cohortValue === undefined ? {} : {salaryCohorts: {b2b: {
    id: `${name}-b2b`, name, unit: 'DB', type: 'Продукт', indexMaxPoints: 1,
    metrics: [{code: 'mehaniki', metrics: [{code: 'mehaniki.cross_sell', value: cohortValue, max_value: 1,
      is_applicabble_flg: true, excluded_from_index: false, dd_calculation_flg: 1, source: {origin: 'api'}}]}],
  }}}),
});

const metric = (product) => product.metrics.flatMap((block) => block.metrics).find((item) => item.code === 'mehaniki.cross_sell');

test('Q3 frozen scores override refreshed values and preserve frozen salary cohorts', () => {
  const current = profile('A', 0);
  const snapshot = {period: 'III кв. 2026', products: [{name: 'A', unit: 'DB', type: 'Продукт', present: true,
    metric: {value: .5, max_value: 1, is_applicabble_flg: true, excluded_from_index: false,
      dd_calculation_flg: 1, source: {origin: 'frozen'}},
    salaryCohorts: {b2b: {value: 1, max_value: 1, is_applicabble_flg: true, excluded_from_index: false,
      dd_calculation_flg: 1, source: {origin: 'frozen-cohort'}}}}]};
  const result = applyFrozenCrossSellScores([current], 'III кв. 2026', snapshot)[0];
  assert.equal(metric(result).value, .5);
  assert.equal(metric(result).source.origin, 'frozen');
  assert.equal(metric(result.salaryCohorts.b2b).value, 1);
  assert.equal(metric(result.salaryCohorts.b2b).source.origin, 'frozen-cohort');
  assert.equal(metric(current).value, 0);
});

test('Q3 frozen absence removes a newly returned API score; other periods are untouched', () => {
  const current = profile('A', 1, 1);
  const snapshot = {period: 'III кв. 2026', products: [{name: 'A', unit: 'DB', type: 'Продукт', present: false, metric: null}]};
  const q3 = applyFrozenCrossSellScores([current], 'III кв. 2026', snapshot)[0];
  assert.equal(metric(q3), undefined);
  assert.equal(q3.indexMaxPoints, 0);
  assert.equal(metric(q3.salaryCohorts.b2b), undefined);
  assert.equal(q3.salaryCohorts.b2b.indexMaxPoints, 0);
  assert.equal(metric(applyFrozenCrossSellScores([current], 'II кв. 2026', snapshot)[0]).value, 1);
});

test('a frozen Q3 score is restored if a refreshed source no longer supplies the metric', () => {
  const current = profile('A', 0, undefined);
  current.metrics[0].metrics = [];
  const snapshot = {period: 'III кв. 2026', products: [{name: 'A', unit: 'DB', type: 'Продукт', present: true,
    metric: {code: 'mehaniki.cross_sell', value: .5, max_value: 1, is_applicabble_flg: true,
      excluded_from_index: false, dd_calculation_flg: 1, source: {origin: 'frozen'}}}]};
  const result = applyFrozenCrossSellScores([current], 'III кв. 2026', snapshot)[0];
  assert.equal(metric(result).value, .5);
});

test('application pipeline keeps the frozen score snapshot independent of refreshed API scores', () => {
  const root = new URL('../../../', import.meta.url);
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import\s+(\w+)\s+from\s+'\.\.\/data\/([^']+\.json)'/g)]
    .map((match) => [match[1], match[2]]));
  const overlayNames = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)?.[1].split(',').map((name) => name.trim());
  assert.ok(overlayNames?.includes('crosssellFinalScoresQ32026'));
  const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
  const overlays = overlayNames.map((name) => readJson(new URL(`../data/${imports.get(name)}`, import.meta.url)));
  const snapshot = overlays.find((overlay) => overlay.scope === 'frozen-q3-crosssell-scores');
  const source = readJson(new URL('gravity-app/public/report-data.json', root));
  const salary = readJson(new URL('../data/salary-products-q3-2026.json', import.meta.url));
  const regularity = readJson(new URL('../data/reporting-regularity-missing-q3-2026.json', import.meta.url));
  const actions = readJson(new URL('../data/funnel-action-missing-q3-2026.json', import.meta.url));
  const baseline = buildDdiPeriodProducts(source.products, snapshot.period, overlays, salary, regularity, actions);
  const apiChanged = structuredClone(overlays);
  const api = apiChanged.find((overlay) => overlay.source?.file === 'crosssell_export.json');
  for (const team of api.products) {
    const fact = team.metrics?.['mehaniki.cross_sell'];
    if (fact) fact.rawValue = fact.rawValue === 0 ? 1 : 0;
  }
  const refreshed = buildDdiPeriodProducts(source.products, snapshot.period, apiChanged, salary, regularity, actions);
  const scoreMap = (products) => new Map(products.map((product) => {
    const score = metric(product);
    return [`${product.name}\u0000${product.unit}\u0000${product.type}`, score?.value ?? null];
  }));
  assert.deepEqual(scoreMap(refreshed), scoreMap(baseline));
  for (const row of snapshot.products) {
    const product = baseline.find((item) => item.name === row.name && item.unit === row.unit && item.type === row.type);
    assert.ok(product, `missing profile ${row.name}`);
    assert.equal(Boolean(metric(product)), row.present, `${row.name}: frozen presence`);
    if (row.present) assert.equal(metric(product).value, row.metric.value, `${row.name}: frozen score`);
  }
});
