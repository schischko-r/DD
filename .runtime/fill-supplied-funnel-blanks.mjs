import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {products, source, salary} from './audit-missing-scores.mjs';
const codes = ['churn.funnel_analysis', 'churn.nastroena_otchetnostь', 'churn.report_completeness',
  'attract.funnel_analysis', 'attract.nastroena_otchetnostь', 'attract.report_completeness'];
const inputs = [
  {name: 'Трансграничный эквайринг', sourceName: 'Трансграничный эквайринг #B2C', values: [0.5, 0, 0, 0, 0, 0.5]},
  {name: 'БПИФ', sourceName: 'БПИФ', values: [1, 1, 0.5, 1, 1, 1]},
];
const records = [], sourceRows = [];
for (const [teamIndex, input] of inputs.entries()) {
  const product = products.find((item) => item.name === input.name);
  const original = source.products.find((item) => item.name === input.name);
  assert.ok(product && original);
  const metrics = {};
  for (const [index, code] of codes.entries()) {
    const metric = product.metrics.flatMap((block) => block.metrics).find((item) => item.code === code);
    assert.ok(metric);
    const row = {row: teamIndex * codes.length + index + 1, sourceName: input.sourceName,
      code, name: metric.name, rawValue: input.values[index], previousValue: metric.value, maxValue: metric.max_value};
    if (metric.is_applicabble_flg === false || !(metric.max_value > 0)) {
      row.status = 'preservedNonApplicable';
    } else if (metric.value !== null && metric.value !== undefined && metric.value !== '') {
      row.status = 'preservedExistingScore';
    } else {
      assert.notEqual(metric.is_applicabble_flg, false);
      assert.ok(metric.max_value > 0);
      row.status = 'filledMissingScore';
      metrics[code] = {rawValue: row.rawValue, source: {
        origin: 'userConfirmedMissingFunnelFill20261031', confirmedBy: 'user', date: '2026-10-31',
        period: salary.period, sourceName: input.sourceName, sourceMetricName: metric.name,
        inputRow: row.row, inputColumn: 'last', previousValue: null,
        rule: 'По указанию пользователя последнее число строки применяется только к пустой оценке. Ранее заполненные оценки, включая ноль, сохраняются.',
      }};
    }
    sourceRows.push(row);
  }
  if (Object.keys(metrics).length) records.push({id: original.id, name: original.name, unit: original.unit, type: original.type, metrics});
}
assert.equal(sourceRows.filter((row) => row.status === 'filledMissingScore').length, 2);
assert.equal(sourceRows.filter((row) => row.status === 'preservedExistingScore').length, 9);
assert.equal(sourceRows.filter((row) => row.status === 'preservedNonApplicable').length, 1);
const data = {period: salary.period, scope: 'funnel-user-assessment',
  source: {origin: 'userConfirmedMissingFunnelFill20261031', confirmedBy: 'user', date: '2026-10-31',
    rule: 'Заполнять только пустые. Брать последнее число каждой строки. Уже заполненные значения не менять.'},
  products: records, sourceRows};
writeFileSync(new URL('./before-funnel-blank-fill.json', import.meta.url), JSON.stringify(products));
writeFileSync(new URL('../gravity-app/src/data/funnel-missing-user-fill-q3-2026.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify(sourceRows, null, 2));
