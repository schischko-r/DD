import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeBlockPercent, isDdIndexMetric} from './report.js';
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const source = read('../../public/report-data.json').products;
const config = read('../data/goals-tribe-source-q3-2026.json');
const informational = read('../data/goals-informational-q3-2026.json');
const app = fs.readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k => read(`../data/${imports.get(k.trim())}`));
const args = [read('../data/salary-products-q3-2026.json'), read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json')];
const build = (period, batches) => buildDdiPeriodProducts(source, period, batches, ...args);
const metrics = p => p.metrics.flatMap(b => b.metrics);

test('all 76 Q3 teams use their confirmed tribe goal scores; zero denominators are excluded, all other metrics and Q2 stay intact', () => {
  const before = build(config.period, overlays.filter(o => o.source?.origin !== 'userConfirmedGoalsTribeTable'));
  const after = build(config.period, overlays);
  assert.equal(after.length, 76);
  let numeric = 0, notApplicable = 0;
  for (const p of after) {
    const assignment = config.assignments.find(t => t.name === p.name && t.unit === p.unit && t.type === p.type);
    assert.ok(assignment, p.name);
    const row = config.rows.find(r => r.unit === assignment.sourceUnit && r.tribe === assignment.sourceTribe);
    for (const [code, expected] of Object.entries(row.scores)) {
      const m = metrics(p).find(m => m.code === code);
      assert.equal(m.source.origin, 'userConfirmedGoalsTribeTable');
      assert.equal(m.source.sourceTribe, row.tribe);
      if (expected === null) {
        notApplicable++;
        assert.equal(m.value, null); assert.equal(m.max_value, 0);
        assert.equal(m.is_applicabble_flg, false); assert.equal(m.hidden_from_profile, true);
        assert.equal(isDdIndexMetric(m), false);
      } else {
        numeric++;
        assert.equal(m.value / m.max_value, expected, p.name + ' / ' + code);
        assert.equal(isDdIndexMetric(m), !informational.products.some(t => t.name === p.name && t.unit === p.unit));
      }
    }
    const old = before.find(t => t.id === p.id);
    assert.deepEqual(metrics(p).filter(m => !m.code.startsWith('goals.')), metrics(old).filter(m => !m.code.startsWith('goals.')));
    assert.equal(p.indexMaxPoints, metrics(p).filter(isDdIndexMetric).reduce((n, m) => n + m.max_value, 0));
    const goalPercent = completeBlockPercent(p.metrics.find(b => b.code === 'goals'));
    const hasMissingIndexedGoal = p.metrics.find(b => b.code === 'goals').metrics
      .some(m => isDdIndexMetric(m) && !Number.isFinite(m.value));
    assert.equal(goalPercent === null, hasMissingIndexedGoal, 'Only fully scored indexed goals permit a block percentage');
    if (p.salaryCohorts) for (const child of Object.values(p.salaryCohorts)) {
      assert.deepEqual(child.metrics.find(b => b.code === 'goals').metrics, p.metrics.find(b => b.code === 'goals').metrics);
    }
  }
  assert.equal(numeric, 218); assert.equal(notApplicable, 10);
  assert.deepEqual(build('II кв. 2026', overlays), source);
});

test('confirmed mappings distinguish zero scores from irrelevant forecasts and replace old half scores', () => {
  const products = build(config.period, overlays);
  const values = name => metrics(products.find(p => p.name === name)).filter(m => m.code.startsWith('goals.') && !m.code.startsWith('goals.po_'));
  for (const name of ['Колл-центр', 'Телемаркетинг', 'Чат']) {
    const m = values(name).find(m => m.code === 'goals.forecast');
    assert.equal(m.is_applicabble_flg, false); assert.equal(m.hidden_from_profile, true);
  }
  for (const name of ['SberID', 'Единый личный кабинет (ЕЛК)', 'Почта, Диск, Календарь', 'Зрелость', 'ДСЖ КК']) {
    assert.deepEqual(values(name).map(m => m.value / m.max_value), [1, 1, 1]);
  }
  assert.equal(values('Сделка ИЖС').find(m => m.code === 'goals.forecast').value, 0);
  assert.equal(values('Сделка ИЖС').find(m => m.code === 'goals.forecast').is_applicabble_flg, true);
});
