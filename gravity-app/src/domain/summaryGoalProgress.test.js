import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSummaryGoalProgress} from './summaryGoalProgress.js';
import {buildDdiPeriodProducts} from './quarterProfiles.js';

const period = 'III кв. 2026';
const previousPeriod = 'II кв. 2026';
const fixture = (name, baseline, current, unit = 'CX') => {
  const product = {id: name, name, unit, type: 'Продукт', period: previousPeriod,
    metrics: [{code: 'general', metrics: [{code: 'general.test', value: baseline, max_value: 100, is_applicabble_flg: true}]}]};
  return {previous: product, current: {...product, id: `${name}::empty::${period}`, period,
    metrics: [{code: 'general', metrics: [{code: 'general.test', value: current, max_value: 100, is_applicabble_flg: true}]}]},
    row: {name, unit, type: 'продукт', score: baseline}};
};
const run = cases => buildSummaryGoalProgress(cases.map(item => item.current), cases.map(item => item.previous), cases.map(item => item.row));

test('individual goals use the next-level boundaries, while original leaders must retain at least 81', () => {
  const cases = [[0, 0, 40, false], [39, 39, 40, false], [39, 40, 40, true],
    [40, 60, 61, false], [60, 61, 61, true], [61, 80, 81, false], [80, 81, 81, true],
    [81, 81, 81, true], [90, 80, 81, false], [100, 92, 81, true]];
  const result = run(cases.map(([baseline, current], i) => fixture(`team-${i}`, baseline, current)));
  for (let i = 0; i < cases.length; i++) {
    const [baseline, score, target, met] = cases[i];
    const team = result.teams.find(item => item.name === `team-${i}`);
    assert.equal(team.baselineScore, baseline); assert.equal(team.score, score);
    assert.equal(team.targetScore, target); assert.equal(team.met, met);
    assert.equal(team.status, met ? 'met' : 'not-met');
    assert.equal(team.remaining, Math.max(0, target - score));
    assert.equal(team.baselineLeader, baseline >= 81);
  }
  assert.equal(result.total, 10); assert.equal(result.comparable, 10);
  assert.equal(result.met, 5); assert.equal(result.notMet, 5);
  assert.equal(result.leaders, 3); assert.equal(result.share, 0.5);
});

test('missing, invalid or ambiguous comparisons remain unknown rather than becoming a zero baseline or a missed goal', () => {
  const item = fixture('Known leader', 90, 92);
  const original = structuredClone(item);
  const checkUnknown = (products, previous, rows) => {
    const result = buildSummaryGoalProgress(products, previous, rows);
    assert.equal(result.total, 1); assert.equal(result.comparable, 0); assert.equal(result.met, 0);
    assert.equal(result.notMet, 0); assert.equal(result.noComparison, 1); assert.equal(result.share, null);
    const team = result.teams[0];
    assert.equal(team.baselineScore, null); assert.equal(team.targetScore, null);
    assert.equal(team.met, null); assert.equal(team.remaining, null); assert.equal(team.status, 'no-comparison');
    return result;
  };
  assert.equal(checkUnknown([item.current], [], [item.row]).leaders, 1, 'a current leader without a baseline still counts as a current leader');
  checkUnknown([item.current], [item.previous], []);
  checkUnknown([item.current], [item.previous], [item.row, item.row]);
  checkUnknown([item.current], [item.previous, item.previous], [item.row]);
  for (const change of [{name: 'Other'}, {unit: 'Other'}, {type: 'Канал'}, {id: 'Other'}]) {
    checkUnknown([item.current], [{...item.previous, ...change}], [item.row]);
  }
  for (const score of [null, undefined, NaN, -1, 101]) {
    checkUnknown([item.current], [item.previous], [{...item.row, score}]);
  }
  for (const value of [null, undefined, NaN]) {
    const current = structuredClone(item.current); current.metrics[0].metrics[0].value = value;
    const result = checkUnknown([current], [item.previous], [item.row]);
    assert.equal(result.teams[0].score, null); assert.equal(result.leaders, 0);
  }
  assert.deepEqual(item, original, 'comparison checks do not mutate products or published baseline rows');
});

