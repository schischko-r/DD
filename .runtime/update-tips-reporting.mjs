import {readFileSync, writeFileSync} from 'node:fs';
const target = new URL('../gravity-app/src/data/tips-funnel-user-q3-2026.json', import.meta.url);
const data = JSON.parse(readFileSync(target, 'utf8'));
const baseline = JSON.parse(readFileSync(new URL('../gravity-app/public/report-data.json', import.meta.url), 'utf8'));
const record = data.products[0];
const prior = baseline.products.find((product) => product.id === record.id);
for (const code of ['attract.nastroena_otchetnostь', 'attract.report_completeness']) {
  const old = prior.metrics.flatMap((block) => block.metrics).find((metric) => metric.code === code);
  const fact = record.metrics[code];
  fact.source.override = {
    confirmedBy: 'user', date: '2026-10-31', fromPeriod: prior.period,
    sourceValue: old.value, sourceMaxValue: old.max_value, rawValue: old.value / old.max_value,
    previousRawValue: fact.rawValue,
    rule: 'Последнее указание пользователя: перенести отчётность и полноту воронки привлечения СберЧаевых из предыдущего опроса (II квартал). Имеет приоритет над ранее присланными нулями.',
  };
  fact.rawValue = old.value / old.max_value;
}
data.source.rule = 'Первичные шесть оценок пользователя дополнены последующим переносом отчётности и полноты привлечения из предыдущего опроса. История нулей сохранена в source.inputValues и source.override.';
writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
