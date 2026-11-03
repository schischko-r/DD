import assert from 'node:assert/strict';
import test from 'node:test';
import {compareRows, matchedRows, teamKey} from './comparison-model.js';
import {makeCsv} from './report-model.js';
const row = (id, pct, extra = {}) => ({id, pct, unit: 'A', type: 'Продукт', ...extra});
const data = rows => ({blocks: {attract: {rows}}});

test('paired change excludes absent teams and uses a shared cohort for means, medians and level shares', () => {
  const before = data([row('a', 20), row('b', 80), row('old-only', 100)]);
  const after = data([row('a::empty::III кв. 2026', 40), row('b', 100), row('new-only', 0)]);
  const snapshot = JSON.stringify([before, after]);
  const result = compareRows(before, after, 'attract');
  assert.equal(result.baselineCount, 3); assert.equal(result.currentCount, 3);
  assert.deepEqual(result.pairs.map(p => p.deltaPp), [20, 20]);
  assert.deepEqual(result.pairs.map(p => p.relativeChange), [100, 25]);
  assert.deepEqual(result.metrics.map(m => [m.baseline, m.current, m.deltaPp, m.relativeChange]), [
    [50, 70, 20, 40], [50, 70, 20, 40], [50, 0, -50, -100], [50, 50, 0, 0], [0, 50, 50, null],
  ]);
  assert.equal(JSON.stringify([before, after]), snapshot);
});

test('zero baseline, declining scores, no pairs and invalid scores never invent relative growth', () => {
  const result = compareRows(data([row('zero', 0), row('down', 80), row('invalid', null)]), data([row('zero', 20), row('down', 40), row('invalid', 100)]), 'attract');
  assert.deepEqual(result.pairs.map(p => [p.deltaPp, p.relativeChange]), [[20, null], [-40, -50]]);
  const empty = compareRows(data([row('old', 100)]), data([row('new', 0)]), 'attract');
  assert.deepEqual(empty.pairs, []);
  assert.ok(empty.metrics.every(m => m.baseline === null && m.current === null && m.deltaPp === null && m.relativeChange === null));
  assert.deepEqual(matchedRows({}, {}, 'missing'), []);
});

test('identity uses sourceTeamId and period suffix; ambiguous IDs are excluded', () => {
  assert.equal(teamKey(row('generated', 10, {sourceTeamId: 'real'})), 'real');
  assert.equal(teamKey(row('real::empty::III кв. 2026', 10)), 'real');
  assert.equal(matchedRows(data([row('a', 20), row('a', 30)]), data([row('a', 40)]), 'attract').length, 0);
  assert.equal(matchedRows(data([row('a', 20)]), data([row('a', 40), row('a', 50)]), 'attract').length, 0);
});

test('unit and type filters apply in both quarters including teams that moved', () => {
  const before = data([row('same', 10), row('moved', 20, {unit: 'B'}), row('changed', 30, {type: 'Сегмент'})]);
  const after = data([row('same', 40), row('moved', 80), row('changed', 100)]);
  const result = compareRows(before, after, 'attract', {unit: 'A', type: 'Продукт'});
  assert.equal(result.baselineCount, 1); assert.equal(result.currentCount, 3);
  assert.deepEqual(result.pairs.map(p => p.current.id), ['same']);
  assert.equal(result.metrics[0].deltaPp, 30);
  assert.equal(compareRows(before, after, 'attract', {unit: 'absent'}).pairs.length, 0);
});

test('CSV retains explicit absolute and relative growth and empty missing baselines', () => {
  const csv = makeCsv([row('a', 30, {baselinePct: 20, deltaPp: 10, relativeChange: 50}), row('zero', 20, {baselinePct: 0, deltaPp: 20, relativeChange: null}), row('new', 40)], {blockLabel: 'Привлечение'});
  const lines = csv.trim().split('\r\n').map(line => line.replace(/^\uFEFF/, '').split(';'));
  assert.deepEqual(lines[0].slice(12), ['"II квартал 2026, %"', '"III − II, п.п."', '"III − II, % к II кварталу"']);
  assert.deepEqual(lines[1].slice(12), ['"20"', '"10"', '"50"']);
  assert.deepEqual(lines[2].slice(12), ['"0"', '"20"', '""']);
  assert.deepEqual(lines[3].slice(12), ['""', '""', '""']);
});