test('unit groups partition the current quarter and empty or unsupported scopes have no invented rate', () => {
  const cases = [fixture('A', 39, 40, 'CX'), fixture('B', 50, 60, 'CX'), fixture('C', 90, 92, 'PC')];
  const products = [...cases.map(item => item.current), cases[0].previous];
  const previous = cases.map(item => item.previous), rows = cases.map(item => item.row);
  const snapshot = structuredClone({products, previous, rows});
  const all = buildSummaryGoalProgress(products, previous, rows, period);
  assert.equal(all.total, 3); assert.equal(all.met, 2); assert.equal(all.notMet, 1); assert.equal(all.groups.length, 2);
  assert.equal(all.baselinePeriod, previousPeriod); assert.equal(all.supported, true);
  for (const key of ['total', 'comparable', 'met', 'notMet', 'noComparison', 'leaders']) {
    assert.equal(all.groups.reduce((sum, group) => sum + group[key], 0), all[key], key);
  }
  assert.deepEqual(new Set(all.groups.flatMap(group => group.teams.map(team => team.id))), new Set(all.teams.map(team => team.id)));
  const cx = buildSummaryGoalProgress(products, previous, rows, period, 'CX');
  assert.equal(cx.total, 2); assert.equal(cx.met, 1); assert.equal(cx.share, 0.5);
  assert.deepEqual(cx.groups.map(group => group.unit), ['CX']);
  for (const empty of [buildSummaryGoalProgress([], previous, rows), buildSummaryGoalProgress(products, previous, rows, period, 'Unknown')]) {
    assert.equal(empty.total, 0); assert.equal(empty.share, null); assert.deepEqual(empty.teams, []); assert.deepEqual(empty.groups, []);
  }
  for (const oldPeriod of [previousPeriod, 'IV кв. 2026']) {
    const result = buildSummaryGoalProgress(products, previous, rows, oldPeriod);
    assert.equal(result.supported, false); assert.equal(result.total, 0); assert.equal(result.share, null);
    assert.deepEqual(result.teams, []); assert.deepEqual(result.groups, []);
  }
  assert.deepEqual({products, previous, rows}, snapshot);
});

test('the actual App roster counts 43 individual goals without double-counting growth and current leadership', () => {
  const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const data = read('../../public/report-data.json');
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(match => [match[1], match[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
  const products = buildDdiPeriodProducts(data.products, period, overlays,
    ...['salary-products-q3-2026.json', 'reporting-regularity-missing-q3-2026.json', 'funnel-action-missing-q3-2026.json'].map(file => read(`../data/${file}`)),
    read('../../public/backlog-data.json'));
  const result = buildSummaryGoalProgress(products, data.products, data.title.rows, period);
  assert.equal(result.total, 76); assert.equal(result.comparable, 76); assert.equal(result.met, 43);
  assert.equal(result.notMet, 33); assert.equal(result.noComparison, 0); assert.equal(result.leaders, 7);
  assert.equal(result.share, 43 / 76); assert.equal(result.groups.length, 8);
  assert.equal(new Set(result.teams.map(team => team.id)).size, 76);
  const level = score => score < 40 ? 0 : score < 61 ? 1 : score < 81 ? 2 : 3;
  const grown = result.teams.filter(team => level(team.score) > level(team.baselineScore));
  const overlap = grown.filter(team => team.score >= 81);
  assert.equal(grown.length, 41); assert.equal(overlap.length, 5);
  assert.equal(grown.length + result.leaders - overlap.length, result.met);
  const originalLeaders = result.teams.filter(team => team.baselineScore >= 81);
  assert.equal(originalLeaders.length, 2); assert.ok(originalLeaders.every(team => team.met && team.targetScore === 81));
  for (const group of result.groups) {
    const scoped = buildSummaryGoalProgress(products, data.products, data.title.rows, period, group.unit);
    for (const key of ['total', 'comparable', 'met', 'notMet', 'noComparison', 'leaders', 'share']) assert.equal(scoped[key], group[key], `${group.unit}: ${key}`);
    assert.deepEqual(scoped.teams, group.teams);
  }
});
