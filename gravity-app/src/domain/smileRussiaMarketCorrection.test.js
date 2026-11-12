import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {applyKeyMetricsWorkbookPriority} from './keyMetricsWorkbookPriority.js';
import {completeProductPercent} from './report.js';

const period = 'III кв. 2026';
const id = '11a243e6-5b73-56ad-8ac7-203e0d744062¦Оплата улыбкой';
const code = 'general.obъem_celevogo_rynka_v_rossii';
const navigator = 'general.navigator_reporting_knowledge';
const approval = 'smile-russia-market-2026-11-11';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const report = read('../../public/report-data.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
const args = ['salary-products-q3-2026.json', 'reporting-regularity-missing-q3-2026.json', 'funnel-action-missing-q3-2026.json']
  .map(file => read(`../data/${file}`));
const backlog = read('../../public/backlog-data.json');
const flat = team => team.metrics.flatMap(block => block.metrics);
const originalId = team => String(team.id).replace(/::empty::.*/, '');
const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(report.products, selectedPeriod, facts, ...args, backlog);
const corrections = overlays.find(batch => batch.scope === 'q3-score-correction');
const team = corrections.products.find(team => team.id === id);
const fact = team.metrics[code];
const beforeOverlays = structuredClone(overlays);
delete beforeOverlays.find(batch => batch.scope === 'q3-score-correction').products.find(team => team.id === id).metrics[code];

test('Smile Russia knowledge becomes full in the live App pipeline while every other metric and Q2 remain unchanged', () => {
  const reportSnapshot = structuredClone(report), overlaysSnapshot = structuredClone(overlays);
  const selected = corrections.products.flatMap(team => Object.entries(team.metrics)
    .filter(([, fact]) => fact.source?.approvalGroup === approval).map(([code, fact]) => ({team, code, fact})));
  assert.equal(selected.length, 1); assert.equal(selected[0].team.id, id); assert.equal(selected[0].code, code);
  assert.equal(team.name, 'Оплата улыбкой'); assert.equal(team.unit, 'DB'); assert.equal(team.type, 'Продукт');
  assert.equal(fact.rawValue, 1);
  for (const proof of [fact.source, fact.source.correction]) {
    assert.equal(proof.origin, 'userConfirmedQ3ScoreCorrection'); assert.equal(proof.confirmedBy, 'user');
    assert.equal(proof.date, '2026-11-11'); assert.equal(proof.period, period); assert.equal(proof.approvalGroup, approval);
  }
  assert.equal(fact.source.correction.rawValue, 1);
  const before = build(beforeOverlays), after = build(overlays);
  assert.equal(after.length, 76); assert.equal(before.length, 76);
  let changed = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], old = before[i];
    if (originalId(current) !== id) {assert.deepEqual(current, old, `Unrelated team: ${current.name}`); continue;}
    const {metrics: blocks, ...metadata} = current, {metrics: oldBlocks, ...oldMetadata} = old;
    assert.deepEqual(metadata, oldMetadata);
    for (let b = 0; b < blocks.length; b++) {
      const {metrics, ...blockMetadata} = blocks[b], {metrics: oldMetrics, ...oldBlockMetadata} = oldBlocks[b];
      assert.deepEqual(blockMetadata, oldBlockMetadata); assert.equal(metrics.length, oldMetrics.length);
      for (let j = 0; j < metrics.length; j++) {
        const metric = metrics[j], prior = oldMetrics[j];
        if (metric.code !== code) {assert.deepEqual(metric, prior, `Unrelated Smile metric: ${metric.code}`); continue;}
        changed++;
        assert.equal(prior.value, 0); assert.equal(metric.value, 0.2); assert.equal(metric.max_value, 0.2);
        assert.equal(metric.value, metric.max_value); assert.equal(metric.source.approvalGroup, approval);
        assert.deepEqual(fact.source.previousAssessment,
          {value: prior.value, maxValue: prior.max_value, rawValue: 0, source: prior.source});
        const {value, source, recommendation_items: items, ...rubric} = metric;
        const {value: oldValue, source: oldSource, recommendation_items: oldItems, ...oldRubric} = prior;
        assert.deepEqual(rubric, oldRubric, 'Preserve weight, applicability, index flags and genuine Q2 history');
        assert.deepEqual(items, oldItems.map(item => ({...item, value: metric.max_value, gap: 0})));
      }
    }
    const sber = flat(current).find(metric => metric.code === 'general.obъem_celevogo_rynka_v_sbere');
    assert.equal(sber.value, 0); assert.equal(sber.max_value, 0.2);
    const nav = flat(current).find(metric => metric.code === navigator);
    assert.equal(nav.value, 0.5); assert.equal(nav.max_value, 0.5);
    assert.deepEqual(nav, flat(old).find(metric => metric.code === navigator), 'Preserve the standing full Navigator assessment, including its actual source');
    assert.equal(completeProductPercent(old), 76); assert.equal(completeProductPercent(current), 77);
  }
  assert.equal(changed, 1);
  assert.deepEqual(build(overlays, 'II кв. 2026'), report.products);
  assert.deepEqual(build(beforeOverlays, 'II кв. 2026'), report.products);
  assert.deepEqual(report, reportSnapshot); assert.deepEqual(overlays, overlaysSnapshot);
});

