import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {completeProductPercent, displayProductName, filterMetricsForBlock, isDdIndexMetricForPeriod,
  isInformationalMetric, isQ3CampaignMetricHidden, isTbdMetric} from '../../gravity-app/src/domain/report.js';
import {displayMetricPercent} from '../../gravity-app/src/domain/metricPresentation.js';
import {methodologyCriteria} from '../../gravity-app/src/pages/methodologyPresentation.js';
import {methodologyVerificationComment} from '../../gravity-app/src/pages/methodologyVerification.js';

const root = new URL('../../', import.meta.url);
const directory = new URL('.', import.meta.url);
const sources = new Map();
const hash = value => createHash('sha256').update(value).digest('hex');
async function text(path) {
  const value = await readFile(new URL(path, root), 'utf8');
  sources.set(path, {path, sha256: hash(value)});
  return value;
}
const read = async path => JSON.parse(await text(path));
const periods = ['II кв. 2026', 'III кв. 2026'];
const selection = [
  {name: 'СберПрайм', unit: 'CX', type: 'Продукт'},
  {name: 'Кредитные карты', unit: 'DB', type: 'Продукт'},
];
const report = await read('gravity-app/public/report-data.json');
const app = await text('gravity-app/src/app/App.jsx');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(match => [match[1], match[2]]));
const overlayNames = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => imports.get(key.trim()));
assert.ok(overlayNames.every(Boolean));
const overlays = await Promise.all(overlayNames.map(name => read(`gravity-app/src/data/${name}`)));
const args = await Promise.all(['salary-products', 'reporting-regularity-missing', 'funnel-action-missing']
  .map(name => read(`gravity-app/src/data/${name}-q3-2026.json`)));
const backlog = await read('gravity-app/public/backlog-data.json');

const profiles = await read('gravity-app/src/data/methodologyCriteria.json');
const productMethod = profiles.find(profile => profile.key === 'product');
assert.ok(productMethod);
await text('gravity-app/src/pages/AboutPage.jsx');
const missingMethodology = 'Отдельное правило для критерия в разделе «О Data Driven» не указано.';
const methodology = new Map();
const catalog = productMethod.sections.flatMap(section => methodologyCriteria(section.body).map((criterion, index) => ({
  id: `product:${section.sourceRow}:${index}`,
  title: section.title,
  subgroup: section.subgroup,
  sourceRow: section.sourceRow,
  criterion,
  verification: methodologyVerificationComment('product', section.title, section.subgroup),
  text: [criterion.title, ...criterion.description, ...criterion.scores.map(score => `${score.label} ${score.text}`)]
    .join('\n'),
})));
const sourceCriterion = (sourceRow, index) => {
  const entry = catalog.find(item => item.sourceRow === sourceRow && item.id.endsWith(`:${index}`));
  assert.ok(entry, `Missing actual UI criterion ${sourceRow}:${index}`);
  return entry;
};
function map(codes, sourceRow, index, relation = 'criterion') {
  const entry = sourceCriterion(sourceRow, index);
  for (const code of codes) methodology.set(code, {text: entry.text, reference: entry.id, relation,
    verification: entry.verification});
}
const knowledgeCodes = ['general.obъem_celevogo_rynka_v_rossii', 'general.obъem_celevogo_rynka_v_sbere',
  'general.klienty_s_produktom', 'general.mau_produkta', 'general.znanie_produktov_sputnikov',
  'general.navigator_reporting_knowledge'];
knowledgeCodes.forEach(code => {
  // AboutPage's legacy `zones` constant is not rendered; do not present it as live methodology.
  methodology.set(code, {text: missingMethodology, reference: null, relation: 'not-in-rendered-methodology', verification: ''});
});
map(['goals.monitored', 'goals.factor_analysis_l1_l2', 'goals.forecast',
  'goals.po_monitoring', 'goals.po_factor_analysis', 'goals.po_forecast'], 2, 0, 'joint-monitoring-criterion');
map(['alerts.business_metrics', 'alerts.system_failures'], 3, 0, 'joint-alerts-criterion');
map(['attract.nastroena_otchetnostь'], 4, 0);
map(['attract.regulyarnostь'], 4, 0, 'related-reporting-criterion');
map(['attract.report_completeness'], 4, 1);
map(['churn.nastroena_otchetnostь'], 6, 0);
map(['churn.regulyarnostь'], 6, 0, 'related-reporting-criterion');
map(['churn.report_completeness'], 6, 1);
map(['attract.funnel_analysis'], 7, 0);
map(['attract.initiatives_list'], 7, 1);
map(['attract.benchmarks'], 7, 2);
map(['churn.funnel_analysis'], 9, 0);
map(['churn.deviation_actions'], 9, 1);
map(['churn.benchmarks'], 9, 2);
map(['mehaniki.uderzhanie_klientov'], 10, 0);
map(['mehaniki.vozvrat_klientov'], 10, 1);
map(['mehaniki.cross_sell'], 10, 2);
map(['mehaniki.doprodazhi_up_sell'], 10, 3);
map(['mehaniki.gibkoe_izmenenie_usloviy_produkta'], 10, 4);
map(['mehaniki.monitoring_mehanik'], 10, 5);
map(['hyp.discovery_40_backlog'], 11, 0);
map(['hyp.extra_initiatives'], 11, 1);
map(['hyp.datadriven_rating_7_5'], 11, 2);
map(['hyp.ab_tests'], 11, 3);
map(['cx.score'], 12, 0);
map(['attract.campaign_launches'], 17, 0);
map(['attract.nalichie_uspeshnyh_biznes_zapuskov'], 17, 1);
map(['attract.nalichie_self_service'], 17, 2);
map(['attract.chernoviki_v_sbol_70'], 17, 3);

