import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
import {excludeRemovedTeams} from './report.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const source = excludeRemovedTeams(read('../../public/report-data.json')).products;
const assessment = read('../data/campaign-missing-zero-q3-2026.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').filter((key) => imports.get(key.trim()) !== 'domclick-self-service-q3-2026.json').map((key) => read(`../data/${imports.get(key.trim())}`));
const metrics = (p) => p.metrics.flatMap((b) => b.metrics);

test('43 applicable blanks across 17 teams become explicit Q3 zeros, preserving every other score and Q2', () => {
  const snapshot = JSON.stringify({source, overlays});
  const before = buildTeamProfileProducts(source, assessment.period, overlays.filter((o) => o.scope !== assessment.scope));
  const after = buildTeamProfileProducts(source, assessment.period, overlays);
  const counts = Object.fromEntries(Object.keys(assessment.counts.byMetric).map((code) => [code, 0]));
  let teams = 0;
  for (let i = 0; i < after.length; i++) {
    const product = after[i], old = before[i];
    const facts = assessment.products.find((t) => t.id === product.id.replace(/::empty::.*/, ''));
    assert.equal(product.indexMaxPoints, old.indexMaxPoints);
    if (!facts) {assert.deepEqual(product, old); continue;}
    teams++;
    for (const metric of metrics(product)) {
      const prior = metrics(old).find((m) => m.code === metric.code);
      if (!facts.metrics[metric.code]) {assert.deepEqual(metric, prior); continue;}
      assert.equal(prior.value, null);
      assert.ok(prior.max_value > 0);
      assert.notEqual(prior.is_applicabble_flg, false);
      assert.equal(metric.value, 0);
      assert.equal(metric.max_value, prior.max_value);
      assert.equal(metric.is_applicabble_flg, prior.is_applicabble_flg);
      assert.equal(metric.source.origin, 'userConfirmedMissingAsZero');
      counts[metric.code]++;
    }
  }
  assert.equal(teams, 17);
  assert.deepEqual(Object.values(counts), [11, 10, 11, 11]);
  assert.deepEqual(counts, assessment.counts.byMetric);
  for (const p of after) for (const m of metrics(p)) {
    if (Object.hasOwn(counts, m.code) && m.is_applicabble_flg !== false && m.max_value > 0) assert.ok(Number.isFinite(m.value));
  }
  assert.deepEqual(buildTeamProfileProducts(source, 'II кв. 2026', overlays), source);
  assert.equal(JSON.stringify({source, overlays}), snapshot);
});

test('explicit campaign assessments preserve prior corrections and update DСЖ КК only in Q3', () => {
  const manual = read('../data/campaign-user-assessments-q3-2026.json');
  assert.deepEqual(manual.products.map((p) => p.name).sort(), ['БПИФ', 'ДСЖ КК', 'ОСАГО']);
  const before = buildTeamProfileProducts(source, manual.period, overlays.filter((o) => o.scope !== manual.scope));
  const after = buildTeamProfileProducts(source, manual.period, overlays);
  for (let i = 0; i < after.length; i++) {
    const current = after[i], old = before[i];
    const record = manual.products.find((p) => p.id === current.id.replace(/::empty::.*/, ''));
    if (!record) {assert.deepEqual(current, old); continue;}
    for (const [code, fact] of Object.entries(record.metrics)) {
      const result = metrics(current).find((m) => m.code === code);
      const prior = metrics(old).find((m) => m.code === code);
      assert.equal(result.value / result.max_value, fact.rawValue);
      assert.equal(result.max_value, prior.max_value);
      assert.equal(result.source.origin, fact.source.origin);
    }
    assert.equal(current.indexMaxPoints, old.indexMaxPoints);
    assert.deepEqual(metrics(current).filter((m) => !record.metrics[m.code]), metrics(old).filter((m) => !record.metrics[m.code]));
  }
  const codes = ['attract.campaign_launches', 'attract.nalichie_self_service', 'attract.nalichie_uspeshnyh_biznes_zapuskov'];
  for (const [name, values] of [['ОПИФ', [0, 0, 0]], ['ДСЖ КК', [0, 0, 1]]]) {
    const team = after.find((p) => p.name === name);
    assert.deepEqual(codes.map((code) => {const m = metrics(team).find((m) => m.code === code); return m.value / m.max_value;}), values);
  }
  assert.deepEqual(buildTeamProfileProducts(source, 'II кв. 2026', overlays), source);
});
