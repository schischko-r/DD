import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyDiscoveryBacklog, discoveryDecompositionScore} from './discoveryBacklog.js';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
const period = 'III кв. 2026', code = 'hyp.discovery_40_backlog';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const flat = p => p.metrics.flatMap(b => b.metrics);

test('exact thresholds never round a below-threshold share upward', () => {
  for (const [d, n, expected] of [[0, 100, 0], [1999, 10000, 0], [20, 100, .5], [84, 212, .5],
    [3999, 10000, .5], [40, 100, 1], [100, 100, 1]]) assert.equal(discoveryDecompositionScore(d, n), expected);
  for (const [d, n] of [[0, 0], [-1, 10], [11, 10], [null, 10], [NaN, 10], [1.5, 10]]) {
    assert.equal(discoveryDecompositionScore(d, n), null);
  }
});

test('missing, ambiguous, invalid and inapplicable decompositions preserve current scores and Q2', () => {
  const p = {name: 'Team', unit: 'CX', type: 'Сегмент', period, metrics: [{metrics: [{code, value: 1, max_value: 1, is_applicabble_flg: true}]}]};
  const board = {key: 'team', memberTeams: [{name: p.name, unit: p.unit, type: p.type}], quarters: [{key: '2026-Q3', discoveryCount: 3, createdCount: 84}]};
  const data = [p], backlog = {teams: [board]}, snapshot = JSON.stringify({data, backlog});
  const after = applyDiscoveryBacklog(data, period, backlog);
  assert.equal(flat(after[0])[0].value, 0);
  assert.equal(flat(after[0])[0].source.previousAssessmentValue, 1);
  assert.equal(JSON.stringify({data, backlog}), snapshot);
  assert.deepEqual(applyDiscoveryBacklog(after, period, backlog), after);
  assert.equal(applyDiscoveryBacklog(data, 'II кв. 2026', backlog), data);
  for (const b of [null, {teams: []}, {teams: [board, board]},
    {teams: [{...board, memberTeams: [{...board.memberTeams[0], unit: 'Other'}]}]},
    {teams: [{...board, quarters: [{...board.quarters[0], key: '2026-Q2'}]}]},
    {teams: [{...board, quarters: [{...board.quarters[0], createdCount: 0}]}]}]) {
    assert.deepEqual(applyDiscoveryBacklog(data, period, b), data);
  }
  const na = [{...p, metrics: [{metrics: [{code, value: null, max_value: 0, is_applicabble_flg: false}]}]}];
  assert.deepEqual(applyDiscoveryBacklog(na, period, backlog), na);
});

test('actual final profiles change only Discovery for current Q3 decomposition members', () => {
  const raw = read('../../public/report-data.json').products, backlog = read('../../public/backlog-data.json');
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k => read(`../data/${imports.get(k.trim())}`));
  const build = (p, data) => buildDdiPeriodProducts(raw, p, overlays, read('../data/salary-products-q3-2026.json'),
    read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json'), data);
  const before = build(period, null), after = build(period, backlog);
  let covered = 0;
  for (let i = 0; i < after.length; i++) {
    const p = after[i], old = before[i];
    const evidence = backlog.teams.flatMap(board => {
      const member = board.memberTeams.some(entry => typeof entry === 'string' ? entry.toLowerCase() === p.name.toLowerCase()
        : entry.name === p.name && (!entry.unit || entry.unit === p.unit) && (!entry.type || entry.type === p.type)
          && (!entry.period || entry.period === period));
      return member ? board.quarters.filter(q => q.key === '2026-Q3' && Number.isInteger(q.createdCount) && q.createdCount > 0
        && Number.isInteger(q.discoveryCount) && q.discoveryCount >= 0 && q.discoveryCount <= q.createdCount) : [];
    });
    const priorMetric = flat(old).find(m => m.code === code);
    if (evidence.length !== 1 || !priorMetric || priorMetric.is_applicabble_flg === false || !(priorMetric.max_value > 0)) {
      assert.deepEqual(p, old, `no valid decomposition: ${p.name}`); continue;
    }
    covered++;
    for (const m of flat(p)) {
      const prior = flat(old).find(item => item.code === m.code);
      if (m.code !== code) {assert.deepEqual(m, prior, `${p.name}/${m.code}`); continue;}
      const q = evidence[0], share = q.discoveryCount / q.createdCount;
      const expected = share >= .4 ? 1 : share >= .2 ? .5 : 0;
      assert.equal(m.value, expected * prior.max_value, p.name);
      for (const key of ['max_value', 'is_applicabble_flg', 'excluded_from_index', 'dd_calculation_flg']) assert.equal(m[key], prior[key]);
      assert.equal(m.source.origin, 'userConfirmedDiscoveryBacklogPriority20261102');
      assert.equal(m.source.createdCount, q.createdCount);
      assert.equal(m.source.discoveryCount, q.discoveryCount);
      assert.equal(m.source.previousAssessmentValue, prior.value);
      for (const item of m.recommendation_items || []) assert.equal(item.gap, m.max_value - m.value);
    }
    assert.equal(p.indexMaxPoints, old.indexMaxPoints);
    assert.deepEqual(p.salaryCohorts, old.salaryCohorts);
  }
  assert.ok(covered >= 14);
  for (const [name, expected] of [['PB', 0], ['Пакет услуг СберПремьер', .5], ['МВС', .5]]) {
    const m = flat(after.find(p => p.name === name)).find(m => m.code === code);
    assert.equal(m.value / m.max_value, expected, name);
  }
  assert.deepEqual(build('II кв. 2026', backlog), raw);
  assert.match(app, /backlog\.status === 'ready' \? backlog\.data : null/);
});
