import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeProductPercent, maturityLevelName} from './report.js';
import {beforeSberIdDeviationActionsConfirmation} from './test-fixtures/sberIdNavigatorStage.js';

const period = 'III кв. 2026';
const id = 'f0050a4f-3ce4-5c90-b5f5-627256453071¦SberID';
const code = 'voronka_ispolьzovaniya.meropriyatiya_po_rabote_s_otkloneniyami';
const approval = 'sberid-deviation-actions-2026-11-12';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const report = read('../../public/report-data.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
const args = ['salary-products-q3-2026.json', 'reporting-regularity-missing-q3-2026.json', 'funnel-action-missing-q3-2026.json']
  .map(file => read(`../data/${file}`));
const backlog = read('../../public/backlog-data.json');
const flat = product => product.metrics.flatMap(block => block.metrics);
const originalId = product => String(product.id).replace(/::empty::.*/, '');
const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(report.products, selectedPeriod, facts, ...args, backlog);
const batchIndex = overlays.findIndex(item => item.scope === 'funnel-user-assessment'
  && item.products?.some(team => team.id === id && team.metrics?.[code]?.source?.approvalGroup === approval));
const batch = overlays[batchIndex];
const fact = batch.products.find(team => team.id === id).metrics[code];
const beforeOverlays = overlays.map(beforeSberIdDeviationActionsConfirmation);

test('the SberID deviation-actions approval retains the complete previous fact and only one exact pair', () => {
  const selected = overlays.flatMap(batch => (batch.products || []).flatMap(team => Object.entries(team.metrics || {})
    .filter(([, item]) => item.source?.approvalGroup === approval).map(([metricCode, item]) => ({team, metricCode, item}))));
  assert.equal(selected.length, 1);
  assert.equal(selected[0].team.id, id); assert.equal(selected[0].team.name, 'SberID');
  assert.equal(selected[0].team.unit, 'Data'); assert.equal(selected[0].team.type, 'Продукт');
  assert.equal(selected[0].metricCode, code); assert.equal(fact.rawValue, 1);
  for (const proof of [fact.source, fact.source.correction]) {
    assert.equal(proof.origin, 'userConfirmedQ3ScoreCorrection'); assert.equal(proof.confirmedBy, 'user');
    assert.equal(proof.period, period); assert.equal(proof.date, '2026-11-12');
    assert.equal(proof.approvalGroup, approval); assert.equal(proof.rawValue, 1);
  }
  const previous = fact.source.previousAssessment;
  assert.equal(previous.rawValue, 0.5);
  assert.equal(previous.source.origin, 'userConfirmedDigitalCompletion20261031');
  assert.equal(previous.source.date, '2026-10-31');
  assert.equal(previous.source.correction.date, '2026-11-02');
  const oldBatch = beforeOverlays[batchIndex];
  assert.deepEqual(oldBatch.products.find(team => team.id === id).metrics[code], previous);
});

test('the final App pipeline changes only SberID deviation actions while keeping Navigator full and Q2 intact', () => {
  const snapshot = structuredClone({report, overlays, args, backlog});
  const before = build(beforeOverlays), after = build(overlays);
  assert.equal(before.length, 76); assert.equal(after.length, 76);
  let changed = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], previous = before[i];
    if (originalId(current) !== id) {assert.deepEqual(current, previous, `Unrelated team: ${current.name}`); continue;}
    const {metrics: blocks, ...metadata} = current, {metrics: oldBlocks, ...oldMetadata} = previous;
    assert.deepEqual(metadata, oldMetadata);
    for (let b = 0; b < blocks.length; b++) {
      const {metrics, ...blockMetadata} = blocks[b], {metrics: oldMetrics, ...oldBlockMetadata} = oldBlocks[b];
      assert.deepEqual(blockMetadata, oldBlockMetadata); assert.equal(metrics.length, oldMetrics.length);
      for (let j = 0; j < metrics.length; j++) {
        const metric = metrics[j], prior = oldMetrics[j];
        if (metric.code !== code) {assert.deepEqual(metric, prior, `Unrelated SberID metric: ${metric.code}`); continue;}
        changed++;
        assert.equal(prior.value, 0.5); assert.equal(prior.max_value, 1);
        assert.equal(metric.value, 1); assert.equal(metric.max_value, 1);
        assert.equal(metric.source.approvalGroup, approval);
        const {value, source, recommendation_items: items, ...rubric} = metric;
        const {value: oldValue, source: oldSource, recommendation_items: oldItems, ...oldRubric} = prior;
        assert.deepEqual(rubric, oldRubric);
        assert.deepEqual(items, oldItems.map(item => ({...item, value: 1, gap: 0})));
      }
    }
    const navigator = flat(current).find(metric => metric.code === 'general.navigator_reporting_knowledge');
    assert.equal(navigator.value, navigator.max_value); assert.equal(navigator.source.approvalGroup, 'sberid-navigator-2026-11-12');
    assert.equal(completeProductPercent(previous), 73); assert.equal(completeProductPercent(current), 76);
    assert.equal(maturityLevelName(completeProductPercent(previous)), 'Зрелые');
    assert.equal(maturityLevelName(completeProductPercent(current)), 'Зрелые');
  }
  assert.equal(changed, 1);
  assert.deepEqual(build(overlays, 'II кв. 2026'), report.products);
  assert.deepEqual(build(beforeOverlays, 'II кв. 2026'), report.products);
  assert.deepEqual({report, overlays, args, backlog}, snapshot);
});
