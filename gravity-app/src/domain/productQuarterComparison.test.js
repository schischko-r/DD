import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildProductQuarterComparison} from './productQuarterComparison.js';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeProductPercent, isDdIndexMetricForPeriod, previousQuarterIndexDelta} from './report.js';
import {metricActualGrowth} from './teamProfileSelection.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const data = read('../../public/report-data.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)]
  .map((match) => [match[1], match[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
  .map((key) => read(`../data/${imports.get(key.trim())}`));
const args = ['salary-products', 'reporting-regularity-missing', 'funnel-action-missing']
  .map((name) => read(`../data/${name}-q3-2026.json`));
const products = buildDdiPeriodProducts(data.products, 'III кв. 2026', overlays, ...args, read('../../public/backlog-data.json'));
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);
const close = (actual, expected, context = '') => assert.ok(Math.abs(actual - expected) < 1e-9, `${context}: ${actual} != ${expected}`);
const sum = (values) => values.reduce((total, value) => total + value, 0);
const earned = (block, period) => sum((block?.metrics || []).filter((item) => isDdIndexMetricForPeriod(item, period)).map((item) => item.value));
const maximum = (product) => sum(metrics(product).filter((item) => isDdIndexMetricForPeriod(item, product.period)).map((item) => item.max_value));

test('all 76 effective App teams reconcile every union block plus explicit rounding to their published Q2 card delta', () => {
  const snapshot = JSON.stringify({data, products});
  assert.equal(products.length, 76);
  assert.equal(new Set(products.map((product) => product.unit)).size, 8);
  let denominatorChanges = 0;
  for (const product of products) {
    const identity = `${product.unit}/${product.name}`;
    const prior = data.products.find((item) => item.id === product.id.replace(/::empty::.*/, '')
      && ['name', 'unit', 'type'].every((key) => item[key] === product[key]));
    const comparison = buildProductQuarterComparison(product, data.products, data.title.rows);
    assert.ok(comparison, identity);
    const card = previousQuarterIndexDelta(product, completeProductPercent(product), data.products, data.title.rows);
    assert.equal(comparison.indexPctDelta, card.value, identity);
    assert.equal(comparison.currentScore, completeProductPercent(product));
    assert.equal(comparison.previousScore, card.previousScore);
    assert.equal(comparison.currentPeriod, product.period);
    assert.equal(comparison.previousPeriod, prior.period);
    close(comparison.currentTotalMaxPoints, maximum(product), identity);
    close(comparison.previousTotalMaxPoints, maximum(prior), identity);
    if (Math.abs(maximum(product) - maximum(prior)) > 1e-9) denominatorChanges++;
    const codes = new Set([...product.metrics, ...prior.metrics].map((block) => block.code));
    assert.equal(comparison.blocks.length, codes.size, identity);
    assert.deepEqual(new Set(comparison.blocks.map((block) => block.code)), codes);
    for (const block of comparison.blocks) {
      const currentBlock = product.metrics.find((item) => item.code === block.code);
      const previousBlock = prior.metrics.find((item) => item.code === block.code);
      const currentPoints = earned(currentBlock, product.period);
      const previousPoints = earned(previousBlock, prior.period);
      close(block.currentPoints, currentPoints, `${identity}/${block.code} current`);
      close(block.previousPoints, previousPoints, `${identity}/${block.code} previous`);
      close(block.currentContributionPct, currentPoints / maximum(product) * 100);
      close(block.previousContributionPct, previousPoints / maximum(prior) * 100);
      close(block.rawIndexPctDelta, currentPoints / maximum(product) * 100 - previousPoints / maximum(prior) * 100);
      close(block.indexPctDelta * 10, Math.round(block.indexPctDelta * 10), 'displayed tenths');
      close(block.scoreChangeIndexPctDelta + block.applicabilityIndexPctDelta, block.rawIndexPctDelta,
        `${identity}/${block.code} score and rubric decomposition`);
    }
    close(comparison.blockIndexPctDelta, sum(comparison.blocks.map((block) => block.indexPctDelta)), identity);
    close(comparison.blockIndexPctDelta + comparison.roundingAdjustment, card.value, identity);
    close(sum(comparison.blocks.map((block) => block.rawIndexPctDelta)), comparison.rawIndexPctDelta, identity);
    close(comparison.rawIndexPctDelta, earned({metrics: metrics(product)}, product.period) / maximum(product) * 100
      - earned({metrics: metrics(prior)}, prior.period) / maximum(prior) * 100, identity);
  }
  assert.equal(denominatorChanges, 44);
  assert.equal(JSON.stringify({data, products}), snapshot, 'comparison never changes scores, rubric, assessments or source');
});

test('deposits Navigator is 100 percent after final corrections without changing its maximum or Q2', () => {
  const product = products.find(item => item.name === 'Вклады+НС' && item.unit === 'CBP');
  const target = metrics(product).find(metric => metric.code === 'general.navigator_reporting_knowledge');
  assert.equal(target.value, 0.5);
  assert.equal(target.max_value, 0.5);
  assert.equal(target.source.confirmedBy, 'user');
  assert.equal(target.source.userAssessment, '100%');
  const prior = data.products.find(item => item.name === product.name && item.unit === product.unit);
  assert.equal(metrics(prior).find(metric => metric.code === target.code).value, 0.25);
});

test('Campaigning final factor analysis is restored to zero against the Excel Q2 baseline; unchanged alerts have no uplift', () => {
  const product = products.find((item) => item.name === 'Персональная рекомендация' && item.unit === 'Data');
  const comparison = buildProductQuarterComparison(product, data.products, data.title.rows);
  assert.equal(comparison.previousScore, 67);
  const industrial = metrics(product).find(metric => metric.code === 'dannye.promyshlenye_dannye');
  assert.equal(industrial.value, 0.375);
  assert.equal(industrial.max_value, 0.5);
  assert.equal(industrial.source.confirmedBy, 'user');
  const analysis = metrics(product).find(metric => metric.code === 'analiz_effektivnostь.provedenie_kompleksnogo_analiza_po_metrikam');
  assert.equal(analysis.value, analysis.max_value);
  assert.equal(analysis.max_value, 0.75);
  assert.equal(analysis.source.confirmedBy, 'user');
  const reporting = metrics(product).find(metric => metric.code === 'analiz_effektivnostь.nastroena_otchetnostь');
  assert.equal(reporting.value, 4);
  assert.equal(reporting.max_value, 4);
  const regularity = metrics(product).find(metric => metric.code === 'analiz_effektivnostь.regulyarnostь');
  assert.equal(regularity.value, 1);
  assert.equal(regularity.max_value, 1);
  assert.equal(isDdIndexMetricForPeriod(regularity, product.period), false);
  assert.equal(comparison.currentScore, 79);
  assert.equal(comparison.indexPctDelta, 12);
  close(comparison.rawIndexPctDelta, 2.375 / 19.5 * 100);
  close(comparison.blocks.find((block) => block.code === 'goals').rawIndexPctDelta, 0);
  assert.equal(comparison.blocks.find((block) => block.code === 'goals').indexPctDelta, 0);
  assert.equal(comparison.metricGrowthByCode['goals.po_factor_analysis'], undefined);
  assert.equal(comparison.blocks.find(block => block.code === 'alerts').indexPctDelta, 0);
  for (const code of ['alerts.nastroena_matrica_otkloneniy', 'alerts.nastroeny_avtoalerty_po_otkloneniyam']) {
    assert.equal(metrics(product).find(metric => metric.code === code).value, 0.5);
    assert.equal(comparison.metricGrowthByCode[code], undefined);
  }
  assert.equal(comparison.metricGrowthByCode['goals.factor_analysis_l1_l2'], undefined);
  assert.equal(comparison.metricGrowthByCode['goals.po_forecast'], undefined);
});

const metric = (code, value, max_value = 1, extra = {}) => ({code, value, max_value,
  is_applicabble_flg: true, dd_calculation_flg: 1, ...extra});
const previous = {id: 'fixture', name: 'Fixture', unit: 'Data', type: 'Канал', period: 'II кв. 2026',
  metrics: [{code: 'kept', metrics: [metric('kept', 1)]}, {code: 'removed', metrics: [metric('removed', 1)]}]};
const current = {...previous, id: 'fixture::empty::III кв. 2026', period: 'III кв. 2026', isPlaceholder: true,
  indexMaxPoints: 3, metrics: [{code: 'kept', metrics: [metric('kept', 1)]},
    {code: 'added', metrics: [metric('added', 0, 2), metric('detail', 1, 1, {excluded_from_index: true})]}]};
const rows = [{name: 'Fixture', unit: 'Data', type: 'Канал', score: 100}];

test('denominator shifts, removed blocks, newly applicable zeros and NA details have explicit accounting without fabricated criterion growth', () => {
  const comparison = buildProductQuarterComparison(current, [previous], rows);
  const block = (code) => comparison.blocks.find((item) => item.code === code);
  assert.equal(comparison.currentScore, 33);
  assert.equal(comparison.indexPctDelta, -67);
  close(block('kept').rawIndexPctDelta, -100 / 6);
  assert.equal(block('kept').indexPctDelta, -16.7);
  assert.equal(block('removed').indexPctDelta, -50);
  assert.equal(block('added').indexPctDelta, 0);
  close(comparison.blockIndexPctDelta, -66.7);
  close(comparison.roundingAdjustment, -0.3);
  assert.equal(comparison.metricGrowthByCode.kept, undefined, 'unchanged criterion has no actual-score badge');
  assert.equal(comparison.metricGrowthByCode.added, undefined, 'new criterion has no invented Q2 zero');
  assert.equal(metricActualGrowth({...current.metrics[0].metrics[0], previousValue: 1,
    previousMaxValue: 1, previousPeriod: previous.period}, 3, current.period), null);
  const na = structuredClone(current);
  na.metrics[1].metrics[0] = metric('added', null, 0, {is_applicabble_flg: false});
  na.indexMaxPoints = 1;
  const excluded = buildProductQuarterComparison(na, [previous], rows);
  assert.equal(excluded.indexPctDelta, 0);
  assert.equal(excluded.currentTotalMaxPoints, 1);
  assert.equal(excluded.blocks.find((item) => item.code === 'kept').indexPctDelta, 50);
  assert.equal(excluded.blocks.find((item) => item.code === 'removed').indexPctDelta, -50);
});

test('missing, ambiguous or wrong-identity baselines and incomplete scores do not fabricate a quarter comparison', () => {
  for (const baseline of [[], [previous, previous], [{...previous, unit: 'Other'}], [{...previous, type: 'Продукт'}],
    [{...previous, period: 'I кв. 2026'}], [{...previous, id: 'different'}]]) {
    assert.equal(buildProductQuarterComparison(current, baseline, rows), null);
  }
  for (const baselineRows of [[], [...rows, ...rows], [{...rows[0], score: null}], [{...rows[0], score: 101}],
    [{...rows[0], score: 99}]]) {
    assert.equal(buildProductQuarterComparison(current, [previous], baselineRows), null);
  }
  assert.equal(buildProductQuarterComparison(previous, [previous], rows), null);
  const incomplete = structuredClone(current);
  incomplete.metrics[0].metrics[0].value = null;
  assert.equal(buildProductQuarterComparison(incomplete, [previous], rows), null);
  const incompletePrevious = structuredClone(previous);
  incompletePrevious.metrics[0].metrics[0].value = null;
  assert.equal(buildProductQuarterComparison(current, [incompletePrevious], rows), null);
  for (const max_value of [Infinity, '1']) {
    const invalidCurrent = structuredClone(current);
    invalidCurrent.metrics[0].metrics[0].max_value = max_value;
    assert.equal(buildProductQuarterComparison(invalidCurrent, [previous], rows), null, `current maximum ${max_value}`);
    const invalidPrevious = structuredClone(previous);
    invalidPrevious.metrics[0].metrics[0].max_value = max_value;
    assert.equal(buildProductQuarterComparison(current, [invalidPrevious], rows), null, `previous maximum ${max_value}`);
  }
});

test('Internet acquiring flexible product conditions are 100 percent only in Q3, preserving all other scores and Q2', () => {
 const code = 'mehaniki.gibkoe_izmenenie_usloviy_produkta';
 const priorOverlays = structuredClone(overlays);
 for (const overlay of priorOverlays) if (overlay.scope === 'q3-score-correction') {
  const team = overlay.products.find(p => p.name === 'Интернет-Эквайринг' && p.unit === 'DB');
  delete team.metrics[code];
 }
 const build = (period, facts) => buildDdiPeriodProducts(data.products, period, facts, ...args, read('../../public/backlog-data.json'));
 const before = build('III кв. 2026', priorOverlays);
 let checked = 0;
 for (const product of products) {
  const old = before.find(p => p.id === product.id);
  if (product.name !== 'Интернет-Эквайринг' || product.unit !== 'DB') {
   assert.deepEqual(product, old);
   continue;
  }
  assert.equal(product.indexMaxPoints, old.indexMaxPoints);
  for (const metric of metrics(product)) {
   const prior = metrics(old).find(m => m.code === metric.code);
   if (metric.code !== code) {assert.deepEqual(metric, prior); continue;}
   checked++;
   assert.equal(metric.value, 1);
   assert.equal(metric.max_value, 1);
   assert.equal(metric.is_applicabble_flg, prior.is_applicabble_flg);
   assert.equal(metric.source.confirmedBy, 'user');
  }
 }
 assert.equal(checked, 1);
 assert.deepEqual(build('II кв. 2026', overlays), build('II кв. 2026', priorOverlays));
});

test('Internet acquiring up-sell is non-applicable only in Q3 and removes one denominator point', () => {
 const code = 'mehaniki.doprodazhi_up_sell';
 const priorOverlays = structuredClone(overlays);
 for (const overlay of priorOverlays) if (overlay.scope === 'metric-applicability-assessment') {
  const team = overlay.products.find(p => p.name === 'Интернет-Эквайринг' && p.unit === 'DB');
  if (team) delete team.metrics[code];
 }
 const build = (period, facts) => buildDdiPeriodProducts(data.products, period, facts, ...args, read('../../public/backlog-data.json'));
 const before = build('III кв. 2026', priorOverlays);
 for (const product of products) {
  const old = before.find(p => p.id === product.id);
  if (product.name !== 'Интернет-Эквайринг' || product.unit !== 'DB') {assert.deepEqual(product, old); continue;}
  const metric = metrics(product).find(m => m.code === code);
  assert.equal(metric.value, null);
  assert.equal(metric.max_value, 0);
  assert.equal(metric.is_applicabble_flg, false);
  assert.equal(metric.excluded_from_index, true);
  assert.equal(product.indexMaxPoints, old.indexMaxPoints - 1);
  assert.ok(metric.recommendation_items.every(r => r.value === null && r.max_value === 0 && r.gap === 0));
  assert.deepEqual(metrics(product).filter(m => m.code !== code), metrics(old).filter(m => m.code !== code));
 }
 assert.deepEqual(build('II кв. 2026', overlays), build('II кв. 2026', priorOverlays));
});

test('Internet acquiring after-purchase cross-sell is full with its during component and all other scores preserved', () => {
 const code = 'mehaniki.cross_sell';
 const priorOverlays = structuredClone(overlays);
 for (const overlay of priorOverlays) {
  const team = overlay.products?.find(p => p.name === 'Интернет-Эквайринг' && p.unit === 'DB');
  if (!team) continue;
  if (overlay.scope === 'crosssell-after-purchase-assessment') team.postPurchaseValue = 0;
  if (overlay.scope === 'frozen-q3-crosssell-scores') {
   team.metric.value = 0.5;
   team.metric.crossSellComponents.after.value = 0;
   team.metric.crossSellComponents.after.rawValue = 0;
  }
 }
 const build = (period, facts) => buildDdiPeriodProducts(data.products, period, facts, ...args, read('../../public/backlog-data.json'));
 const before = build('III кв. 2026', priorOverlays);
 for (const product of products) {
  const old = before.find(p => p.id === product.id);
  if (product.name !== 'Интернет-Эквайринг' || product.unit !== 'DB') {assert.deepEqual(product, old); continue;}
  const metric = metrics(product).find(m => m.code === code);
  assert.equal(metric.value, 1);
  assert.equal(metric.max_value, 1);
  assert.equal(metric.crossSellComponents.after.rawValue, 1);
  assert.equal(metric.crossSellComponents.after.value, 0.5);
  assert.deepEqual(metric.crossSellComponents.during, metrics(old).find(m => m.code === code).crossSellComponents.during);
  assert.equal(product.indexMaxPoints, old.indexMaxPoints);
  assert.deepEqual(metrics(product).filter(m => m.code !== code), metrics(old).filter(m => m.code !== code));
  assert.equal(metrics(product).find(m => m.code === 'mehaniki.doprodazhi_up_sell').is_applicabble_flg, false);
 }
 assert.deepEqual(build('II кв. 2026', overlays), build('II кв. 2026', priorOverlays));
});
