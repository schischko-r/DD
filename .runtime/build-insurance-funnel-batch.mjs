import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {products} from './audit-missing-scores.mjs';
const inputs = [
  ['ДСЖ ПК', 'churn.report_completeness', 0.5],
  ['ДСЖ КК', 'churn.report_completeness', 0.5],
  ['ЗПИФ', 'churn.report_completeness', 0.5],
  ['ОПИФ', 'churn.report_completeness', 0.5],
  ['ОПИФ', 'attract.funnel_analysis', 1],
  ['ОПИФ', 'attract.nastroena_otchetnostь', 1],
  ['ОПИФ', 'attract.report_completeness', 0.5],
  ['Залоговое страхование (корпоративное страхование)', 'churn.report_completeness', 1],
  ['Залоговое страхование (корпоративное страхование)', 'attract.funnel_analysis', 1],
  ['Страхование залога', 'churn.funnel_analysis', 0.5],
  ['Страхование залога', 'churn.nastroena_otchetnostь', 1],
  ['Страхование залога', 'churn.report_completeness', 0.5],
  ['Страхование залога', 'attract.funnel_analysis', 0.5],
  ['Страхование залога', 'attract.nastroena_otchetnostь', 1],
  ['Страхование залога', 'attract.report_completeness', 0.5],
  ['ЦФА', 'churn.nastroena_otchetnostь', 0.5],
  ['ЦФА', 'churn.report_completeness', 0.5],
  ['ЦФА', 'attract.funnel_analysis', 0.5],
  ['ЦФА', 'attract.nastroena_otchetnostь', 0],
  ['ЦФА', 'attract.report_completeness', 0],
];
const period = products[0].period;
const records = [];
for (const [index, [name, requestedCode, rawValue]] of inputs.entries()) {
  const code = requestedCode;
  const product = products.find(product => product.name === name);
  assert.ok(product, name);
  const metric = product.metrics.flatMap(block => block.metrics).find(metric => metric.code === code);
  assert.ok(metric && metric.is_applicabble_flg !== false && metric.max_value > 0, `${name} / ${code}`);
  let record = records.find(record => record.name === name);
  if (!record) {
    record = {id: product.id.split('::empty::')[0], name, unit: product.unit, type: product.type, metrics: {}};
    records.push(record);
  }
  record.metrics[code] = {rawValue, source: {
    origin: 'userConfirmedInsuranceFunnelBatch20261031', confirmedBy: 'user', date: '2026-10-31', period,
    sourceName: name, sourceMetricName: metric.name, inputRow: index + 1, inputColumn: 'last', rawValue,
    previousValue: metric.value, previousMaxValue: metric.max_value, previousAssessmentSource: metric.source || null,
    rule: 'Последняя прямая оценка пользователя из пула 20 строк. 0/0.5/1 означает долю действующего максимума; более ранние оценки заменяются.',
  }};
}
assert.equal(records.reduce((sum, record) => sum + Object.keys(record.metrics).length, 0), 20);
writeFileSync(new URL('./before-insurance-funnel-batch.json', import.meta.url), JSON.stringify(products));
writeFileSync(new URL('../gravity-app/src/data/insurance-funnel-user-q3-2026.json', import.meta.url), JSON.stringify({
  period, scope: 'funnel-user-assessment',
  source: {origin: 'userConfirmedInsuranceFunnelBatch20261031', confirmedBy: 'user', date: '2026-10-31'},
  products: records,
}, null, 2) + '\n');
console.log(`Prepared ${records.length} teams, 20 facts.`);
