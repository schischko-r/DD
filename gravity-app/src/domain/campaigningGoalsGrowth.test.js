import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {blockActualGrowth, metricActualGrowth} from './teamProfileSelection.js';
import {goalsProfileLevels} from './goalsProfileLevels.js';
import {isDdIndexMetric} from './report.js';
import {beforeFinalGoalsTable} from './test-fixtures/beforeFinalGoalsTable.js';

const read = (path) => beforeFinalGoalsTable(JSON.parse(readFileSync(new URL(path, import.meta.url))));
const source = read('../../public/report-data.json').products;
// Follow the effective App order so a later overlay cannot silently erase the baseline.
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)]
  .map((match) => [match[1], match[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
  .map((key) => read(`../data/${imports.get(key.trim())}`));
const args = ['salary-products', 'reporting-regularity-missing', 'funnel-action-missing']
  .map((name) => read(`../data/${name}-q3-2026.json`));
const period = 'III кв. 2026';
const isCampaigning = (product) => product.name === 'Персональная рекомендация' && product.unit === 'Data';
const goals = (product) => product.metrics.find((block) => block.code === 'goals');
const metric = (block, code) => block.metrics.find((item) => item.code === code);

test('Campaigning final goals gain exactly 0.5 points / 2.5 pp from raw Q2 with every App overlay', () => {
  const snapshot = JSON.stringify({source, overlays, args});
  const product = buildDdiPeriodProducts(source, period, overlays, ...args).find(isCampaigning);
  const baseline = source.find(isCampaigning);
  const block = goals(product);
  const rawFa = metric(goals(baseline), 'goals.factor_analysis_l1_l2');
  const finalFa = metric(block, 'goals.po_factor_analysis');
  assert.equal(rawFa.value, 0);
  assert.equal(rawFa.max_value, 1);
  assert.equal(finalFa.value, 0.5);
  assert.equal(finalFa.max_value, 1);
  assert.equal(product.indexMaxPoints, 20);
  assert.equal(finalFa.previousValue, rawFa.value);
  assert.equal(finalFa.previousMaxValue, rawFa.max_value);
  assert.equal(finalFa.previousPeriod, baseline.period);
  assert.equal(finalFa.source.level, 'final');
  assert.equal(metricActualGrowth(finalFa, 20, period).pointsDelta, 0.5);
  assert.equal(metricActualGrowth(finalFa, 20, period).indexPctDelta, 2.5);
  // The block passed to the profile header retains the same growth metadata.
  const growth = blockActualGrowth(goalsProfileLevels(block, period), 20, period);
  assert.equal(growth.pointsDelta, 0.5);
  assert.equal(growth.indexPctDelta, 2.5);
  assert.equal(growth.previousPeriod, 'II кв. 2026');

  assert.deepEqual(block.goalsFinalScores, {
    'goals.monitored': 1, 'goals.factor_analysis_l1_l2': 0.5, 'goals.forecast': null,
  });
  assert.deepEqual(block.metrics.filter((item) => !item.code.startsWith('goals.po_')).map((item) => item.value), [1, 0, null]);
  assert.deepEqual(block.goalsPoLevelMetrics.map((item) => item.value), [1, 0.6, null]);
  const informational = [...block.metrics.filter((item) => !item.code.startsWith('goals.po_')), ...block.goalsPoLevelMetrics];
  for (const item of informational) {
    assert.equal(isDdIndexMetric(item), false);
    assert.equal(metricActualGrowth(item, 20, period), null, item.code);
  }
  assert.equal(blockActualGrowth({...block, metrics: [...block.metrics, ...block.goalsPoLevelMetrics]}, 20, period).indexPctDelta, 2.5,
    'PO details and LU/LT must never double count the final uplift');
  assert.equal(metricActualGrowth(metric(block, 'goals.po_monitoring'), 20, period), null, 'unchanged monitoring has no badge');
  assert.equal(metricActualGrowth(metric(block, 'goals.po_forecast'), 20, period), null, 'NA forecast has no badge');
  assert.deepEqual(buildDdiPeriodProducts(source, baseline.period, overlays, ...args), source);
  assert.equal(JSON.stringify({source, overlays, args}), snapshot);
});

test('Campaigning never invents growth from an unknown, inapplicable or incompatible Q2 baseline', () => {
  for (const patch of [{value: null}, {is_applicabble_flg: false}, {excluded_from_index: true},
    {dd_calculation_flg: 0}, {max_value: 0}, {max_value: 2}, {value: -1}, {value: 2}]) {
    const unknown = structuredClone(source);
    Object.assign(metric(goals(unknown.find(isCampaigning)), 'goals.factor_analysis_l1_l2'), patch);
    const product = buildDdiPeriodProducts(unknown, period, overlays, ...args).find(isCampaigning);
    const block = goals(product);
    assert.equal(metric(block, 'goals.po_factor_analysis').value, 0.5, 'Q3 final assessment is preserved');
    assert.equal(metricActualGrowth(metric(block, 'goals.po_factor_analysis'), product.indexMaxPoints, period), null);
    assert.equal(blockActualGrowth(block, product.indexMaxPoints, period), null);
  }
});
