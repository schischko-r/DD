import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {isDdIndexMetric, isTbdMetric} from '../domain/report.js';

const profileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');
const llmSummarySource = readFileSync(new URL('../features/llm-summary/LlmSummary.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const metricRowSource = profileSource.match(
  /function MetricRow\([\s\S]*?(?=\nconst LEADER_CONFETTI_COLORS)/,
)?.[0] || '';
const digitalTraceConfirmationSource = profileSource.match(
  /function DigitalTraceConfirmation\([\s\S]*?(?=\nfunction MetricRow)/,
)?.[0] || '';
const upliftRecommendationSource = profileSource.match(
  /const GENERAL_UPLIFT_RECOMMENDATION[\s\S]*?(?=\nfunction MetricInlineAction)/,
)?.[0] || '';
const blockTitleSource = profileSource.match(
  /export function teamProfileBlockTitle[\s\S]*?(?=\nfunction AlertsHelpContent)/,
)?.[0]?.replace('export ', '') || '';
const normalizeUpliftBindingSource = profileSource.match(
  /function normalizeUpliftBinding[\s\S]*?(?=\nfunction metricUpliftRecommendation)/,
)?.[0] || '';
const funnelRegularitySource = profileSource.match(
  /function isReportingRegularity[\s\S]*?(?=\nconst CROSS_SELL_UNCONFIRMED_MESSAGE)/,
  )?.[0] || '';

const upliftRecommendationContext = Object.create(null);
runInNewContext(
  `${upliftRecommendationSource}
globalThis.upliftRecommendationApi = {metricUpliftRecommendation};`,
  upliftRecommendationContext,
);
const {upliftRecommendationApi} = upliftRecommendationContext;
const funnelRegularityContext = Object.create(null);
runInNewContext(
  `${funnelRegularitySource}\nglobalThis.funnelRegularityApi = {isReportingRegularity};`,
  funnelRegularityContext,
);
const blockTitleContext = Object.create(null);
runInNewContext(
  `${normalizeUpliftBindingSource}\n${blockTitleSource}\nglobalThis.blockTitleApi = {teamProfileBlockTitle};`,
  blockTitleContext,
);

function recommendation(blockCode, blockName, metricCode, metricName, metricPercent = 0) {
  return upliftRecommendationApi.metricUpliftRecommendation(
    {code: blockCode, name: blockName},
    {code: metricCode, name: metricName},
    metricPercent,
  );
}

test('team profile labels goals and CX blocks for their audience', () => {
  const {teamProfileBlockTitle} = blockTitleContext.blockTitleApi;
  assert.equal(teamProfileBlockTitle({code: 'goals', name: 'Цели'}), 'Цели уровня ЛЮ/ЛТ');
  assert.equal(teamProfileBlockTitle({code: 'goals', name: 'Цели', goalsLevels: true}), 'Цели/ФА/Прогнозы');
  assert.equal(teamProfileBlockTitle({name: 'Цели'}), 'Цели уровня ЛЮ/ЛТ');
  assert.equal(teamProfileBlockTitle({code: 'cx', name: 'Клиентский опыт', metrics: [{name: 'CX Score'}]}), 'CX Score');
  assert.equal(teamProfileBlockTitle({name: 'Клиентский опыт', metrics: [{name: 'CX Score'}]}), 'CX Score');
  assert.equal(teamProfileBlockTitle({code: 'cx', name: 'Клиентский опыт', metrics: [{name: 'UX Score'}]}), 'CX/UX Score');
  assert.equal(teamProfileBlockTitle({code: 'cx', name: 'Клиентский опыт', metrics: [{name: 'UX-Score'}]}), 'CX/UX Score');
  assert.equal(teamProfileBlockTitle({code: 'cx', name: 'Клиентский опыт', metrics: [{name: 'UХ Score'}]}), 'CX/UX Score');
  assert.equal(teamProfileBlockTitle({code: 'cx', name: 'Клиентский опыт', metrics: [{name: 'CX Score', label: 'UX Score'}]}), 'CX/UX Score');
  assert.equal(teamProfileBlockTitle({code: 'cx', name: 'Клиентский опыт', metrics: [{name: 'CX Score', buttons: [{label: 'UX Score'}]}]}), 'CX Score');
  assert.equal(teamProfileBlockTitle({code: 'cx', name: 'Клиентский опыт', metrics: [{name: 'UX   Score'}]}), 'CX Score');
  assert.equal(teamProfileBlockTitle({code: 'cx', name: 'Клиентский опыт', metrics: [{name: 'UX Score report'}]}), 'CX Score');
  assert.match(profileSource, /<h3>\{teamProfileBlockTitle\(block\)\}<\/h3>/);
  assert.match(profileSource, /name: teamProfileBlockTitle\(visibleMetricBlocks\[index\]\)/);
});

test('key metrics source help explains PO survey verification against dashboard data', () => {
  assert.match(
    profileSource,
    /Расчёт на основании опроса PO с верификацией по цифровым следам: ответы продукта сверяются с данными дашборда по ключевым метрикам\./,
  );
  assert.doesNotMatch(profileSource, /На основании пройденной самооценки в Oprosso/);
});

test('regularity is nested under reporting in every block that groups it there', () => {
  const {isReportingRegularity} = funnelRegularityContext.funnelRegularityApi;
  const reporting = (name) => ({name, metric_subgroup: 'Отчетность'});
  assert.equal(isReportingRegularity(reporting('Регулярность')), true);
  assert.equal(isReportingRegularity(reporting('Регулярность (авто)')), true);
  assert.equal(isReportingRegularity(reporting('Использование.Регулярность (авто)')), true);
  assert.equal(isReportingRegularity({name: 'Регулярность', metric_subgroup: 'Отчётность'}), true, 'ё is spelled both ways');
  assert.equal(isReportingRegularity({name: 'Регулярность', metric_subgroup: ''}), false);
  assert.equal(isReportingRegularity({name: 'Регулярность', metric_subgroup: 'Анализ'}), false);
  assert.equal(isReportingRegularity(reporting('Полнота отчета')), false);
  assert.match(profileSource, /nested=\{isReportingRegularity\(metric\)\}/);
  assert.match(stylesSource, /\.metric-list \.metric-row-nested \{ position: relative; padding-left: 52px; \}/);
  assert.match(stylesSource, /\.metric-row-nested::before/);
});

test('every Регулярность in the shipped report is grouped so the indent reaches it', () => {
  const {isReportingRegularity} = funnelRegularityContext.funnelRegularityApi;
  const report = JSON.parse(readFileSync(new URL('../../public/report-data.json', import.meta.url), 'utf8'));
  const rows = report.products.flatMap((product) => product.metrics.flatMap((block) => block.metrics
    .filter((metric) => /регулярность/i.test(String(metric.name || '')))
    .map((metric) => ({block: block.code, metric}))));

  assert.ok(rows.length > 100, `expected the report to carry many regularity rows, saw ${rows.length}`);
  const flat = rows.filter(({metric}) => !isReportingRegularity(metric));
  assert.deepEqual(flat, [], 'no regularity row is left without its indent');
});

test('data quality metric reuses the centralized KКД instruction from backlog recommendations', () => {
  assert.match(profileSource, /CENTRALIZED_KKD_CDO_URL/);
  assert.match(profileSource, /\^dannye\\\.kontrol\.\*kkd\$\/i/);
  assert.match(profileSource, /title="Инструкция" subtitle="Централизованный сервис ККД" href=\{CENTRALIZED_KKD_CDO_URL\}/);
});

test('industrial data metric reuses FeatureStore and materials from backlog recommendations', () => {
  assert.match(profileSource, /\^dannye\\\.promyshlenye_dannye\$\/i/);
  assert.match(profileSource, /title="Инструкции и материалы" subtitle="по опромышливанию данных" actions=\{industrialDataResourcesFor\(product\.name\)\}/);
  assert.match(profileSource, /function MetricInlineResources\(\{title, subtitle, actions\}\)/);
});

test('business metrics analytics action follows the DD metric grid instead of AI recommendations', () => {
  assert.match(
    profileSource,
    /<\/section>\s*\{!product\.isPlaceholder && <><div className="metrics-title team-business-metrics-title">\s*<h2>Аналитические навыки<\/h2>\s*<\/div>\s*<Card className="promo metric-report-promo team-business-metrics-analytics"/,
  );
  assert.match(profileSource, /AI-аналитика по бизнес-метрикам/);
  assert.match(
    profileSource,
    /Ключевые изменения и быструю аналитику по своим бизнес-метрикам можно также посмотреть в комплексном отчете\. Этот блок не влияет на Data Driven Index вашей команды, но может содержать полезные инсайты и рекомендации по основным блокам вашего бизнеса\./,
  );
  assert.match(profileSource, /onClick=\{\(\) => setReportAccessOpen\(true\)\}/);
  assert.doesNotMatch(llmSummarySource, /Посмотреть комплексный отчет по продукту/);
  assert.doesNotMatch(llmSummarySource, /Больше подробностей можно посмотреть в комплексном отчёте/);
});

test('draft AI action suppresses the duplicate generic Drafts skill link', () => {
  assert.match(
    profileSource,
    /const hasDraftAiInsight = draftAiRecommendations\.length > 0 && \/\^attract\\\.chernoviki_v_sbol_70\$\/i\.test\(metric\.code\)/,
  );
  assert.match(
    profileSource,
    /metricSkillLinks\(block, metric\)\.filter\(\(action\) => !\(hasDraftAiInsight && \/\^черновики\$\/i\.test\(action\.label\)\)\)/,
  );
  assert.match(
    profileSource,
    /if \(hasDraftAiInsight\) aiMetricInsight = metricAiInsight\('черновикам в СБОЛ', openDraftAiRecommendation\)/,
  );
});

test('metric rows retain actual growth and their current value without a potential-uplift duplicate', () => {
  assert.doesNotMatch(metricRowSource, /indexUpliftBadge|MetricUpliftBadge|indexUpliftTitle/);
  assert.match(metricRowSource, /const actualGrowthBadge = <MetricActualGrowthBadge/);
  assert.match(metricRowSource, /metric-status-label/);
});

test('block header delta is larger and omits the DDI suffix while metric deltas keep it', () => {
  assert.match(profileSource, /function MetricActualGrowthBadge\(\{growth, blockHeader = false\}\)/);
  assert.match(profileSource, /blockHeader \? '' : ' к DDI'/);
  assert.match(profileSource, /MetricActualGrowthBadge growth=\{growth\} blockHeader/);
  assert.match(stylesSource, /\.metric-actual-growth-block \.metric-index-uplift-text\s*\{ font-size: 14px;/);
});

test('manually filled zeros do not claim digital-trace verification', () => {
  assert.match(metricRowSource, /!\/\^userConfirmed\/\.test\(metric\.source\?\.origin \|\| ''\)/);
});

test('general block guidance applies to every incomplete metric in that block only', () => {
  assert.equal(
    recommendation('general', '', 'custom.metric_without_general_prefix', 'Любая неполная метрика')?.text,
    'Значение можно улучшить перепройдя самооценку команды в Oprosso в следующем квартале',
  );
  assert.equal(
    recommendation('other', 'Знание ключевых метрик', 'general.mau_produkta', 'MAU продукта'),
    null,
  );
});

test('only explicitly described attraction and goals metrics receive guidance', () => {
  const cases = [
    ['attract', 'Воронка привлечения', 'attract.nastroena_otchetnostь', 'Настроена отчетность', 0, 'Выстройте отчетность в Навигаторе по продуктовой воронке привлечения'],
    ['attract', 'Воронка привлечения', 'attract.report_completeness', 'Полнота отчета', 50, 'Донасытьте отчетность в Навигаторе метриками и разрезами по продуктовой воронке привлечения'],
    ['attract', 'Воронка привлечения', 'attract.regulyarnostь', 'Регулярность', 0, 'Автоматизируйте процесс отчетности в Навигаторе к следующей самооценке'],
    ['attract', 'Воронка привлечения', 'attract.funnel_analysis', 'Проведение комплексного анализа воронки привлечения', 0, 'Проведите комплексный анализ воронки привлечения'],
    ['attract', 'Воронка привлечения', 'attract.funnel_analysis', 'Проведение комплексного анализа воронки привлечения', 50, 'Повысьте полноту анализа воронки привлечения'],
    ['attract', 'Воронка привлечения', 'attract.initiatives_list', 'Составлен перечень инициатив по привлечению', 0, 'Составьте перечень инициатив по привлечению'],
    ['attract', 'Воронка привлечения', 'attract.benchmarks', 'Наличие бенчмарков', 0, 'Сформируйте бенчмарки по рынку по воронке привлечения'],
    ['attract', 'Воронка привлечения', 'attract.campaign_launches', 'Запуски кампаний за квартал', 0, 'Запустите первую кампанию'],
    ['attract', 'Воронка привлечения', 'attract.chernoviki_v_sbol_70', 'Черновики в СБОЛ >=70%', 0, 'Настройте триггеры по событиям в воронке оформления и повысьте покрытие черновиков коммуникациями'],
    ['attract', 'Воронка привлечения', 'attract.nalichie_self_service', 'Наличие Self-service', 0, 'Запустите свой первый Self-service пилот'],
    ['attract', 'Воронка привлечения', 'attract.nalichie_uspeshnyh_biznes_zapuskov', 'Наличие успешных бизнес-запусков', 0, 'Проведите ретроспективный анализ прошедших бизнес-запусков.'],
    ['goals', 'Цели', 'goals.monitored', 'Цели выведены на мониторинг', 50, 'Донасытьте мастер-деши в Навигаторе своими продуктовыми целями (покрытие целей от 90%)'],
    ['goals', 'Цели', 'goals.factor_analysis_l1_l2', 'Факторный анализ - драйверы 1-2 ур.', 0, 'Декомпозируйте цели в Навигаторе ключевыми драйверами, влияющими на цели (покрытие целей от 90%)'],
    ['goals', 'Цели', 'goals.forecast', 'Прогноз по целям', 50, 'Выведите прогнозные значения в Навигатор'],
  ];

  for (const [blockCode, blockName, metricCode, metricName, metricPercent, expectedText] of cases) {
    assert.equal(
      recommendation(blockCode, blockName, metricCode, metricName, metricPercent)?.text,
      expectedText,
      `${blockCode}/${metricCode}`,
    );
  }

  assert.equal(
    recommendation('attract', 'Воронка привлечения', 'attract.unknown', 'Неописанная метрика'),
    null,
  );
  assert.equal(
    recommendation('churn', 'Воронка оттока', 'attract.report_completeness', 'Полнота отчета', 50),
    null,
  );
  assert.equal(
    recommendation('attract', 'Воронка привлечения', 'attract.report_completeness', 'Полнота отчета по оттоку', 50),
    null,
  );
  assert.equal(
    recommendation('goals', 'Другой блок', 'goals.forecast', 'Прогноз по целям', 50),
    null,
  );
});

test('only explicitly described churn metrics receive exact churn guidance, including PB quarters', () => {
  assert.equal(
    recommendation('churn', 'Воронка оттока', 'churn.report_completeness', 'Полнота отчета', 50)?.text,
    'Донасытьте отчетность в Навигаторе метриками и разрезами по продуктовой воронке оттока',
  );
  assert.equal(
    recommendation('churn', 'Воронка оттока', 'churn.funnel_analysis', 'Проведение комплексного анализа воронки оттока', 0)?.text,
    'Проведите комплексный анализ воронки оттока',
  );
  for (const metricPercent of [25, 50, 75]) {
    assert.equal(
      recommendation('churn', 'Воронка оттока', 'churn.funnel_analysis', 'Проведение комплексного анализа воронки оттока', metricPercent)?.text,
      'Повысьте полноту анализа воронки оттока',
      `PB churn funnel analysis at ${metricPercent}%`,
    );
  }
  for (const metricPercent of [10, 100]) {
    assert.equal(
      recommendation('churn', 'Воронка оттока', 'churn.funnel_analysis', 'Проведение комплексного анализа воронки оттока', metricPercent),
      null,
      `churn funnel analysis has no advice at unsupported ${metricPercent}%`,
    );
  }
  assert.equal(
    recommendation('churn', 'Воронка оттока', 'churn.benchmarks', 'Наличие бенчмарков', 0)?.text,
    'Сформируйте бенчмарки по рынку по воронке оттока',
  );

  const invalidBindings = [
    ['other', 'Воронка оттока', 'churn.report_completeness', 'Полнота отчета'],
    ['churn', 'Другой блок', 'churn.report_completeness', 'Полнота отчета'],
    ['churn', 'Воронка оттока', 'churn.unknown', 'Полнота отчета'],
    ['churn', 'Воронка оттока', 'churn.report_completeness', 'Полнота отчета по привлечению'],
    ['churn', 'Воронка оттока', 'churn.unknown', 'Проведение комплексного анализа воронки оттока'],
    ['churn', 'Воронка оттока', 'churn.funnel_analysis', 'Проведение комплексного анализа воронки привлечения'],
  ];

  for (const [blockCode, blockName, metricCode, metricName] of invalidBindings) {
    assert.equal(
      recommendation(blockCode, blockName, metricCode, metricName, 0),
      null,
      `${blockCode}/${blockName}/${metricCode}/${metricName}`,
    );
  }
});

test('six new uplift recommendations are bound to their exact churn, hypothesis, and CX metrics', () => {
  const cases = [
    ['churn', 'Воронка оттока', 'churn.nastroena_otchetnostь', 'Настроена отчетность', 'Выстройте отчетность в Навигаторе по продуктовой воронке оттока'],
    ['churn', 'Воронка оттока', 'churn.regulyarnostь', 'Регулярность', 'Автоматизируйте процесс отчетности в Навигаторе к следующей самооценке'],
    ['churn', 'Воронка оттока', 'churn.deviation_actions', 'Мероприятия по работе с отклонениями', 'Сформируйте перечень мероприятий по работе с отклонениями'],
    ['hyp', 'Гипотезы и инициативы', 'hyp.discovery_40_backlog', 'Discovery >=40% бэклога', 'Декомпозируйте бэклог аналитиков при наличии выделенных в команде'],
    ['hyp', 'Гипотезы и инициативы', 'hyp.datadriven_rating_7_5', 'Оценка исследований >=7,5', 'Повысьте DD-уровень проведенных исследований'],
    ['cx', 'Клиентский опыт', 'cx.score', 'CX Score', 'Повысьте CX Score'],
  ];

  for (const [blockCode, blockName, metricCode, metricName, expectedText] of cases) {
    const mappedRecommendation = recommendation(blockCode, blockName, metricCode, metricName, 50);
    assert.equal(mappedRecommendation?.text, expectedText, `${blockCode}/${metricCode}`);
    assert.equal(mappedRecommendation?.note, undefined, `${blockCode}/${metricCode} has no digital-trace note`);
    assert.equal(
      recommendation('other', blockName, metricCode, metricName, 50),
      null,
      `${metricCode} is rejected under a wrong block code`,
    );
    assert.equal(
      recommendation(blockCode, 'Другой блок', metricCode, metricName, 50),
      null,
      `${metricCode} is rejected under a wrong block name`,
    );
    assert.equal(
      recommendation(blockCode, blockName, metricCode, `Не ${metricName}`, 50),
      null,
      `${metricCode} is rejected with a wrong metric name`,
    );
  }

  assert.equal(
    recommendation('attract', 'Воронка привлечения', 'attract.nastroena_otchetnostь', 'Настроена отчетность')?.text,
    'Выстройте отчетность в Навигаторе по продуктовой воронке привлечения',
  );
  assert.equal(
    recommendation('attract', 'Воронка привлечения', 'attract.regulyarnostь', 'Регулярность')?.text,
    'Автоматизируйте процесс отчетности в Навигаторе к следующей самооценке',
  );
  assert.equal(
    recommendation('attract', 'Воронка привлечения', 'churn.nastroena_otchetnostь', 'Настроена отчетность'),
    null,
  );
  assert.equal(
    recommendation('churn', 'Воронка оттока', 'attract.regulyarnostь', 'Регулярность'),
    null,
  );
});

test('business metric alerts guidance is bound to the exact alerts block and metric', () => {
  const expectedText = 'Воспользуйтесь инструментом Модуль Отклонений в Навигаторе';

  assert.equal(
    recommendation('alerts', 'Алерты', 'alerts.business_metrics', 'Оповещения по бизнес-метрикам')?.text,
    expectedText,
  );
  assert.equal(
    recommendation('other', 'Алерты', 'alerts.business_metrics', 'Оповещения по бизнес-метрикам'),
    null,
  );
  assert.equal(
    recommendation('alerts', 'Другой блок', 'alerts.business_metrics', 'Оповещения по бизнес-метрикам'),
    null,
  );
  assert.equal(
    recommendation('alerts', 'Алерты', 'alerts.unknown', 'Оповещения по бизнес-метрикам'),
    null,
  );
  assert.equal(
    recommendation('alerts', 'Алерты', 'alerts.business_metrics', 'Неописанная метрика'),
    null,
  );
});

test('digital-trace notes are exact and present only for the specified metrics', () => {
  const quarterTrace = 'Проверено на цифровых следах за 1Q';
  const masterDashTrace = 'Проверено на цифровых следах в мастер-дешах';

  assert.equal(recommendation('attract', 'Воронка привлечения', 'attract.campaign_launches', 'Запуски кампаний за квартал')?.note, quarterTrace);
  assert.equal(recommendation('attract', 'Воронка привлечения', 'attract.chernoviki_v_sbol_70', 'Черновики в СБОЛ >=70%')?.note, 'Проверено на цифровых следах');
  assert.equal(recommendation('attract', 'Воронка привлечения', 'attract.nalichie_self_service', 'Наличие Self-service')?.note, quarterTrace);
  assert.equal(recommendation('attract', 'Воронка привлечения', 'attract.nalichie_uspeshnyh_biznes_zapuskov', 'Наличие успешных бизнес-запусков')?.note, quarterTrace);
  assert.equal(recommendation('goals', 'Цели', 'goals.monitored', 'Цели выведены на мониторинг')?.note, masterDashTrace);
  assert.equal(recommendation('goals', 'Цели', 'goals.factor_analysis_l1_l2', 'Факторный анализ - драйверы 1-2 ур.')?.note, masterDashTrace);
  assert.equal(recommendation('goals', 'Цели', 'goals.forecast', 'Прогноз по целям')?.note, masterDashTrace);
  assert.equal(recommendation('attract', 'Воронка привлечения', 'attract.benchmarks', 'Наличие бенчмарков')?.note, undefined);
  assert.equal(recommendation('alerts', 'Алерты', 'alerts.business_metrics', 'Оповещения по бизнес-метрикам')?.note, undefined);
});

test('recommendation mapping and note confirmation stay available for completed metrics', () => {
  const completedCampaign = recommendation(
    'attract',
    'Воронка привлечения',
    'attract.campaign_launches',
    'Запуски кампаний за квартал',
    100,
  );
  const completedSelfService = recommendation(
    'attract',
    'Воронка привлечения',
    'attract.nalichie_self_service',
    'Наличие Self-service',
    100,
  );

  assert.equal(completedCampaign?.note, 'Проверено на цифровых следах за 1Q');
  assert.equal(completedSelfService?.note, 'Проверено на цифровых следах за 1Q');
  assert.match(
    metricRowSource,
    /const baseMetricRecommendation = !isNotApplicable && !isTbd\s*\? metricUpliftRecommendation\(block, metric, value\)\s*: null;/,
  );
  assert.match(
    metricRowSource,
    /const upliftDigitalTrace = verificationNote\s*\? <DigitalTraceConfirmation message=\{verificationNote\} \/>\s*: null;/,
  );
  assert.doesNotMatch(
    metricRowSource,
    /const metricRecommendation = [^;]*indexUplift/,
  );
});

test('metric names remain plain and recommendations stay in the recommendations section', () => {
  assert.match(metricRowSource, /const metricName = <b>\{displayText\(nameOverride \|\| metric.name\)\}<\/b>;/);
  assert.doesNotMatch(metricRowSource, /MetricRecommendationTrigger|metric-name-recommendation-trigger/);
  assert.match(profileSource, /Рекомендации и фокусы для повышения DD-индекса/);
});

test('recommendation notes use the shared accessible digital-trace confirmation beside uplift', () => {
  assert.ok(metricRowSource.includes("'Подтверждения отсутствуют на LossHunter'"));
  assert.ok(metricRowSource.includes('Проверено на цифровых следах'));
  assert.match(
    digitalTraceConfirmationSource,
    /function DigitalTraceConfirmation\(\{message = 'Подтверждено на Цифровых следах'\}\)/,
  );
  assert.match(
    digitalTraceConfirmationSource,
    /<GravityTooltip content=\{message\} openDelay=\{200\}>/,
  );
  assert.match(
    digitalTraceConfirmationSource,
    /<span className="metric-digital-trace-confirmation" tabIndex=\{0\} aria-label=\{message\}><Icon data=\{CircleCheckFill\} size=\{16\} \/><\/span>/,
  );
  assert.match(
    metricRowSource,
    /const upliftDigitalTrace = verificationNote\s*\? <DigitalTraceConfirmation message=\{verificationNote\} \/>\s*: null;/,
  );
  assert.equal(
    recommendation('alerts', 'Алерты', 'alerts.business_metrics', 'Оповещения по бизнес-метрикам')?.note,
    undefined,
  );
  assert.equal(
    metricRowSource.match(/\{confirmationBadge\}/g)?.length,
    2,
  );
});

test('uplift precedes digital-trace state indicators and the value in both detail modes', () => {
  assert.match(
    metricRowSource,
    /<div className="metric-value-group">\{actualGrowthBadge\}\{confirmationBadge\}<span className="metric-value-label">\{valueLabel\}<\/span><\/div>/,
  );
  assert.match(
    metricRowSource,
    /<div className="metric-value-group">\{actualGrowthBadge\}\{confirmationBadge\}<Label className=\{status\.theme === \'normal\' \? \'metric-status-label metric-status-label-text\' : \'metric-status-label\'\} theme=\{status\.theme\}>\{status\.label\}<\/Label><\/div>/,
  );

  const valueGroupStyles = stylesSource.match(
    /\.metric-value-group\s*\{[^}]+\}/s,
  )?.[0] || '';
  assert.match(valueGroupStyles, /display:\s*grid;/);
  assert.match(valueGroupStyles, /grid-template-columns:\s*max-content 18px max-content;/);
  assert.match(valueGroupStyles, /align-items:\s*center;/);
  assert.match(valueGroupStyles, /justify-content:\s*end;/);
});

test('actual metric changes show directional arrows and positive or negative DDI badges', () => {
  const styles = stylesSource.match(/\.metric-index-uplift\s*\{[^}]+\}/s)?.[0] || '';
  assert.match(styles, /--_--bg-color:\s*var\(--g-color-base-positive-light\);/);
  assert.match(styles, /box-shadow:\s*none;/);
  assert.match(profileSource, /delta > 0 \? 'up' : delta < 0 \? 'down' : 'flat'/);
  assert.match(profileSource, /index-quarter-delta-\$\{direction === 'up' \? 'positive' : 'negative'\}/);
  assert.match(profileSource, /direction === 'up' && <span className="metric-actual-growth-sparkles"/);
  assert.match(profileSource, /className="index-quarter-delta-direction"/);
  assert.match(stylesSource, /\.metric-index-uplift \.g-label__content\s*\{[^}]*display:\s*inline-flex/s);
  assert.match(stylesSource, /\.index-quarter-delta-positive \.index-quarter-delta-direction\s*\{ border-bottom: 6px solid currentColor;/);
  assert.match(stylesSource, /\.index-quarter-delta-negative \.index-quarter-delta-direction\s*\{ border-top: 6px solid currentColor;/);
  assert.match(profileSource, /blockHeader \? '' : ' к DDI'/);
  assert.match(profileSource, /metric-index-uplift-\$\{direction\}/);
  assert.match(stylesSource, /\.metric-index-uplift-down\s*\{[^}]*g-color-base-danger-light/s);
  assert.match(stylesSource, /\.metric-row-status \.metric-value-group\s*\{ grid-template-columns: max-content 18px minmax\(64px, max-content\);/);
  assert.match(stylesSource, /\.metric-value-group > \.metric-status-label, \.metric-value-group > \.metric-value-label\s*\{ grid-column: 3; grid-row: 1;/);
});

test('quarter delta caption aligns its text baseline with the triangular badge label', () => {
  assert.match(stylesSource, /\.index-quarter-delta\s*\{[^}]*align-items:\s*baseline;/s);
  assert.match(stylesSource, /\.index-quarter-delta-badge\s*\{[^}]*align-items:\s*baseline;/s);
  assert.match(stylesSource, /\.index-quarter-delta-badge \.index-quarter-delta-direction\s*\{[^}]*align-self:\s*center;/s);
  assert.match(stylesSource, /\.index-quarter-delta-caption\s*\{[^}]*line-height:\s*1\.2;/s);
});

test('compact metric status stays aligned with its copy on narrow screens', () => {
  assert.match(
    stylesSource,
    /@media \(max-width: 820px\)[\s\S]*?\.metric-row-status\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\) max-content;\s*align-items:\s*start;\s*\}/,
  );
  assert.match(
    stylesSource,
    /\.metric-row-status \.metric-value, \.metric-row-status \.metric-status-with-confirmation\s*\{\s*width:\s*auto;\s*\}/,
  );
});
