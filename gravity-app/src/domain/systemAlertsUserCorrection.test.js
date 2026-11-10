import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts, buildDdiCohortProducts} from './quarterProfiles.js';
import {buildSummaryPeriodData} from './summaryPeriod.js';
import {buildSummaryRadarData} from './summaryRadar.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const period = 'III кв. 2026';
const code = 'alerts.system_failures';
const targetTeams = new Set([
  'Зарплатный продукт', 'Сделка ИЖС', 'ОМС', 'Слитки', 'Трансграничные переводы',
  'СберПрайм', 'СберЧаевые', 'Трансграничный эквайринг', 'ДСЖ КК', 'ЗПИФ',
  'ОПИФ', 'Кредитный потенциал', 'Конверсия', 'Личная защита Плюс',
]);
const metrics = (product) => product.metrics.flatMap((block) => block.metrics || []);

test('confirmed full system alerts affect only the 14 Q3 teams, preserve Q2 and both salary cohorts, and reproduce dashboard level changes', () => {
  const source = read('../../public/report-data.json');
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)]
    .map((match) => [match[1], match[2]]));
  const overlayNames = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
    .map((key) => imports.get(key.trim()));
  assert.ok(overlayNames.every(Boolean));
  const overlays = overlayNames.map((name) => read(`../data/${name}`));
  const salary = read('../data/salary-products-q3-2026.json');
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  const backlog = read('../../public/backlog-data.json');
  const baselineOverlays = structuredClone(overlays);
  const baselineBatch = baselineOverlays[overlayNames.indexOf('alerts-benchmarks-user-q3-2026.json')];
  let restored = 0;
  for (const team of baselineBatch.products.filter((team) => targetTeams.has(team.name))) {
    const fact = team.metrics[code];
    assert.equal(fact.rawValue, 1, team.name);
    assert.equal(fact.source.correction.origin, 'userConfirmedQ3ScoreCorrection');
    assert.equal(fact.source.correction.previousRawValue, 0.5);
    assert.equal(fact.source.correction.rawValue, 1);
    fact.rawValue = 0.5;
    delete fact.source.correction;
    restored++;
  }
  assert.equal(restored, 14);
  const inputSnapshot = JSON.stringify({source, overlays, baselineOverlays, salary, reporting, actions, backlog});
  const build = (assessments, selectedPeriod = period) => buildDdiPeriodProducts(
    source.products, selectedPeriod, assessments, salary, reporting, actions, backlog,
  );
  const before = build(baselineOverlays);
  const after = build(overlays);
  assert.equal(after.length, 76);
  assert.equal(before.length, after.length);
  const changed = [];
  for (const product of after) {
    const prior = before.find((old) => old.id === product.id);
    assert.ok(prior);
    assert.equal(product.indexMaxPoints, prior.indexMaxPoints, product.name);
    for (const metric of metrics(product)) {
      const old = metrics(prior).find((item) => item.code === metric.code);
      if (!targetTeams.has(product.name) || metric.code !== code) {
        assert.deepEqual(metric, old, `${product.name} / ${metric.code}`);
        continue;
      }
      assert.equal(old.value, 0.5);
      assert.equal(metric.value, 1);
      for (const key of ['max_value', 'is_applicabble_flg', 'excluded_from_index', 'dd_calculation_flg']) {
        assert.equal(metric[key], old[key], `${product.name} / ${key}`);
      }
      changed.push(product.name);
    }
  }
  assert.deepEqual(changed.sort(), [...targetTeams].sort());
  assert.deepEqual(build(overlays, 'II кв. 2026'), source.products);
  assert.deepEqual(build(overlays, 'II кв. 2026'), build(baselineOverlays, 'II кв. 2026'));
  const cohorts = buildDdiCohortProducts(source.products, period, overlays, salary, reporting, actions)
    .filter((product) => product.name.startsWith('Зарплатный продукт #'));
  assert.equal(cohorts.length, 2);
  for (const cohort of cohorts) assert.equal(metrics(cohort).find((metric) => metric.code === code).value, 1);

  const rows = (products) => buildSummaryPeriodData(source.products, source.title.rows, products, period).rows;
  const oldRows = rows(before);
  const newRows = rows(after);
  const average = (items) => {
    const scored = items.filter((row) => Number.isFinite(row.score));
    assert.equal(scored.length, 76);
    return Math.round(scored.reduce((sum, row) => sum + row.score, 0) / scored.length);
  };
  assert.equal(average(oldRows), 63);
  assert.equal(average(newRows), 64);
  const alerts = (products) => buildSummaryRadarData(products, period, '', [{code: 'alerts', name: 'Оповещения'}]).points[0].b2c;
  assert.equal(alerts(before), 69);
  assert.equal(alerts(after), 74);
  const transitions = newRows.flatMap((row) => {
    const prior = oldRows.find((old) => old.name === row.name && old.unit === row.unit && old.type === row.type);
    return row.group === prior.group ? [] : [{unit: row.unit, name: row.name,
      before: prior.score, after: row.score, oldLevel: prior.group, newLevel: row.group}];
  });
  assert.deepEqual(transitions, [{unit: 'DB', name: 'Трансграничные переводы', before: 39, after: 42,
    oldLevel: 'Требуют внимания', newLevel: 'Развивающиеся'}]);
  assert.equal(JSON.stringify({source, overlays, baselineOverlays, salary, reporting, actions, backlog}), inputSnapshot);
});
