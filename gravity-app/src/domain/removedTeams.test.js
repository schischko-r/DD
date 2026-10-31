import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {excludeRemovedTeams} from './report.js';
import {buildTeamProfileProducts} from './teamProfileSelection.js';

test('DU is absent from report rows and both quarter selectors without altering other teams', () => {
  const source = JSON.parse(readFileSync(new URL('../../public/report-data.json', import.meta.url)));
  const snapshot = JSON.stringify(source);
  const report = excludeRemovedTeams(source);
  assert.ok(source.products.some((team) => team.name === 'ДУ'));
  assert.deepEqual(report.products, source.products.filter((team) => team.name !== 'ДУ'));
  assert.deepEqual(report.title.rows, source.title.rows.filter((team) => team.name !== 'ДУ'));
  for (const period of ['II кв. 2026', 'III кв. 2026']) {
    const teams = buildTeamProfileProducts(report.products, period);
    assert.ok(teams.length);
    assert.ok(!teams.some((team) => team.name === 'ДУ'));
  }
  assert.equal(JSON.stringify(source), snapshot);
});
