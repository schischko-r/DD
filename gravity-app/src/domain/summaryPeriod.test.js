import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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

test('all historical Q2 teams retain their source scores despite product type capitalization, including the four Domclick products', () => {
  const data = JSON.parse(readFileSync(new URL('../../public/report-data.json', import.meta.url)));
  const period = 'II кв. 2026';
  const profiles = data.products.filter((item) => item.period === period);
  const snapshot = JSON.stringify(data);
  const result = buildSummaryPeriodData(data.products, data.title.rows, profiles, period);
  assert.equal(result.rows.length, 83);
  assert.equal(result.rows.length, profiles.length);
  for (const row of result.rows) {
    const expected = data.title.rows.find((item) => item.name === row.name && item.unit === row.unit);
    assert.deepEqual(row, expected);
  }
  const domclick = result.rows.filter((row) => row.unit === 'ДомКлик');
  assert.deepEqual(domclick.map((row) => row.score), [66, 53, 74, 69]);
  assert.equal(domclick.reduce((sum, row) => sum + row.score, 0) / domclick.length, 65.5);
  assert.deepEqual(domclick.map((row) => row.group), ['Зрелые', 'Развивающиеся', 'Зрелые', 'Зрелые']);
  assert.equal(JSON.stringify(data), snapshot);
});

test('type normalization preserves exact names, units and genuinely different team types', () => {
  const period = 'II кв. 2026';
  const current = {...product('Shared name', period, 1), unit: 'ДомКлик', type: 'Продукт'};
  const rows = [
    {name: current.name, unit: 'Other', type: 'продукт', score: 90},
    {name: current.name, unit: current.unit, type: 'Канал', score: 80},
    {name: 'Other name', unit: current.unit, type: 'продукт', score: 70},
    {name: current.name, unit: current.unit, type: '  пРоДуКт  ', score: 60},
  ];
  assert.deepEqual(buildSummaryPeriodData([current], rows, [current], period).rows, [rows[3]]);
  assert.deepEqual(buildSummaryPeriodData([current], rows.slice(0, 3), [current], period).rows, []);
});

test('case-insensitive types do not admit unlabelled scores across periods or invent Q3 placeholder scores', () => {
  const q2 = {...product('Product', 'II кв. 2026', 1), type: 'Продукт'};
  const q3 = {...q2, period: 'III кв. 2026'};
  const unlabelled = {name: q2.name, unit: q2.unit, type: 'продукт', score: 95};
  const labelled = {...unlabelled, period: q2.period, score: 65};
  assert.deepEqual(buildSummaryPeriodData([q2], [unlabelled], [q2], q2.period).rows, [unlabelled]);
  assert.deepEqual(buildSummaryPeriodData([q2, q3], [unlabelled], [q2], q2.period).rows, []);
  assert.deepEqual(buildSummaryPeriodData([q2, q3], [unlabelled, labelled], [q2], q2.period).rows, [labelled]);
  assert.deepEqual(buildSummaryPeriodData([q2, q3], [unlabelled, labelled], [q3], q3.period).rows, []);
  const unknown = {...q3, isPlaceholder: true, metrics: [{metrics: [metric(null)]}]};
  const current = buildSummaryPeriodData([q2], [unlabelled, labelled], [unknown], q3.period).rows;
  assert.equal(current.length, 1);
  assert.equal(current[0].score, null);
  assert.equal(current[0].group, 'Нет данных');
});
