import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeProductPercent, isDdIndexMetric, maturityLevelName} from './report.js';

const period = 'III кв. 2026';
const id = '7043f2b6-9836-55c4-8801-c9bde60b990d¦Интернет-Эквайринг';
const approval = 'internet-acquiring-final-fa-monitoring-2026-11-12';
const targets = [
  {base: 'goals.factor_analysis_l1_l2', code: 'goals.po_factor_analysis', prior: 0},
  {base: 'goals.monitored', code: 'goals.po_monitoring', prior: 1},
];
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const raw = read('../../public/report-data.json').products;
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
const args = ['salary-products', 'reporting-regularity-missing', 'funnel-action-missing'].map(name => read(`../data/${name}-q3-2026.json`));
const backlog = read('../../public/backlog-data.json');
const batch = overlays.find(item => item.scope === 'goals-final-scores');
const row = batch.products.find(team => team.name === 'Интернет-Эквайринг' && team.unit === 'DB');
const beforeOverlays = structuredClone(overlays);
const priorRow = beforeOverlays.find(item => item.scope === 'goals-final-scores').products.find(team => team.name === row.name && team.unit === row.unit);
for (const {base} of targets) {
  const correction = row.finalCorrections[base];
  priorRow.final[base] = correction.previousValue;
  if (correction.previousCorrection) priorRow.finalCorrections[base] = structuredClone(correction.previousCorrection);
  else delete priorRow.finalCorrections[base];
}
const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(raw, selectedPeriod, facts, ...args, backlog);
const originalId = product => String(product.id).replace(/::empty::.*/, '');

test('Internet-Acquiring final FA and monitoring become half scores without changing detail levels, other teams, weights or DDI', () => {
  const snapshot = structuredClone({raw, overlays, args, backlog});
  for (const {base, prior} of targets) {
    const correction = row.finalCorrections[base];
    assert.equal(row.final[base], 0.5); assert.equal(correction.value, 0.5); assert.equal(correction.previousValue, prior);
    assert.equal(correction.origin, 'userConfirmedGoalScoreCorrection'); assert.equal(correction.confirmedBy, 'user');
    assert.equal(correction.period, period); assert.equal(correction.date, '2026-11-12'); assert.equal(correction.group, approval);
    if (base === 'goals.monitored') assert.equal(correction.previousCorrection, null);
    else {assert.equal(correction.previousCorrection.group, 'finalGoalsTable20261103'); assert.equal(correction.previousCorrection.value, 0);}
  }
  const before = build(beforeOverlays), after = build(overlays);
  assert.equal(before.length, 76); assert.equal(after.length, 76);
  let changed = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], previous = before[i];
    if (originalId(current) !== id) {assert.deepEqual(current, previous, `Unrelated team: ${current.name}`); continue;}
    assert.equal(current.name, 'Интернет-Эквайринг'); assert.equal(current.unit, 'DB'); assert.equal(current.type, 'Продукт');
    const {metrics: blocks, ...metadata} = current, {metrics: oldBlocks, ...oldMetadata} = previous;
    assert.deepEqual(metadata, oldMetadata);
    for (let b = 0; b < blocks.length; b++) {
      if (blocks[b].code !== 'goals') {assert.deepEqual(blocks[b], oldBlocks[b]); continue;}
      const {metrics, goalsFinalScores, ...blockMetadata} = blocks[b];
      const {metrics: oldMetrics, goalsFinalScores: oldFinal, ...oldBlockMetadata} = oldBlocks[b];
      assert.deepEqual(blockMetadata, oldBlockMetadata, 'PO details remain intact');
      assert.deepEqual(goalsFinalScores, {...oldFinal, ...Object.fromEntries(targets.map(item => [item.base, 0.5]))});
      for (let j = 0; j < metrics.length; j++) {
        const metric = metrics[j], prior = oldMetrics[j], target = targets.find(item => item.code === metric.code);
        if (!target) {assert.deepEqual(metric, prior, `Unrelated metric: ${metric.code}`); continue;}
        changed++;
        assert.equal(prior.value, target.prior); assert.equal(prior.max_value, 1);
        assert.equal(metric.value, 0.5); assert.equal(metric.max_value, 1); assert.equal(isDdIndexMetric(metric), true);
        assert.equal(metric.source.level, 'final');
        const {value, source, recommendation_items: items, ...rubric} = metric;
        const {value: oldValue, source: oldSource, recommendation_items: oldItems, ...oldRubric} = prior;
        assert.deepEqual(rubric, oldRubric); assert.deepEqual(source, {...oldSource, selectedValue: 0.5});
        assert.deepEqual(items, oldItems?.map(item => ({...item, value: 0.5, gap: 0.5})));
        assert.equal(metrics.find(item => item.code === target.base).value, 1, 'LYu/LT detail stays full');
        assert.equal(blocks[b].goalsPoLevelMetrics.find(item => item.code === target.code).value, 0, 'PO detail stays zero');
      }
      assert.equal(metrics.filter(item => targets.some(target => target.code === item.code)).reduce((sum, item) => sum + item.value, 0), 1);
      assert.equal(oldMetrics.filter(item => targets.some(target => target.code === item.code)).reduce((sum, item) => sum + item.value, 0), 1);
    }
    assert.equal(completeProductPercent(previous), 52); assert.equal(completeProductPercent(current), 52);
    assert.equal(maturityLevelName(completeProductPercent(current)), maturityLevelName(completeProductPercent(previous)));
  }
  assert.equal(changed, 2);
  assert.deepEqual(build(overlays, 'II кв. 2026'), raw); assert.deepEqual(build(beforeOverlays, 'II кв. 2026'), raw);
  assert.deepEqual({raw, overlays, args, backlog}, snapshot);
});