for (const path of ['gravity-app/src/domain/quarterProfiles.js', 'gravity-app/src/domain/report.js',
  'gravity-app/src/domain/metricPresentation.js', 'gravity-app/src/domain/goalsProfileLevels.js',
  'gravity-app/src/domain/goalsFinalScores.js', 'gravity-app/src/features/catalog/Catalog.jsx',
  'gravity-app/src/pages/TeamProfilePage.jsx', 'gravity-app/src/pages/methodologyPresentation.js',
  'gravity-app/src/pages/methodologyVerification.js']) await text(path);

const rows = [], totals = [], auxiliaryRows = [], warnings = [];
const shortSource = source => source ? Object.fromEntries(['origin', 'file', 'sheet', 'cell', 'cells',
  'sourceName', 'sourceMetricName', 'metricCode', 'date', 'period', 'approvalGroup', 'rule', 'rawValue', 'selectedValue']
  .filter(key => source[key] !== undefined).map(key => [key, source[key]])) : null;
const subgroupFor = (product, block, metric) => block.code === 'goals' && product.period === 'III кв. 2026'
  ? metric.code.startsWith('goals.po_') ? 'Итоговая оценка — уровень PO' : 'Уровень ЛЮ/ЛТ — информационная'
  : metric.metric_subgroup || '';
function rowFor(product, block, metric, collection = 'metrics') {
  const method = methodology.get(metric.code);
  if (!method || method.relation === 'not-in-rendered-methodology') warnings.push({type: 'methodologyMissing', team: product.name, period: product.period, code: metric.code});
  const applicable = metric.is_applicabble_flg !== false && Number(metric.max_value) > 0;
  const indexed = collection === 'metrics' && isDdIndexMetricForPeriod(metric, product.period);
  const informational = isInformationalMetric(metric) || metric.excluded_from_index === true;
  const hiddenReasons = [];
  if (metric.hidden_from_profile === true) hiddenReasons.push('hidden_from_profile');
  if (isQ3CampaignMetricHidden(product, metric)) hiddenReasons.push('inapplicable-q3-campaign');
  if (!filterMetricsForBlock(block, [metric]).length) hiddenReasons.push('inapplicable-general-or-mechanics');
  const subgroup = subgroupFor(product, block, metric);
  const qualifier = `${metric.name}${subgroup && block.code === 'goals' ? ` — ${subgroup}` : informational ? ' (информационная)' : ''}`;
  const methodText = method?.text || missingMethodology;
  const methodScope = method?.relation === 'related-reporting-criterion'
    ? `${missingMethodology}\nСвязанный критерий регулярной отчётности:\n${methodText}` : methodText;
  return {product: displayProductName(product.name), team: product.name, displayTeam: displayProductName(product.name), unit: product.unit, type: product.type,
    period: product.period, blockCode: block.code, block: block.name, code: metric.code, name: metric.name,
    group: block.name, criterion: qualifier, label: qualifier,
    subgroup, collection, value: metric.value ?? null, maxValue: metric.max_value ?? null,
    applicable, applicabilityFlag: metric.is_applicabble_flg ?? null, indexed, inIndex: indexed,
    informational, ddCalculationFlag: metric.dd_calculation_flg ?? null, excludedFromIndex: metric.excluded_from_index === true,
    hidden: hiddenReasons.length > 0, hiddenReasons, tbd: isTbdMetric(metric),
    missing: applicable && !Number.isFinite(metric.value),
    displayPercent: applicable && Number.isFinite(metric.value) ? displayMetricPercent(product, metric) : null,
    methodology: methodScope + (method?.verification ? `\nИсточник оценки:\n${method.verification}` : ''),
    methodologyReference: method?.reference ?? null, methodologyRelation: method?.relation ?? 'missing',
    methodologyVerification: method?.verification || '', source: shortSource(metric.source)};
}

