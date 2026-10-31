import test from 'node:test';
import assert from 'node:assert/strict';
import {applyReportingRegularity, applyReportingMissingAssessments} from './reportingRegularity.js';

test('regularity follows complete normalized reporting, including half-point and four-point maxima', () => {
  for (const max of [0.5, 1, 4]) {
    const data = [{id: 'x', name: 'Команда', metrics: [{code: 'test', metrics: [
      {code: 'test.nastroena_otchetnostь', value: max, max_value: max},
      {code: 'test.regulyarnostь', name: 'Регулярность', value: null, max_value: 1, dd_calculation_flg: 0},
    ]}]}];
    const snapshot = JSON.stringify(data);
    const result = applyReportingRegularity(data, 'III кв. 2026');
    assert.equal(result[0].metrics[0].metrics[1].value, 1);
    assert.equal(result[0].metrics[0].metrics[1].dd_calculation_flg, 0);
    assert.equal(JSON.stringify(data), snapshot);
    assert.deepEqual(applyReportingRegularity(data, 'II кв. 2026'), data);
  }
});

test('the prior full-report rule preserves all explicitly assigned regularities, including zeros and halves', () => {
  for (const value of [0, 0.5, 1]) {
    const products = [{id: 'x', metrics: [{metrics: [
      {code: 'x.nastroena_otchetnostь', value: 0.5, max_value: 0.5},
      {code: 'x.regulyarnostь', name: 'Регулярность', value, max_value: 1},
    ]}]}];
    assert.deepEqual(applyReportingRegularity(products, 'III кв. 2026'), products);
  }
});

test('missing-only assessments use existing maxima, preserve finite values and Q2, and require exact identity', () => {
  const product = {id: 'team::empty::III кв. 2026', name: 'Команда', unit: 'DB', type: 'Продукт', metrics: [{metrics: [
    {code: 'attract.nastroena_otchetnostь', value: null, max_value: 0.5, is_applicabble_flg: true},
    {code: 'attract.regulyarnostь', name: 'Регулярность', value: null, max_value: 1, dd_calculation_flg: 0},
  ]}]};
  const record = {id: 'team', name: product.name, unit: product.unit, type: product.type, metrics: {
    'attract.nastroena_otchetnostь': {rawValue: 1, expectedMaxValue: 0.5, source: {answer: 'Да, по запросу'}},
    'attract.regulyarnostь': {rawValue: 0.5, expectedMaxValue: 1, source: {answer: 'Да, по запросу'}},
  }};
  const config = {period: 'III кв. 2026', scope: 'reporting-regularity-missing-assessment', products: [record]};
  const initial = JSON.stringify({product, config});
  const result = applyReportingMissingAssessments([product], config.period, config);
  assert.deepEqual(result[0].metrics[0].metrics.map((m) => m.value), [0.5, 0.5]);
  assert.equal(result[0].metrics[0].metrics[1].dd_calculation_flg, 0);
  assert.deepEqual(applyReportingMissingAssessments(result, config.period, config), result);
  assert.deepEqual(applyReportingRegularity(result, config.period), result);
  assert.deepEqual(applyReportingMissingAssessments([product], 'II кв. 2026', config), [product]);
  assert.equal(JSON.stringify({product, config}), initial);
  for (const changed of [{unit: 'OTHER'}, {type: 'Канал'}, {name: 'Другая'}, {id: 'different'}]) {
    assert.deepEqual(applyReportingMissingAssessments([product], config.period, {...config, products: [{...record, ...changed}]}), [product]);
  }
  for (const metric of [{value: 0}, {value: 0.25}, {value: 0.5}, {is_applicabble_flg: false}, {max_value: 0}, {max_value: 1}]) {
    const changed = {...product, metrics: [{metrics: [{...product.metrics[0].metrics[0], ...metric}]}]};
    assert.deepEqual(applyReportingMissingAssessments([changed], config.period, config), [changed]);
  }
});

test('unknown, partial or non-applicable reporting never invents a regularity assessment', () => {
  for (const report of [{value: null}, {value: 0}, {value: 0.25}, {value: 0.5, is_applicabble_flg: false}]) {
    const data = [{id: 'x', metrics: [{metrics: [
      {code: 'x.nastroena_otchetnostь', max_value: 0.5, ...report},
      {code: 'x.regulyarnostь', name: 'Регулярность', value: null, max_value: 1},
    ]}]}];
    assert.deepEqual(applyReportingRegularity(data, 'III кв. 2026'), data);
  }
});
