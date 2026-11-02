import test from 'node:test';
import assert from 'node:assert/strict';
import {isPostSnapshotExternalAssessment} from './test-fixtures/assessmentBatches.js';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
import {excludeRemovedTeams, isDdIndexMetric} from './report.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = excludeRemovedTeams(read('../../public/report-data.json')).products;
const manual = read('../data/mechanics-user-assessments-q3-2026.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => imports.get(key.trim()))
  // Isolate the original batch; later explicit reassessments have an independent current-profile audit.
  .filter((file) => !isPostSnapshotExternalAssessment(file))
  .map((file) => read(`../data/${file}`));
const metrics = (p) => p.metrics.flatMap((b) => b.metrics);

test('87 Q3 mechanics assessments use existing weights, preserving all other values, Q2 and corporate non-applicability', () => {
  const snapshot = JSON.stringify({source, overlays});
  const before = buildTeamProfileProducts(source, manual.period, overlays.filter((o) => o.scope !== manual.scope));
  const after = buildTeamProfileProducts(source, manual.period, overlays);
  let facts = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], old = before[i];
    const record = manual.products.find((p) => p.id === current.id.replace(/::empty::.*/, ''));
    assert.equal(current.indexMaxPoints, old.indexMaxPoints);
    if (!record) {assert.deepEqual(current, old); continue;}
    for (const m of metrics(current)) {
      const prior = metrics(old).find((p) => p.code === m.code);
      const fact = record.metrics[m.code];
      if (!fact) {assert.deepEqual(m, prior); continue;}
      facts++;
      assert.equal(m.value, fact.rawValue * m.max_value, `${current.name} / ${m.code}`);
      assert.equal(m.max_value, prior.max_value);
      assert.equal(m.is_applicabble_flg, prior.is_applicabble_flg);
      assert.equal(m.source.origin, 'userConfirmedMechanicsAssessment');
      const baseline = source.find((p) => p.id === record.id);
      assert.equal(m.previousValue, metrics(baseline).find((p) => p.code === m.code).value);
    }
  }
  assert.equal(facts, 87);
  assert.equal(manual.products.length, 57);
  const corporate = after.find((p) => p.name === 'Залоговое страхование (корпоративное страхование)');
  for (const code of ['mehaniki.vozvrat_klientov', 'mehaniki.uderzhanie_klientov']) {
    assert.equal(isDdIndexMetric(metrics(corporate).find((m) => m.code === code)), false);
  }
  assert.deepEqual(buildTeamProfileProducts(source, 'II кв. 2026', overlays), source);
  assert.equal(JSON.stringify({source, overlays}), snapshot);
});

test('all literal rows are accounted for; conflicting return scores stay unchanged while agreed fields apply', () => {
  assert.equal(manual.sourceRows.length, 99);
  assert.equal(manual.sourceRows.filter((row) => row.status === 'pending').length, 6);
  assert.equal(manual.pending.length, 3);
  assert.deepEqual(manual.pending.map((p) => p.name).sort(), ['Зарплатный продукт', 'ОМС', 'Слитки']);
  for (const row of manual.sourceRows.filter((r) => r.status === 'applied')) {
    const fact = manual.products.find((p) => p.id === row.id).metrics[row.metricCode];
    assert.equal(fact.source.previousAssessment?.rawValue ?? fact.rawValue, row.rawValue);
    assert.ok(fact.source.sourceRows.includes(row.row));
  }
  const before = buildTeamProfileProducts(source, manual.period, overlays.filter((o) => o.scope !== manual.scope));
  const after = buildTeamProfileProducts(source, manual.period, overlays);
  const get = (data, name, code) => metrics(data.find((p) => p.name === name)).find((m) => m.code === code);
  for (const pending of manual.pending) {
    assert.deepEqual(get(after, pending.name, pending.metricCode), get(before, pending.name, pending.metricCode));
    assert.equal(manual.products.find((p) => p.id === pending.id).metrics[pending.metricCode], undefined);
  }
  for (const [name, code, raw] of [
    ['Детская карта', 'mehaniki.vozvrat_klientov', 0.5],
    ['Единый личный кабинет (ЕЛК)', 'mehaniki.personalizaciya_interfeysa_kontenta', 0.5],
    ['Чат', 'mehaniki.uderzhaniya_klienta', 1],
    ['Колл-центр', 'mehaniki.uderzhaniya_klienta', 0],
    ['Зарплатный продукт', 'mehaniki.doprodazhi_up_sell', 0],
    ['ОМС', 'mehaniki.doprodazhi_up_sell', 1],
    ['Слитки', 'mehaniki.uderzhanie_klientov', 0],
  ]) assert.equal(get(after, name, code).value / get(after, name, code).max_value, raw);
});

test('scope stays within the requested mechanics, ignores max overrides and requires exact identity', () => {
  const team = source.find((p) => p.name === 'Детская карта');
  const code = 'mehaniki.vozvrat_klientov';
  const fake = {period: manual.period, scope: manual.scope, metricMaxOverrides: {[code]: 999},
    products: [{...team, metrics: {[code]: {rawValue: 0.5}, 'mehaniki.cross_sell': {rawValue: 0.5}, 'goals.monitored': {rawValue: 1}}}]};
  const after = buildTeamProfileProducts([team], manual.period, fake)[0];
  assert.equal(metrics(after).find((m) => m.code === code).max_value, 1);
  assert.equal(metrics(after).find((m) => m.code === code).value, 0.5);
  assert.equal(metrics(after).find((m) => m.code === 'mehaniki.cross_sell').value, null);
  assert.equal(metrics(after).find((m) => m.code === 'goals.monitored').value, null);
  fake.products[0].unit = 'wrong unit';
  assert.deepEqual(buildTeamProfileProducts([team], manual.period, fake), buildTeamProfileProducts([team], manual.period));
});
