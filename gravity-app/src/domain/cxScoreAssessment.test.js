import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
import {excludeRemovedTeams, isDdIndexMetric} from './report.js';
import {applyCxScoreAssessments} from './cxScoreAssessment.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = excludeRemovedTeams(read('../../public/report-data.json')).products;
const overlay = read('../data/cx-score-metrics-q3-2026.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`));
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);

test('40 user assessments affect only Q3 CX Score, with unit maxima and unchanged UX and Q2', () => {
  const snapshot = JSON.stringify({source, overlays});
  assert.equal(overlay.products.length, 40);
  assert.equal(new Set(overlay.products.map((p) => p.id)).size, 40);
  assert.deepEqual([1, 0.5, 0].map((value) => overlay.products.filter((p) => p.metrics['cx.score'].rawValue === value).length), [10, 25, 5]);
  const before = buildTeamProfileProducts(source, overlay.period, overlays.filter((o) => o.scope !== overlay.scope));
  const after = buildTeamProfileProducts(source, overlay.period, overlays);
  for (let i = 0; i < after.length; i++) {
    const current = after[i], old = before[i];
    const fact = overlay.products.find((p) => p.id === current.id.replace(/::empty::.*/, ''));
    if (!fact) {assert.deepEqual(current, old); continue;}
    const result = metrics(current).filter((m) => m.code === 'cx.score');
    assert.equal(result.length, 1);
    assert.equal(result[0].value, fact.metrics['cx.score'].rawValue);
    assert.equal(result[0].max_value, 1);
    assert.equal(isDdIndexMetric(result[0]), true);
    assert.equal(current.indexMaxPoints, metrics(current).filter(isDdIndexMetric).reduce((sum, m) => sum + m.max_value, 0));
    assert.deepEqual(metrics(current).filter((m) => m.code !== 'cx.score'), metrics(old).filter((m) => m.code !== 'cx.score'));
    for (const item of result[0].recommendation_items || []) assert.equal(item.gap, 1 - result[0].value);
  }
  for (const name of ['СБОЛ', 'СберИнвестор', 'СберKids']) {
    assert.equal(metrics(before.find((p) => p.name === name)).some((m) => m.code === 'cx.score'), false);
    assert.equal(metrics(after.find((p) => p.name === name)).filter((m) => m.code === 'cx.score').length, 1);
  }
  assert.deepEqual(buildTeamProfileProducts(source, 'II кв. 2026', overlays), source);
  assert.equal(JSON.stringify({source, overlays}), snapshot);
});

test('assessment helper enforces the exact period, scope and full team identity', () => {
  const before = buildTeamProfileProducts(source, overlay.period, []);
  for (const bad of [{...overlay, period: 'IV кв. 2026'}, {...overlay, scope: 'other'},
    {...overlay, products: overlay.products.map((p) => ({...p, unit: 'another unit'}))}]) {
    assert.deepEqual(applyCxScoreAssessments(before, overlay.period, [bad], source), before);
  }
  assert.equal(applyCxScoreAssessments(before, 'II кв. 2026', [overlay], source), before);
});
