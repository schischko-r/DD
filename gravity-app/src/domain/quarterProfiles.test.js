import test from 'node:test';
import assert from 'node:assert/strict';
import {salaryBeforeMechanicsConfirmation} from './test-fixtures/salaryMechanicsStage.js';
import {readFileSync} from 'node:fs';
// Legacy cohort contract is tested separately from the current merged product.
import {buildDdiCohortProducts as buildDdiPeriodProducts, Q3_DB_COHORT_TEAMS as Q3_DB_TEAMS} from './quarterProfiles.js';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
import {excludeRemovedTeams, isDdIndexMetric} from './report.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = read('../../public/report-data.json').products;
const salary = salaryBeforeMechanicsConfirmation(read('../data/salary-products-q3-2026.json'));
const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`));
const metrics = (p) => p.metrics.flatMap((b) => b.metrics);

test('Q2 restores DU in УБ and stays byte-for-byte unchanged; Q3 has precisely the 17 requested DB teams', () => {
  const snapshot = JSON.stringify({source, salary, overlays});
  const q2 = buildDdiPeriodProducts(source, 'II кв. 2026', overlays, salary);
  assert.deepEqual(q2, source);
  assert.equal(q2.length, 83);
  assert.ok(q2.some((p) => p.name === 'ДУ' && p.unit === 'УБ'));
  assert.equal(q2.filter((p) => p.name === 'Зарплатный продукт').length, 1);
  const q3 = buildDdiPeriodProducts(source, salary.period, overlays, salary);
  assert.equal(q3.length, 77);
  assert.deepEqual(q3.filter((p) => p.unit === 'DB').map((p) => p.name).sort(), [...Q3_DB_TEAMS].sort());
  assert.equal(q3.some((p) => p.name === 'ДУ' || p.name === 'Зарплатный продукт'), false);
  for (const name of ['Военная пенсия', 'Переводы подарков', 'Сценарии оплаты', 'Транспортный эквайринг', 'Школьные сервисы', 'Как зарплатный']) {
    assert.equal(q3.some((p) => p.name === name), false);
    assert.ok(q2.some((p) => p.name === name));
  }
  assert.equal(JSON.stringify({source, salary, overlays}), snapshot);
});

test('salary survey scores belong to the named cohort; shared values retain provenance and no per-cohort Q2 is invented', () => {
  const products = buildDdiPeriodProducts(source, salary.period, overlays, salary);
  const parent = buildTeamProfileProducts(excludeRemovedTeams({products: source}).products, salary.period, overlays)
    .find((p) => p.name === 'Зарплатный продукт');
  for (const record of salary.products) {
    const team = products.find((p) => p.name === record.name);
    assert.equal(team.respondent, record.respondent);
    assert.equal(team.indexMaxPoints, parent.indexMaxPoints);
    assert.ok(team.respondent.includes(record.cohort === 'B2B' ? 'Сауткин' : 'Королева'));
    for (const metric of metrics(team)) {
      assert.equal(metric.previousValue, undefined);
      const fact = record.metrics[metric.code];
      if (fact) assert.equal(metric.value, fact.rawValue === null ? null : fact.rawValue * metric.max_value);
      else if (!/регулярность/i.test(metric.name) && metric.code !== 'mehaniki.cross_sell') {
        assert.equal(metric.value, metrics(parent).find((m) => m.code === metric.code).value);
        assert.equal(metric.source.inheritedFromTeamId, record.baseTeamId);
      }
    }
    const cross = metrics(team).find((m) => m.code === 'mehaniki.cross_sell');
    assert.equal(cross.value, 0.25);
    assert.equal(cross.crossSellComponents.during.value, 0);
    assert.equal(cross.crossSellComponents.during.source.origin, 'userConfirmedCrossSellMissingAsZero');
    assert.equal(cross.crossSellComponents.after.rawValue, 0.5);
    assert.equal(metrics(team).find((m) => m.code === 'mehaniki.vozvrat_klientov').value, null);
  }
  const b2c = products.find((p) => p.name.endsWith('продукт #B2C'));
  const b2b = products.find((p) => p.name.endsWith('продукт #B2B'));
  const get = (p, code) => metrics(p).find((m) => m.code === code).value;
  assert.equal(get(b2b, 'general.mau_produkta'), 0);
  assert.equal(get(b2c, 'general.mau_produkta'), 0.2);
  assert.equal(get(b2b, 'hyp.discovery_40_backlog'), 0);
  assert.equal(get(b2c, 'hyp.discovery_40_backlog'), 0.5);
  assert.equal(get(b2b, 'attract.nastroena_otchetnostь'), 0.25);
  assert.equal(get(b2c, 'attract.nastroena_otchetnostь'), 0.5);
  assert.equal(get(b2b, 'churn.funnel_analysis'), 0);
  assert.equal(get(b2c, 'churn.funnel_analysis'), 1);
});

test('all Q3 full reporting implies full regularity; Payments explicit regularity and applicability survive', () => {
  const products = buildDdiPeriodProducts(source, salary.period, overlays, salary);
  let checked = 0;
  for (const product of products) for (const block of product.metrics) {
    const reporting = block.metrics.find((m) => /\.nastroena_otchetnostь$/.test(m.code));
    if (!reporting || reporting.is_applicabble_flg === false || !(reporting.max_value > 0) || reporting.value !== reporting.max_value) continue;
    for (const metric of block.metrics.filter((m) => /регулярность/i.test(m.name) && m.is_applicabble_flg !== false && m.max_value > 0)) {
      checked++;
      assert.equal(metric.value, metric.max_value, `${product.name} / ${metric.code}`);
    }
  }
  assert.ok(checked > 80);
  const payments = products.find((p) => p.name === 'Платежи');
  for (const code of ['attract.regulyarnostь', 'churn.regulyarnostь']) {
    const m = metrics(payments).find((m) => m.code === code);
    assert.equal(m.value, 1);
    assert.equal(m.dd_calculation_flg, 0);
    assert.equal(isDdIndexMetric(m), false);
  }
});

test('source-backed blank fills preserve every assigned Q3 score and distinguish on-request regularity', () => {
  const before = buildDdiPeriodProducts(source, salary.period, overlays, salary);
  const after = buildDdiPeriodProducts(source, salary.period, overlays, salary, reporting);
  let filled = 0;
  for (let i = 0; i < before.length; i++) {
    const prior = before[i], current = after[i];
    assert.equal(current.indexMaxPoints, prior.indexMaxPoints);
    const facts = reporting.products.find((p) => p.id === prior.id.split('::empty::')[0]);
    for (const [index, metric] of metrics(current).entries()) {
      const old = metrics(prior)[index], fact = facts?.metrics[metric.code];
      if (!fact) assert.deepEqual(metric, old);
      else {
        assert.equal(old.value, null);
        assert.equal(metric.value, fact.rawValue * old.max_value);
        assert.equal(metric.max_value, old.max_value);
        assert.equal(metric.source.answer, fact.source.answer);
        filled++;
      }
    }
  }
  assert.equal(filled, 53);
  const salaryB2B = after.find((p) => p.name === 'Зарплатный продукт #B2B');
  assert.equal(metrics(salaryB2B).find((m) => m.code === 'attract.regulyarnostь').value, 0.5);
  assert.equal(metrics(salaryB2B).find((m) => m.code === 'churn.regulyarnostь').value, 0);
  const kids = after.find((p) => p.name === 'СберKids');
  assert.equal(metrics(kids).find((m) => m.code === 'voronka_onbordinga.regulyarnostь').value, 0.5);
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', overlays, salary, reporting), source);
});