test('standing Navigator preservation is limited to the proved Smile fallback and cannot replace a newer assessment', () => {
  const current = structuredClone(build(beforeOverlays).find(product => originalId(product) === id));
  const nav = flat(current).find(metric => metric.code === navigator);
  nav.value = 0.25;
  nav.source = {origin: 'userConfirmedKeyMetricsAccuracyCap', confirmedBy: 'user', period,
    rawValue: 0.5, errorMetricCodes: ['general.obъem_celevogo_rynka_v_sbere']};
  nav.recommendation_items = nav.recommendation_items.map(item => ({...item, value: 0.25, gap: 0.25}));
  const workbook = overlays.find(batch => batch.scope === 'key-metrics-assessment');
  const correctionBatch = {period, scope: 'q3-score-correction', products: [{id, name: 'Оплата улыбкой', unit: 'DB', type: 'Продукт',
    metrics: {[code]: structuredClone(fact)}}]};
  const resolve = (batch = correctionBatch, book = workbook, product = current, priors = report.products) =>
    flat(applyKeyMetricsWorkbookPriority([product], period, [book, batch], priors)[0]).find(metric => metric.code === navigator);
  assert.deepEqual(resolve(), flat(build(beforeOverlays).find(product => originalId(product) === id)).find(metric => metric.code === navigator));
  assert.deepEqual(flat(applyKeyMetricsWorkbookPriority([current], period, [workbook, null, correctionBatch], report.products)[0])
    .find(metric => metric.code === navigator), resolve(), 'A null overlay keeps the existing resolver contract');
  const saved = fact.source.preservedNavigatorAssessment;
  assert.equal(saved.code, navigator); assert.equal(saved.value, 0.5); assert.equal(saved.maxValue, 0.5); assert.equal(saved.rawValue, 1);
  assert.ok(saved.reason.length > 0);
  for (const [label, mutate] of [
    ['Russia not full', batch => {batch.products[0].metrics[code].rawValue = 0;}],
    ...['source', 'correction'].flatMap(level => ['origin', 'confirmedBy', 'period', 'date', 'approvalGroup'].map(field =>
      [`${level}.${field}`, batch => {const proof = batch.products[0].metrics[code].source; (level === 'source' ? proof : proof.correction)[field] = 'other';}])),
    ...['code', 'value', 'maxValue', 'rawValue'].map(field => [`saved.${field}`, batch => {
      batch.products[0].metrics[code].source.preservedNavigatorAssessment[field] = field === 'code' ? 'other' : 0;
    }]),
    ...['origin', 'file', 'workbookSha256', 'fromPeriod', 'sourceValue', 'sourceMaxValue', 'date', 'confirmedBy', 'period'].map(field =>
      [`saved.source.${field}`, batch => {batch.products[0].metrics[code].source.preservedNavigatorAssessment.source[field] = 'other';}]),
  ]) {
    const batch = structuredClone(correctionBatch); mutate(batch);
    assert.equal(resolve(batch).value, 0.25, `Do not restore unproved history: ${label}`);
  }
  for (const field of ['id', 'name', 'unit', 'type']) {
    const product = structuredClone(current), priors = structuredClone(report.products), batch = structuredClone(correctionBatch);
    const prior = priors.find(team => team.id === id), value = `Other ${prior[field]}`;
    prior[field] = value; product[field] = field === 'id' ? `${value}::empty::${period}` : value; batch.products[0][field] = value;
    assert.equal(resolve(batch, workbook, product, priors).value, 0.25, `Another identity cannot use Smile preservation: ${field}`);
  }
  const halfHistory = structuredClone(report.products);
  flat(halfHistory.find(team => team.id === id)).find(metric => metric.code === navigator).value = 0.25;
  assert.equal(resolve(correctionBatch, workbook, current, halfHistory).value, 0.25, 'The saved full score must match the genuine Q2 assessment');
  for (const rawValue of [0, 0.5]) {
    const batch = structuredClone(correctionBatch);
    batch.products[0].metrics[navigator] = {rawValue, source: {origin: 'userConfirmedQ3ScoreCorrection', confirmedBy: 'user', period,
      correction: {origin: 'userConfirmedQ3ScoreCorrection', confirmedBy: 'user', period, rawValue}}};
    assert.equal(resolve(batch).value, rawValue * 0.5, 'A direct Navigator assessment has higher priority');
  }
  const explicitWorkbook = structuredClone(workbook);
  let workbookTeam = explicitWorkbook.products.find(team => team.id === id);
  if (!workbookTeam) {
    workbookTeam = {id, name: 'Оплата улыбкой', unit: 'DB', type: 'Продукт', metrics: {}};
    explicitWorkbook.products.push(workbookTeam);
  }
  workbookTeam.metrics[navigator] = {rawValue: 0, source: {origin: 'keyMetricsWorkbookAssessment'}};
  const withoutSavedFallback = structuredClone(correctionBatch);
  delete withoutSavedFallback.products[0].metrics[code].source.preservedNavigatorAssessment;
  // The existing accuracy-cap rule precedes workbook resolution. A new workbook
  // answer must disable this preservation without changing that standing rule.
  assert.deepEqual(resolve(correctionBatch, explicitWorkbook), resolve(withoutSavedFallback, explicitWorkbook),
    'An explicit workbook assessment cannot be replaced by the saved fallback');
  assert.equal(resolve(correctionBatch, explicitWorkbook).value, 0.25);
  const pendingWorkbook = structuredClone(workbook);
  pendingWorkbook.pending.push({id, name: 'Оплата улыбкой', unit: 'DB', type: 'Продукт', metricCode: navigator, sourceRows: [999]});
  assert.deepEqual(resolve(correctionBatch, pendingWorkbook), resolve(withoutSavedFallback, pendingWorkbook),
    'An unresolved workbook assessment cannot be replaced by the saved fallback');
  assert.equal(resolve(correctionBatch, pendingWorkbook).value, 0.25);
  assert.equal(applyKeyMetricsWorkbookPriority([current], 'II кв. 2026', [workbook, correctionBatch], report.products)[0], current);
});
