import test from 'node:test';
import assert from 'node:assert/strict';
import {isPostSnapshotExternalAssessment} from './test-fixtures/assessmentBatches.js';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts, metricActualGrowth} from './teamProfileSelection.js';
import {excludeRemovedTeams, isDdIndexMetric} from './report.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = excludeRemovedTeams(read('../../public/report-data.json')).products;
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
  .filter((key) => !isPostSnapshotExternalAssessment(imports.get(key.trim())))
  .map((key) => read(`../data/${imports.get(key.trim())}`));
const manual = read('../data/user-metric-assessments-q3-2026.json');
const metrics = (p) => p.metrics.flatMap((b) => b.metrics);

test('user assessments apply weighted scores to exact teams in Q3 and preserve all unrelated metrics and Q2', () => {
  const snapshot = JSON.stringify({source, overlays});
  const before = buildTeamProfileProducts(source, manual.period, overlays.filter((o) => o.scope !== manual.scope));
  const after = buildTeamProfileProducts(source, manual.period, overlays);
  let facts = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], old = before[i];
    const record = manual.products.find((p) => p.id === current.id.replace(/::empty::.*/, ''));
    if (!record) {assert.deepEqual(current, old); continue;}
    for (const m of metrics(current)) {
      const prior = metrics(old).find((p) => p.code === m.code);
      const fact = record.metrics[m.code];
      if (!fact) {assert.deepEqual(m, prior); continue;}
      facts++;
      assert.equal(m.value, fact.rawValue * m.max_value);
      assert.equal(m.source.origin, 'userConfirmedMetricAssessment');
      if (prior) {
        assert.equal(m.max_value, prior.max_value);
        assert.equal(m.is_applicabble_flg, prior.is_applicabble_flg);
        const original = source.find((p) => p.id === record.id);
        assert.equal(m.previousValue, metrics(original).find((p) => p.code === m.code).value);
      } else {
        assert.equal(current.name, 'СберСпасибо');
        assert.equal(m.code, 'churn.benchmarks');
        assert.equal(m.max_value, 0.5);
        assert.equal(m.value, 0);
        assert.equal(m.previousValue, undefined);
      }
    }
    assert.equal(current.indexMaxPoints, metrics(current).filter(isDdIndexMetric).reduce((sum, m) => sum + m.max_value, 0));
    assert.equal(current.indexMaxPoints - old.indexMaxPoints, current.name === 'СберСпасибо' ? 0.5 : 0);
  }
  assert.equal(facts, 175);
  assert.equal(facts, manual.counts.facts);
  assert.equal(manual.products.length, 64);
  assert.deepEqual(buildTeamProfileProducts(source, 'II кв. 2026', overlays), source);
  assert.equal(JSON.stringify({source, overlays}), snapshot);
});

test('half scores and uplifts use existing weights; unanswered conflicts do not become assessments', () => {
  const products = buildTeamProfileProducts(source, manual.period, overlays);
  const get = (name, code) => metrics(products.find((p) => p.name === name)).find((m) => m.code === code);
  assert.equal(get('СберKids', 'attract.benchmarks').value, 0.25);
  assert.equal(get('Top Affluent', 'general.sredniy_dohoda_na_klienta').value, get('Top Affluent', 'general.sredniy_dohoda_na_klienta').max_value);
  const kid = products.find((p) => p.name === 'СберKids');
  const growth = metricActualGrowth(get('СберKids', 'attract.benchmarks'), kid.indexMaxPoints, manual.period);
  assert.equal(growth.pointsDelta, 0.25);
  assert.equal(growth.indexPctDelta, 0.25 / kid.indexMaxPoints * 100);
  for (const [name, code] of [['ОМС', 'alerts.business_metrics'], ['Слитки', 'alerts.business_metrics'], ['SberPay Ecom', 'attract.benchmarks']]) {
    const record = manual.products.find((p) => p.name === name);
    assert.equal(record.metrics[code], undefined);
    assert.equal(manual.pending.filter((p) => p.name === name && p.metricCode === code).length, 1);
  }
  assert.equal(manual.pending.filter((p) => p.name.includes('#B2B')).length, 4);
});

test('manual scope rejects other codes, mismatched identity and modifications to Q2', () => {
  const team = source.find((p) => p.name === 'СБОЛ');
  const fake = {period: manual.period, scope: manual.scope, products: [{...team, metrics: {
    'hyp.discovery_40_backlog': {rawValue: 1}, 'alerts.business_metrics': {rawValue: 0.5},
  }}]};
  const base = buildTeamProfileProducts([team], manual.period);
  const modified = buildTeamProfileProducts([team], manual.period, fake);
  assert.equal(metrics(modified[0]).find((m) => m.code === 'hyp.discovery_40_backlog').value, null);
  assert.equal(metrics(modified[0]).find((m) => m.code === 'alerts.business_metrics').value, 0.5);
  fake.products[0].unit = 'wrong unit';
  assert.deepEqual(buildTeamProfileProducts([team], manual.period, fake), base);
  assert.deepEqual(buildTeamProfileProducts([team], 'II кв. 2026', fake), [team]);
});
