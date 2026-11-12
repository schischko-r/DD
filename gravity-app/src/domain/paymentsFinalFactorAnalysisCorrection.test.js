import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeProductPercent, isDdIndexMetric, maturityLevelName} from './report.js';

const period = 'III кв. 2026';
const id = 'aa80593f-3f07-5935-96b3-2e367d6a78f4¦Платежи';
const baseCode = 'goals.factor_analysis_l1_l2';
const code = 'goals.po_factor_analysis';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const raw = read('../../public/report-data.json').products;
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
const args = ['salary-products', 'reporting-regularity-missing', 'funnel-action-missing'].map(name => read(`../data/${name}-q3-2026.json`));
const backlog = read('../../public/backlog-data.json');
const batch = overlays.find(item => item.scope === 'goals-final-scores');
const row = batch.products.find(team => team.name === 'Платежи' && team.unit === 'DB');
const correction = row.finalCorrections[baseCode];
const beforeOverlays = structuredClone(overlays);
const priorRow = beforeOverlays.find(item => item.scope === 'goals-final-scores').products.find(team => team.name === 'Платежи' && team.unit === 'DB');
priorRow.final[baseCode] = correction.previousValue;
priorRow.finalCorrections[baseCode] = structuredClone(correction.previousCorrection);
const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(raw, selectedPeriod, facts, ...args, backlog);
const originalId = product => String(product.id).replace(/::empty::.*/, '');

test('Payments final FA approval changes exactly one indexed metric and its final score while preserving LYu/LT, PO details and Q2', () => {
  const snapshot = structuredClone({raw, overlays, args, backlog});
  assert.equal(row.final[baseCode], 0.5);
  assert.equal(correction.origin, 'userConfirmedGoalScoreCorrection'); assert.equal(correction.confirmedBy, 'user');
  assert.equal(correction.period, period); assert.equal(correction.date, '2026-11-12');
  assert.equal(correction.group, 'payments-final-fa-2026-11-12');
  assert.equal(correction.value, 0.5); assert.equal(correction.previousValue, 0);
  assert.equal(correction.previousCorrection.group, 'finalGoalsTable20261103');
  assert.equal(correction.previousCorrection.value, 0);
  const before = build(beforeOverlays), after = build(overlays);
  assert.equal(before.length, 76); assert.equal(after.length, 76);
  let changed = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], previous = before[i];
    if (originalId(current) !== id) {assert.deepEqual(current, previous, `Unrelated team: ${current.name}`); continue;}
    assert.equal(current.name, 'Платежи'); assert.equal(current.unit, 'DB'); assert.equal(current.type, 'Продукт');
    const {metrics: blocks, ...metadata} = current, {metrics: oldBlocks, ...oldMetadata} = previous;
    assert.deepEqual(metadata, oldMetadata);
    for (let b = 0; b < blocks.length; b++) {
      if (blocks[b].code !== 'goals') {assert.deepEqual(blocks[b], oldBlocks[b]); continue;}
      const {metrics, goalsFinalScores, ...blockMetadata} = blocks[b];
      const {metrics: oldMetrics, goalsFinalScores: oldFinal, ...oldBlockMetadata} = oldBlocks[b];
      assert.deepEqual(blockMetadata, oldBlockMetadata, 'PO detail rows and other block metadata remain intact');
      assert.deepEqual(goalsFinalScores, {...oldFinal, [baseCode]: 0.5});
      for (let j = 0; j < metrics.length; j++) {
        const metric = metrics[j], prior = oldMetrics[j];
        if (metric.code !== code) {assert.deepEqual(metric, prior, `Unrelated metric: ${metric.code}`); continue;}
        changed++;
        assert.equal(prior.value, 0); assert.equal(prior.max_value, 1);
        assert.equal(metric.value, 0.5); assert.equal(metric.max_value, 1);
        assert.equal(metric.source.level, 'final'); assert.equal(metric.source.selectedValue, 0.5);
        assert.equal(isDdIndexMetric(metric), true);
        const {value, source, recommendation_items: items, ...rubric} = metric;
        const {value: oldValue, source: oldSource, recommendation_items: oldItems, ...oldRubric} = prior;
        assert.deepEqual(rubric, oldRubric);
        assert.deepEqual(source, {...oldSource, selectedValue: 0.5});
        assert.deepEqual(items, oldItems?.map(item => ({...item, value: 0.5, gap: 0.5})));
      }
      const lulT = metrics.find(metric => metric.code === baseCode);
      const po = blocks[b].goalsPoLevelMetrics.find(metric => metric.code === code);
      assert.equal(lulT.value, 1); assert.equal(isDdIndexMetric(lulT), false);
      assert.equal(po.value, 0); assert.equal(isDdIndexMetric(po), false);
    }
    const oldScore = completeProductPercent(previous), newScore = completeProductPercent(current);
    assert.equal(oldScore, 66); assert.equal(newScore, 68);
    assert.equal(maturityLevelName(newScore), maturityLevelName(oldScore));
  }
  assert.equal(changed, 1);
  assert.deepEqual(build(overlays, 'II кв. 2026'), raw);
  assert.deepEqual(build(beforeOverlays, 'II кв. 2026'), raw);
  assert.deepEqual({raw, overlays, args, backlog}, snapshot);
});
