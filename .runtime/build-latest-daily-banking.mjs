import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {products} from './audit-missing-scores.mjs';
writeFileSync(new URL('./before-latest-daily-banking.json', import.meta.url), JSON.stringify(products));
const rows = [
  ['SberPay Вжух', 'churn.funnel_analysis', 0, 'Вжух'],
  ['SberPay Вжух', 'attract.funnel_analysis', 1, 'Вжух'],
  ['Кредитные карты', 'churn.funnel_analysis', 0.5, 'Кредитная карта'],
  ['Кредитные карты', 'attract.funnel_analysis', 0.5, 'Кредитная карта'],
  ['Пенсионный продукт', 'churn.funnel_analysis', 1],
  ['Пенсионный продукт', 'churn.report_completeness', 0.5],
  ['Пенсионный продукт', 'attract.funnel_analysis', 1],
  ['Пенсионный продукт', 'attract.report_completeness', 0.5],
  ['Переводы по РФ', 'churn.funnel_analysis', 1],
  ['Переводы по РФ', 'churn.report_completeness', 0.5],
  ['Переводы по РФ', 'attract.funnel_analysis', 1],
  ['Переводы по РФ', 'attract.report_completeness', 0.5],
];
const mechanicRows = [
  ['Трансграничные переводы', 'mehaniki.uderzhanie_klientov', 0],
  ['Трансграничные переводы', 'mehaniki.doprodazhi_up_sell', 0],
  ['Трансграничный эквайринг', 'mehaniki.vozvrat_klientov', 0],
  ['Трансграничный эквайринг', 'mehaniki.uderzhanie_klientov', 0],
  ['Трансграничный эквайринг', 'mehaniki.doprodazhi_up_sell', 0],
];
function batch(input, scope, origin) {
  const records = [];
  for (const [index, [name, code, rawValue, alias]] of input.entries()) {
    const product = products.find(product => product.name === name);
    assert.ok(product, name);
    const metric = product.metrics.flatMap(block => block.metrics).find(metric => metric.code === code);
    assert.ok(metric?.is_applicabble_flg !== false && metric?.max_value > 0, `${name}: ${code}`);
    let record = records.find(record => record.name === name);
    if (!record) {
      record = {id: product.id.split('::empty::')[0], name, unit: product.unit, type: product.type, metrics: {}};
      records.push(record);
    }
    record.metrics[code] = {rawValue, source: {origin, confirmedBy: 'user', date: '2026-10-31', period: product.period,
      sourceName: alias || name, sourceMetricName: metric.name, inputRow: index + 1, rawValue,
      previousValue: metric.value, previousMaxValue: metric.max_value, previousAssessmentSource: metric.source || null}};
  }
  return {period: products[0].period, scope, source: {origin, confirmedBy: 'user', date: '2026-10-31'}, products: records};
}
const funnel = batch(rows, 'funnel-user-assessment', 'userConfirmedDailyBankingFunnels20261031');
const mechanics = batch(mechanicRows, 'mechanics-user-assessment', 'userConfirmedCrossBorderMechanics20261031');
const elk = products.find(product => product.name === 'Единый личный кабинет (ЕЛК)');
assert.ok(elk);
const identity = {id: elk.id.split('::empty::')[0], name: elk.name, unit: elk.unit, type: elk.type};
const elkProof = {origin: 'userConfirmedDirectNavigatorAssessment', confirmedBy: 'user', date: '2026-10-31', period: elk.period,
  teamId: identity.id, teamName: elk.name, unit: elk.unit, type: elk.type, rawValue: 1};
const elkData = {period: elk.period, scope: 'key-metrics-assessment',
  source: {origin: 'userConfirmedDirectNavigatorAssessment', confirmedBy: 'user', date: '2026-10-31'},
  products: [{...identity, metrics: {
    'general.mau_u_vashego_kanala': {rawValue: 1, source: {...elkProof, origin: 'userConfirmedElkMau20261031'}},
    'general.navigator_reporting_knowledge': {rawValue: 1, source: elkProof},
  }}]};
assert.equal(funnel.products.reduce((sum, team) => sum + Object.keys(team.metrics).length, 0), 12);
assert.equal(mechanics.products.reduce((sum, team) => sum + Object.keys(team.metrics).length, 0), 5);
for (const [file, data] of [['daily-banking-funnel-user-q3-2026.json', funnel],
  ['cross-border-mechanics-user-q3-2026.json', mechanics], ['elk-knowledge-user-q3-2026.json', elkData]]) {
  writeFileSync(new URL(`../gravity-app/src/data/${file}`, import.meta.url), JSON.stringify(data, null, 2) + '\n');
}
console.log('Prepared 12 funnel, 5 mechanics, and 2 ELK scores.');
