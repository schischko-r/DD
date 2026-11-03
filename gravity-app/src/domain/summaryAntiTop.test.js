import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSummaryAntiTop} from './summaryAntiTop.js';
const q2 = 'II кв. 2026', q3 = 'III кв. 2026';
const metric = (value, extra = {}) => ({code: 'churn.report', name: 'Полнота отчета', max_value: 1, value, is_applicabble_flg: true, ...extra});
const team = (name, period, value, unit = 'DB', extra = {}) => ({name, unit, period,
  metrics: [{code: 'churn', name: 'Воронка оттока', metrics: [metric(value, extra)]}]});

test('quarter deltas use exact shares, retain zero and filter both quarters by unit', () => {
  const prior = [team('A', q2, 0), team('B', q2, .5), team('C', q2, 1), team('U', q2, 1, 'УБ'),
    team('old', 'I кв. 2026', 0), team('unknown', q2, null)];
  const current = [team('A', q3, 1), team('B', q3, .5), team('C', q3, 1), team('U', q3, 0, 'УБ'),
    team('unknown', q3, null), team('NA', q3, 0, 'DB', {is_applicabble_flg: false}), team('zeroMax', q3, 0, 'DB', {max_value: 0})];
  const snapshot = JSON.stringify({current, prior});
  const [db] = buildSummaryAntiTop(current, prior, q3, 'DB');
  assert.equal(db.teams, 3); assert.equal(db.incompleteTeams, 1); assert.equal(db.incompleteShare, 33);
  assert.equal(db.previousTeams, 3); assert.equal(db.previousIncompleteTeams, 2);
  assert.equal(db.incompleteShareDelta, -33.3, 'round the exact difference, not the two displayed percentages');
  assert.equal(db.previousPeriod, q2);
  const [ub] = buildSummaryAntiTop(current, prior, q3, 'УБ');
  assert.equal(ub.previousIncompleteShare, 0); assert.equal(ub.incompleteShareDelta, 100);
  assert.equal(buildSummaryAntiTop(current, prior, q3)[0].incompleteShareDelta, 0);
  assert.equal(JSON.stringify({current, prior}), snapshot);
});

test('metric comparisons use block and metric codes rather than names, without inventing a missing baseline', () => {
  const current = [team('A', q3, 0)];
  current[0].metrics.push({code: 'attract', name: 'Воронка привлечения', metrics: [metric(0)]});
  const prior = [team('A', q2, 1, 'DB', {name: 'Старое название'})];
  const result = buildSummaryAntiTop(current, prior, q3);
  assert.equal(result.find(m => m.key === 'churn:churn.report').incompleteShareDelta, 100);
  const missing = result.find(m => m.key === 'attract:churn.report');
  assert.equal(missing.incompleteShareDelta, null);
  assert.equal(missing.previousTeams, null);
  assert.equal(buildSummaryAntiTop(current, prior.map(t => ({...t, period: 'I кв. 2026'})), q3)[0].incompleteShareDelta, null);
});

test('current ranking and ten-row limit depend on current incomplete counts and retain Q3 visibility rules', () => {
  const current = Array.from({length: 12}, (_, i) => ({name: 'A', unit: 'DB', period: q3,
    metrics: [{code: 'block', name: 'Block', metrics: [metric(0, {code: `m${i}`, name: `M${i}`})]}]}));
  current.push({name: 'B', unit: 'DB', period: q3, metrics: [{code: 'block', metrics: [metric(0, {code: 'm11', name: 'M11'})]}]});
  current.push({name: 'hidden', unit: 'DB', period: q3, metrics: [{code: 'mehaniki', metrics: [metric(0, {code: 'mehaniki.gibkoe_izmenenie_usloviy_produkta'})]}]});
  const result = buildSummaryAntiTop(current, [], q3);
  assert.equal(result.length, 10);
  assert.equal(result[0].key, 'block:m11');
  assert.equal(result[0].incompleteTeams, 2);
  assert.equal(result[1].key, 'block:m0');
  assert.ok(result.every(m => !m.key.includes('gibkoe')));
  assert.equal(buildSummaryAntiTop(current, [], q3, '', 4).length, 4);
});
