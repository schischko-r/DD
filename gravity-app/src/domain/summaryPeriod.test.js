import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSummaryPeriodData} from './summaryPeriod.js';

const metric = (value) => ({code: 'test.score', value, max_value: 1});
const product = (name, period, value, isPlaceholder = false) => ({name, unit: 'Data', type: 'Канал', period, isPlaceholder, metrics: [{metrics: [metric(value)]}]});
test('Summary selects current profiles, preserves period choices and never uses Q2 scores for Q3', () => {
  const q2 = [product('Campaign', 'II кв. 2026', 0), product('Unknown', 'II кв. 2026', 1)];
  const rows = q2.map((p) => ({name: p.name, unit: p.unit, type: p.type, score: 80, group: 'Зрелые'}));
  const q3 = [product('Campaign', 'III кв. 2026', 1, true), product('Unknown', 'III кв. 2026', null, true)];
  const result = buildSummaryPeriodData(q2, rows, q3, 'III кв. 2026');
  assert.deepEqual(result.products.filter((p) => p.period === 'III кв. 2026'), q3);
  assert.deepEqual(result.products.filter((p) => p.period === 'II кв. 2026'), q2);
  assert.deepEqual(result.rows.map((r) => r.score), [100, null]);
  assert.equal(result.rows[1].group, 'Нет данных');
  assert.deepEqual(buildSummaryPeriodData(q2, rows, q2, 'II кв. 2026').rows, rows);
});

test('radar compares Q2 and current Q3 within the selected scope and preserves unknowns', async () => {
  const {buildSummaryRadarData} = await import('./summaryRadar.js');
  const team = (unit, period, value, isPlaceholder = false) => ({unit, period, isPlaceholder,
    metrics: [{code: 'alerts', name: 'Алерты', metrics: [metric(value)]}]});
  const data = [team('Data', 'II кв. 2026', 0.5), team('DB', 'II кв. 2026', 1),
    team('Data', 'III кв. 2026', 1, true), team('DB', 'III кв. 2026', null, true)];
  const blocks = [{code: 'alerts', name: 'Алерты'}];
  const compare = (period, unit = '') => buildSummaryRadarData(data, period, unit, blocks);
  assert.deepEqual(compare('III кв. 2026', 'Data'), {
    previousPeriod: 'II кв. 2026', hasPrevious: true,
    points: [{code: 'alerts', name: 'Алерты', previous: 50, b2c: 100, unit: 100}]});
  assert.equal(compare('III кв. 2026').points[0].previous, 75);
  assert.equal(compare('III кв. 2026', 'DB').points[0].unit, null);
  assert.equal(compare('II кв. 2026').hasPrevious, false);
});
