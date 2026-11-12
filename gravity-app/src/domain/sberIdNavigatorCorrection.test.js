import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeProductPercent, maturityLevelName} from './report.js';
import {beforeSberIdNavigatorConfirmation, beforeSberIdDeviationActionsConfirmation} from './test-fixtures/sberIdNavigatorStage.js';

const period = 'III кв. 2026';
const id = 'f0050a4f-3ce4-5c90-b5f5-627256453071¦SberID';
const code = 'general.navigator_reporting_knowledge';
const approval = 'sberid-navigator-2026-11-12';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const report = read('../../public/report-data.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`))
  .map(beforeSberIdDeviationActionsConfirmation);
const args = ['salary-products-q3-2026.json', 'reporting-regularity-missing-q3-2026.json', 'funnel-action-missing-q3-2026.json']
  .map(file => read(`../data/${file}`));
const backlog = read('../../public/backlog-data.json');
const flat = product => product.metrics.flatMap(block => block.metrics);
const originalId = product => String(product.id).replace(/::empty::.*/, '');
const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(report.products, selectedPeriod, facts, ...args, backlog);
const corrections = overlays.find(batch => batch.scope === 'q3-score-correction');
const beforeOverlays = overlays.map(beforeSberIdNavigatorConfirmation);
const fact = corrections.products.find(team => team.id === id).metrics[code];

test('SberID has one explicitly confirmed Navigator score and retains the exact previous assessment', () => {
  const selected = corrections.products.flatMap(team => Object.entries(team.metrics)
    .filter(([, fact]) => fact.source?.approvalGroup === approval).map(([code, fact]) => ({team, code, fact})));
  assert.equal(selected.length, 1);
  const selectedTeam = selected[0].team;
  assert.equal(selectedTeam.id, id); assert.equal(selectedTeam.name, 'SberID');
  assert.equal(selectedTeam.unit, 'Data'); assert.equal(selectedTeam.type, 'Продукт'); assert.equal(selected[0].code, code);
  assert.equal(fact.rawValue, 1);
  assert.equal(fact.source.origin, 'userConfirmedDirectNavigatorAssessment'); assert.equal(fact.source.confirmedBy, 'user');
  assert.equal(fact.source.date, '2026-11-12'); assert.equal(fact.source.period, period);
  assert.equal(fact.source.priorityOverWorkbook, true); assert.equal(fact.source.rawValue, 1);
  assert.equal(fact.source.teamId, id); assert.equal(fact.source.teamName, 'SberID');
  assert.equal(fact.source.unit, 'Data'); assert.equal(fact.source.type, 'Продукт'); assert.equal(fact.source.metricCode, code);
  const before = build(beforeOverlays).find(product => originalId(product) === id);
  const prior = flat(before).find(metric => metric.code === code);
  const priorFact = beforeOverlays.find(batch => batch.scope === 'q3-score-correction').products.find(team => team.id === id).metrics[code];
  assert.deepEqual(fact.source.previousAssessment,
    {value: prior.value, maxValue: prior.max_value, rawValue: prior.value / prior.max_value, source: prior.source, priorFact});
  assert.equal(priorFact.rawValue, 0.5);
  assert.equal(priorFact.source.origin, 'userConfirmedDirectNavigatorAssessment');
  assert.equal(priorFact.source.date, '2026-11-02');
  assert.equal(corrections.counts.teams, corrections.products.length);
  assert.equal(corrections.counts.facts, corrections.products.reduce((sum, team) => sum + Object.keys(team.metrics).length, 0));
});

test('the final App pipeline preserves the SberID full Navigator priority and changes no other score or rubric', () => {
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
        assert.equal(prior.value, 0.25); assert.equal(prior.max_value, 0.5);
        assert.equal(metric.value, 0.5); assert.equal(metric.max_value, 0.5);
        assert.equal(metric.source.origin, 'userConfirmedDirectNavigatorAssessment');
        assert.equal(metric.source.approvalGroup, approval); assert.equal(metric.source.priorityOverWorkbook, true);
        const {value, source, recommendation_items: items, ...rubric} = metric;
        const {value: oldValue, source: oldSource, recommendation_items: oldItems, ...oldRubric} = prior;
        assert.deepEqual(rubric, oldRubric, 'Keep original applicability, weight, index flags and Q2 history');
        assert.deepEqual(items, oldItems.map(item => ({...item, value: 0.5, gap: 0})));
      }
    }
    assert.equal(completeProductPercent(previous), 72); assert.equal(completeProductPercent(current), 73);
    assert.equal(maturityLevelName(completeProductPercent(previous)), 'Зрелые');
    assert.equal(maturityLevelName(completeProductPercent(current)), 'Зрелые');
  }
  assert.equal(changed, 1);
  assert.equal(after.filter((team, i) => completeProductPercent(team) !== completeProductPercent(before[i])).length, 1);
  const mean = products => products.reduce((sum, product) => sum + completeProductPercent(product), 0) / products.length;
  assert.ok(Math.abs(mean(before) - 64.42105263157895) < 1e-9);
  assert.ok(Math.abs(mean(after) - 64.4342105263158) < 1e-9);
  assert.equal(Math.round(mean(after)), 64);
  const withoutPriority = structuredClone(overlays);
  delete withoutPriority.find(batch => batch.scope === 'q3-score-correction').products.find(team => team.id === id).metrics[code].source.priorityOverWorkbook;
  const fallback = flat(build(withoutPriority).find(product => originalId(product) === id)).find(metric => metric.code === code);
  assert.equal(fallback.value, 0.25, 'The explicit priority prevents the unchanged workbook/Q2 fallback from replacing the new score');
  assert.deepEqual(build(overlays, 'II кв. 2026'), report.products);
  assert.deepEqual(build(beforeOverlays, 'II кв. 2026'), report.products);
  assert.deepEqual({report, overlays, args, backlog}, snapshot);
});
