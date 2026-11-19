import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeProductPercent, maturityLevelName} from './report.js';
import {beforeDszhPkSelfServiceConfirmation, beforeSberSpasiboNavigatorConfirmation} from './test-fixtures/sberIdNavigatorStage.js';

const period = 'III кв. 2026';
const id = 'aee72194-01f2-5673-9c7b-ed2beff1432a¦СберСпасибо';
const code = 'general.navigator_reporting_knowledge';
const approval = 'sberspasibo-navigator-2026-11-16';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const report = read('../../public/report-data.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`))
  .map(beforeDszhPkSelfServiceConfirmation);
const args = ['salary-products-q3-2026.json', 'reporting-regularity-missing-q3-2026.json', 'funnel-action-missing-q3-2026.json']
  .map(file => read(`../data/${file}`));
const backlog = read('../../public/backlog-data.json');
const flat = product => product.metrics.flatMap(block => block.metrics);
const originalId = product => String(product.id).replace(/::empty::.*/, '');
const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(report.products, selectedPeriod, facts, ...args, backlog);
const corrections = overlays.find(batch => batch.scope === 'q3-score-correction');
const beforeOverlays = overlays.map(beforeSberSpasiboNavigatorConfirmation);

test('only the exact SberSpasibo Q3 Navigator pair has the 16 November approval and a genuine previous assessment', () => {
  const selected = overlays.flatMap(batch => (batch.products || []).flatMap(team => Object.entries(team.metrics || {})
    .filter(([, fact]) => fact.source?.approvalGroup === approval).map(([metricCode, fact]) => ({batch, team, metricCode, fact}))));
  assert.equal(selected.length, 1);
  const {batch, team, metricCode, fact} = selected[0];
  assert.equal(batch.scope, 'q3-score-correction'); assert.equal(batch.period, period);
  assert.equal(team.id, id); assert.equal(team.name, 'СберСпасибо');
  assert.equal(team.unit, 'CX'); assert.equal(team.type, 'Продукт'); assert.equal(metricCode, code);
  assert.equal(fact.rawValue, 1);
  const proof = fact.source;
  assert.equal(proof.origin, 'userConfirmedDirectNavigatorAssessment'); assert.equal(proof.confirmedBy, 'user');
  assert.equal(proof.date, '2026-11-16'); assert.equal(proof.period, period);
  assert.equal(proof.teamId, id); assert.equal(proof.teamName, team.name); assert.equal(proof.sourceName, team.name);
  assert.equal(proof.unit, team.unit); assert.equal(proof.type, team.type); assert.equal(proof.metricCode, code);
  assert.equal(proof.rawValue, 1); assert.equal(proof.priorityOverWorkbook, true);
  const prior = flat(build(beforeOverlays).find(product => originalId(product) === id)).find(metric => metric.code === code);
  assert.deepEqual(proof.previousAssessment,
    {value: prior.value, maxValue: prior.max_value, rawValue: prior.value / prior.max_value, source: prior.source});
  assert.equal(prior.value, 0.25); assert.equal(prior.max_value, 0.5);
  assert.equal(prior.source.origin, 'keyMetricsPreviousQuarterFallback');
  assert.equal(corrections.counts.teams, corrections.products.length);
  assert.equal(corrections.counts.facts, corrections.products.reduce((sum, product) => sum + Object.keys(product.metrics).length, 0));
  assert.equal(corrections.counts.teams, 49); assert.equal(corrections.counts.facts, 134);
});

test('the live pipeline changes only SberSpasibo Navigator, leaving all other teams, the rubric and Q2 intact', () => {
  const snapshot = structuredClone({report, overlays, args, backlog});
  const before = build(beforeOverlays), after = build(overlays);
  assert.equal(before.length, 76); assert.equal(after.length, 76);
  let changed = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], prior = before[i];
    if (originalId(current) !== id) {assert.deepEqual(current, prior, `Unrelated team remains intact: ${current.name}`); continue;}
    const {metrics: blocks, ...identity} = current, {metrics: oldBlocks, ...oldIdentity} = prior;
    assert.deepEqual(identity, oldIdentity, 'Identity, period and index denominator remain unchanged');
    for (let b = 0; b < blocks.length; b++) {
      const {metrics, ...blockMetadata} = blocks[b], {metrics: oldMetrics, ...oldBlockMetadata} = oldBlocks[b];
      assert.deepEqual(blockMetadata, oldBlockMetadata); assert.equal(metrics.length, oldMetrics.length);
      for (let m = 0; m < metrics.length; m++) {
        const metric = metrics[m], old = oldMetrics[m];
        if (metric.code !== code) {assert.deepEqual(metric, old, `Unrelated SberSpasibo metric: ${metric.code}`); continue;}
        changed++;
        assert.equal(old.value, 0.25); assert.equal(metric.value, 0.5); assert.equal(metric.max_value, 0.5);
        assert.equal(metric.is_applicabble_flg, true); assert.equal(metric.excluded_from_index, false);
        assert.equal(metric.dd_calculation_flg, 1); assert.equal(metric.source.approvalGroup, approval);
        const {value, source, recommendation_items: items, ...rubric} = metric;
        const {value: oldValue, source: oldSource, recommendation_items: oldItems, ...oldRubric} = old;
        assert.deepEqual(rubric, oldRubric, 'Weight, applicability, index flags and Q2 metric history are unchanged');
        assert.deepEqual(items, oldItems.map(item => ({...item, value: 0.5, gap: 0})));
      }
    }
    assert.equal(completeProductPercent(prior), 69); assert.equal(completeProductPercent(current), 70);
    assert.equal(maturityLevelName(completeProductPercent(prior)), 'Зрелые');
    assert.equal(maturityLevelName(completeProductPercent(current)), 'Зрелые');
  }
  assert.equal(changed, 1);
  assert.equal(after.filter((team, i) => completeProductPercent(team) !== completeProductPercent(before[i])).length, 1);
  const mean = products => products.reduce((sum, product) => sum + completeProductPercent(product), 0) / products.length;
  assert.ok(Math.abs(mean(before) - 64.47368421052632) < 1e-9);
  assert.ok(Math.abs(mean(after) - 64.48684210526316) < 1e-9);
  assert.equal(Math.round(mean(after)), 64, 'The B2C card remains 64, so the other fifteen confirmations stay deferred');
  const withoutPriority = structuredClone(overlays);
  delete withoutPriority.find(batch => batch.scope === 'q3-score-correction').products.find(team => team.id === id).metrics[code].source.priorityOverWorkbook;
  assert.equal(flat(build(withoutPriority).find(team => originalId(team) === id)).find(metric => metric.code === code).value, 0.25);
  assert.deepEqual(build(overlays, 'II кв. 2026'), report.products);
  assert.deepEqual(build(beforeOverlays, 'II кв. 2026'), report.products);
  assert.deepEqual({report, overlays, args, backlog}, snapshot, 'Building either quarter does not mutate source inputs');
});
