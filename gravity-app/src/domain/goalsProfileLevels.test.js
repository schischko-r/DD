import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {goalsProfileLevels, applyPoGoalsTemplate} from './goalsProfileLevels.js';
import {completeBlockPercent, completeProductPercent, isDdIndexMetric, isInformationalMetric} from './report.js';
const template = JSON.parse(fs.readFileSync(new URL('../data/po-goals-template-q3-2026.json', import.meta.url)));
const block = {code: 'goals', name: 'Цели', metrics: [
  {code: 'goals.monitored', name: 'Цели выведены на мониторинг', value: 0, max_value: 1, is_applicabble_flg: true, excluded_from_index: true, dd_calculation_flg: 0},
  {code: 'goals.factor_analysis_l1_l2', name: 'Факторный анализ', value: 1, max_value: 1, is_applicabble_flg: true, excluded_from_index: true, dd_calculation_flg: 0},
  {code: 'goals.forecast', name: 'Прогноз по целям', value: null, max_value: 0, is_applicabble_flg: false, hidden_from_profile: true},
]};
const product = {id: 'x', name: 'X', period: template.period, metrics: [block]};

test('indexed empty PO goals are distinct from informational LT metrics, preserve existing facts and block incomplete totals', () => {
  const snapshot = JSON.stringify(product);
  const result = applyPoGoalsTemplate([product], template.period, [template])[0];
  const display = goalsProfileLevels(result.metrics[0], template.period);
  assert.equal(display.name, 'Цели'); assert.equal(display.goalsLevels, true);
  assert.equal(display.metrics.length, 6);
  assert.deepEqual(display.metrics.slice(0, 3).map(({metric_subgroup, ...metric}) => metric), block.metrics);
  assert.ok(display.metrics.slice(0, 3).every(m => m.metric_subgroup === 'Уровень ЛЮ/ЛТ'));
  const po = display.metrics.slice(3);
  assert.deepEqual(po.map(m => m.code), ['goals.po_monitoring', 'goals.po_factor_analysis', 'goals.po_forecast']);
  assert.ok(po.every(m => m.metric_subgroup === 'Уровень PO' && m.value === null && isDdIndexMetric(m) && !isInformationalMetric(m)));
  assert.equal(result.indexMaxPoints, 3);
  assert.equal(completeBlockPercent(result.metrics[0]), null);
  assert.equal(completeProductPercent(result), null);
  assert.equal(JSON.stringify(product), snapshot);
  assert.deepEqual(applyPoGoalsTemplate([result], template.period, [template]), [result]);
});

test('Q2, absent template and other blocks retain their composition', () => {
  assert.equal(goalsProfileLevels(block, 'II кв. 2026'), block);
  const other = {...block, code: 'attract'};
  assert.equal(goalsProfileLevels(other, template.period), other);
  assert.deepEqual(applyPoGoalsTemplate([product], 'II кв. 2026', [template]), [product]);
  assert.deepEqual(applyPoGoalsTemplate([product], template.period, []), [product]);
});