for (const period of periods) {
  const profiles = buildDdiPeriodProducts(report.products, period, overlays, ...args, backlog);
  for (const expected of selection) {
    const matches = profiles.filter(product => ['name', 'unit', 'type'].every(key => product[key] === expected[key]));
    assert.equal(matches.length, 1, `Exact identity ${expected.name} ${period}`);
    const product = matches[0], start = rows.length;
    for (const block of product.metrics) {
      for (const metric of block.metrics) rows.push(rowFor(product, block, metric));
      for (const metric of block.goalsPoLevelMetrics || []) auxiliaryRows.push(rowFor(product, block, metric, 'goalsPoLevelMetrics'));
    }
    const profileRows = rows.slice(start), indexedRows = profileRows.filter(row => row.indexed);
    const missingIndexed = indexedRows.filter(row => row.missing || row.tbd);
    const earned = indexedRows.reduce((sum, row) => sum + (Number.isFinite(row.value) ? row.value : 0), 0);
    const maximum = indexedRows.reduce((sum, row) => sum + row.maxValue, 0);
    const ddi = completeProductPercent(product);
    if (!missingIndexed.length) assert.equal(Math.round(earned / maximum * 100), ddi);
    const titleRows = report.title.rows.filter(row => row.name === product.name && row.unit === product.unit
      && (!row.type || row.type.toLocaleLowerCase('ru-RU') === product.type.toLocaleLowerCase('ru-RU')));
    assert.equal(titleRows.length, 1);
    const publishedQ2Score = titleRows[0].score;
    const blocks = product.metrics.map(block => {
      const selected = indexedRows.filter(row => row.blockCode === block.code);
      return {code: block.code, name: block.name, earned: selected.reduce((sum, row) => sum + (row.value ?? 0), 0),
        maximum: selected.reduce((sum, row) => sum + row.maxValue, 0), indexedRows: selected.length};
    });
    totals.push({product: displayProductName(product.name), team: product.name, displayTeam: displayProductName(product.name), unit: product.unit, type: product.type,
      period, id: product.id, earned, maximum, value: earned, maxValue: maximum, rawDdi: missingIndexed.length ? null : earned / maximum * 100,
      ddi, ddiPercent: ddi, publishedScore: period === periods[0] ? publishedQ2Score : null,
      publishedQ2Score, publishedQ2Mismatch: period === periods[0] && ddi !== publishedQ2Score,
      rowCount: profileRows.length, indexedRowCount: indexedRows.length,
      informationalRowCount: profileRows.filter(row => row.informational).length,
      inapplicableRowCount: profileRows.filter(row => !row.applicable).length,
      hiddenRowCount: profileRows.filter(row => row.hidden).length, tbdRowCount: profileRows.filter(row => row.tbd).length,
      missingIndexed: missingIndexed.map(row => row.code), blocks});
    if (period === periods[0] && ddi !== publishedQ2Score) warnings.push({type: 'publishedQ2Mismatch',
      team: product.name, computedDdi: ddi, publishedQ2Score});
  }
}
assert.equal(rows.length, 158);
assert.equal(new Set(rows.map(row => [row.team, row.period, row.code].join('\u001f'))).size, rows.length);
assert.equal(warnings.filter(warning => warning.type === 'methodologyMissing').length, 24);
assert.equal(auxiliaryRows.length, 6);
const result = {schemaVersion: 1, generatedAt: new Date().toISOString(), periods, selection,
  rowSchema: 'Одна строка = команда × квартал × фактический metric.code из product.metrics. value/maxValue — исходные баллы, displayPercent — процент как в UI. indexed определяет суммирование DDI.',
  notes: [
    'Тексты методологии взяты из текущей страницы «О Data Driven» и её product-профиля. Историческая редакция методологии II квартала отдельно не восстановлена.',
    'Нормативный текст методологии не заменяет фактический максимум критерия за квартал. Для DDI суммируются только строки indexed=true.',
    'В goals за III квартал исходные показатели ЛЮ/ЛТ информационные; итоговые PO-показатели участвуют в индексе. В II квартале три исходных показателя входят в индекс.',
    'auxiliaryRows содержит дублирующие источники goalsPoLevelMetrics для проверки происхождения; их нельзя повторно добавлять в Excel или сумму DDI.',
    'Для general в отрисованном product-профиле текущей страницы нет отдельного правила. Неиспользуемый legacy-массив zones в AboutPage.jsx не является отрисованной методологией. Для регулярности отдельной шкалы нет — приведён связанный критерий регулярной отчётности. Совместные шкалы мониторинга и алертов размечены methodologyRelation.',
    'Неприменимые и информационные строки сохранены явно; скрытый критерий не означает автоматически исключение из расчёта — действителен флаг indexed.',
  ], rows, totals, auxiliaryRows, methodologyCatalog: catalog,
  controls: {rows: rows.length, auxiliaryRows: auxiliaryRows.length, overlayCount: overlayNames.length,
    maxMethodologyLength: Math.max(...rows.map(row => row.methodology.length)),
    missingMethodology: warnings.filter(warning => warning.type === 'methodologyMissing').length},
  warnings, sources: [...sources.values()], overlayNames};
for (const source of sources.values()) assert.equal(hash(await readFile(new URL(source.path, root), 'utf8')), source.sha256,
  `Input changed during extraction: ${source.path}`);
await writeFile(new URL('data.json', directory), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({controls: result.controls, totals: totals.map(({team, period, earned, maximum, ddi,
  publishedQ2Score, publishedQ2Mismatch, rowCount, indexedRowCount}) => ({team, period, earned, maximum, ddi,
  publishedQ2Score, publishedQ2Mismatch, rowCount, indexedRowCount})), warnings}, null, 2));
