import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {formatNumber, selectRows, summarizeRows, decorateRows, makeCsv} from './report-model.js';

const dataset = JSON.parse(readFileSync(new URL('./report-data.json', import.meta.url), 'utf8'));
const rowsFor = scores => scores.map((pct, index) => ({id: `team-${index}`, team: `Команда ${index}`, pct}));

test('default cohorts reproduce source analysis including levels, bins and quartiles', () => {
  for (const code of ['attract', 'churn']) {
    const source = dataset.blocks[code];
    const summary = summarizeRows(selectRows(dataset, code));
    assert.equal(summary.n, 77);
    assert.deepEqual(summary.levels.map(row => row.count), code === 'attract' ? [12, 59, 6] : [25, 45, 7]);
    assert.ok(Math.abs(summary.mean - source.mean) < 1e-10);
    for (const [key, value] of Object.entries(source.percentiles)) assert.ok(Math.abs(summary.percentiles[key] - value) < 1e-10, key);
    for (const key of ['levels', 'bins', 'quartiles']) assert.deepEqual(summary[key].map(row => row.count), source[key].map(row => row.count));
    assert.deepEqual(summary.frequencies, source.frequencies);
    assert.equal(summary.bins.reduce((sum, bin) => sum + bin.count, 0), 77);
    assert.equal(summary.quartiles.reduce((sum, quartile) => sum + quartile.count, 0), 77);
  }
});

test('40 and 80 belong to the middle level, decimal neighbours retain their side', () => {
  const summary = summarizeRows(rowsFor([0, 39.9, 40, 80, 80.1, 100]));
  assert.deepEqual(summary.levels.map(row => row.count), [2, 2, 2]);
  const bins = summarizeRows(rowsFor([0, 10, 20, 90, 100])).bins;
  assert.equal(bins[0].count, 1);
  assert.equal(bins[1].count, 1);
  assert.equal(bins[2].count, 1);
  assert.equal(bins[9].count, 2);
});

test('linear percentiles interpolate; ties remain in a single quartile and share CDF', () => {
  const linear = summarizeRows(rowsFor([0, 100]));
  assert.equal(linear.percentiles.P25, 25);
  assert.equal(linear.percentiles.P50, 50);
  const rows = rowsFor([10, 10, 10, 20]);
  const decorated = decorateRows(rows, summarizeRows(rows));
  assert.deepEqual(decorated.map(row => row.quartile), [1, 1, 1, 4]);
  assert.deepEqual(decorated.map(row => row.cdf), [75, 75, 75, 100]);
  assert.deepEqual(summarizeRows(rowsFor([30, 30, 30])).quartiles.map(row => row.count), [3, 0, 0, 0]);
  assert.equal(rows[0].quartile, undefined);
});

test('empty cohort has null statistics and zero counts without invented observations', () => {
  const summary = summarizeRows([]);
  assert.equal(summary.n, 0);
  assert.equal(summary.mean, null);
  assert.deepEqual(new Set(Object.values(summary.percentiles)), new Set([null]));
  for (const key of ['levels', 'bins', 'quartiles']) for (const group of summary[key]) {
    assert.equal(group.count, 0);
    assert.equal(group.share, 0);
  }
  assert.deepEqual(summary.rows, []);
  assert.deepEqual(summary.frequencies, []);
  assert.deepEqual(decorateRows([], summary), []);
  assert.equal(formatNumber(null), '—');
  assert.equal(formatNumber(NaN), '—');
  assert.equal(formatNumber(7.56, 1), '7,6');
});

test('filters use exact unit and type, recompute the cohort, and never mutate the dataset', () => {
  const before = JSON.stringify(dataset);
  const selected = selectRows(dataset, 'attract', {unit: 'CX', type: 'Сегмент'});
  assert.ok(selected.length > 0);
  assert.ok(selected.every(row => row.unit === 'CX' && row.type === 'Сегмент'));
  summarizeRows(selected);
  decorateRows(selected);
  selected.reverse();
  assert.equal(JSON.stringify(dataset), before);
  assert.deepEqual(selectRows(dataset, 'missing'), []);
  assert.deepEqual(selectRows(dataset, 'attract', {unit: 'absent'}), []);
});

test('CSV exports only supplied rows, preserves multiline fields, and neutralizes spreadsheet formulas', () => {
  const rows = [{id: '=1+1', team: 'А;"Б"\nВ', unit: '+cmd', type: '@SUM(1)', earned: 1.25, max: 2, pct: 62.5, rawPct: 62.5},
    {id: 'safe', team: '-danger', unit: '  =cmd', type: 'Продукт', earned: -2, pct: 0}];
  const csv = makeCsv(rows, {blockLabel: '=block'});
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"А;""Б""\nВ"'));
  for (const text of ["'=1+1", "'+cmd", "'@SUM(1)", "'-danger", "'  =cmd", "'=block"]) assert.ok(csv.includes(text), text);
  assert.ok(csv.includes('"1,25"'));
  assert.ok(csv.includes('"-2"'));
  assert.equal((csv.match(/'=block/g) || []).length, 2);
  assert.equal((makeCsv([], {}).match(/\r\n/g) || []).length, 1);
  assert.deepEqual(rows[0].id, '=1+1');
});
