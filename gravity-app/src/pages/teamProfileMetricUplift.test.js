import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {isDdIndexMetric, isTbdMetric} from '../domain/report.js';

const profileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const metricRowSource = profileSource.match(
  /function MetricRow\([\s\S]*?(?=\nconst LEADER_CONFETTI_COLORS)/,
)?.[0] || '';
const metricUpliftBadgeSource = profileSource.match(
  /function MetricUpliftBadge\([\s\S]*?(?=\nfunction MetricInlineAction)/,
)?.[0] || '';
const metricRecommendationTriggerSource = profileSource.match(
  /function MetricRecommendationTrigger\([\s\S]*?(?=\nfunction MetricUpliftBadge)/,
)?.[0] || '';
const digitalTraceConfirmationSource = profileSource.match(
  /function DigitalTraceConfirmation\([\s\S]*?(?=\nfunction MetricRow)/,
)?.[0] || '';
const upliftRecommendationSource = profileSource.match(
  /const GENERAL_UPLIFT_RECOMMENDATION[\s\S]*?(?=\nfunction MetricRecommendationTrigger)/,
)?.[0] || '';
const blockTitleSource = profileSource.match(
  /export function teamProfileBlockTitle[\s\S]*?(?=\nfunction AlertsHelpContent)/,
)?.[0]?.replace('export ', '') || '';
const normalizeUpliftBindingSource = profileSource.match(
  /function normalizeUpliftBinding[\s\S]*?(?=\nfunction metricUpliftRecommendation)/,
)?.[0] || '';

const upliftRecommendationContext = Object.create(null);
runInNewContext(
  `${upliftRecommendationSource}
globalThis.upliftRecommendationApi = {metricUpliftRecommendation};`,
  upliftRecommendationContext,
);
const {upliftRecommendationApi} = upliftRecommendationContext;
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
  assert.match(profileSource, /name: teamProfileBlockTitle\(block\)/);
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

test('metric uplift uses the total maximum of applicable DD-index metrics', () => {
  assert.match(
    profileSource,
    /const applicableMetrics = [^;]+\.filter\(isDdIndexMetric\);[\s\S]*?const maxPoints = applicableMetrics\.reduce\(\(sum, metric\) => sum \+ Number\(metric\.max_value \|\| 0\), 0\);/,
  );
  assert.match(metricRowSource, /function MetricRow\(\{[^}]*maxIndexPoints/);
  assert.match(metricRowSource, /const metricValue = Number\(metric\.value \|\| 0\);/);
  assert.match(metricRowSource, /const metricMax = Number\(metric\.max_value \|\| 0\);/);
  assert.match(
    metricRowSource,
    /\(metricMax - metricValue\) \/ maxIndexPoints \* 100/,
  );
  assert.match(profileSource, /<MetricRow [^>]*maxIndexPoints=\{maxPoints\}/);
});

test('metric uplift is limited to incomplete applicable DD-index metrics', () => {
  assert.match(
    metricRowSource,
    /const indexUplift = isDdIndexMetric\(metric\) && !isTbd && metricValue < metricMax && maxIndexPoints > 0/,
  );
  assert.match(metricRowSource, /const isTbd = isTbdMetric\(metric\);/);

  const incomplete = {value: 0.4, max_value: 1};
  const completed = {...incomplete, value: 1};
  const tbd = {...incomplete, tbd: true};
  const informational = {...incomplete, dd_calculation_flg: 0};
  const inapplicable = {...incomplete, is_applicabble_flg: false};
  const eligible = (metric) => isDdIndexMetric(metric)
    && !isTbdMetric(metric)
    && Number(metric.value || 0) < Number(metric.max_value || 0);

  assert.equal(eligible(incomplete), true);
  assert.equal(eligible(completed), false);
  assert.equal(eligible(tbd), false);
  assert.equal(eligible(informational), false);
  assert.equal(eligible(inapplicable), false);
  assert.match(
    metricRowSource,
    /const indexUpliftBadge = indexUplift > 0 && <MetricUpliftBadge label=\{indexUpliftLabel\} title=\{indexUpliftTitle\} recommendation=\{metricRecommendation\} \/>/,
  );
});

test('Gravity uplift label shows percentage points with an accessible explanation', () => {
  assert.match(metricRowSource, /`\+\$\{indexUplift\.toFixed\(1\)\} п\.п\.`/);
  assert.match(
    metricRowSource,
    /const indexUpliftTitle = `Потенциальный прирост DD-индекса: \$\{indexUpliftLabel\}`;/,
  );
  assert.match(
    metricUpliftBadgeSource,
    /<Label className="metric-index-uplift" theme="success" title=\{title\} aria-label=\{title\}>\{label\}<\/Label>/,
  );
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
    /const metricRecommendation = !isNotApplicable && !isTbd\s*\? metricUpliftRecommendation\(block, metric, value\)\s*: null;/,
  );
  assert.match(
    metricRowSource,
    /const upliftDigitalTrace = metricRecommendation\?\.note\s*\? <DigitalTraceConfirmation message=\{metricRecommendation\.note\} \/>\s*: null;/,
  );
  assert.doesNotMatch(
    metricRowSource,
    /const metricRecommendation = [^;]*indexUplift/,
  );
});

test('only incomplete described metrics without uplift use the name trigger', () => {
  const nameTriggerStyles = stylesSource.match(
    /\.metric-name-recommendation-trigger\s*\{[^}]+\}/s,
  )?.[0] || '';
  const nameTriggerHoverStyles = stylesSource.match(
    /\.metric-name-recommendation-trigger:hover\s*\{[^}]+\}/s,
  )?.[0] || '';
  const nameTriggerFocusStyles = stylesSource.match(
    /\.metric-name-recommendation-trigger:focus-visible\s*\{[^}]+\}/s,
  )?.[0] || '';

  assert.equal(
    recommendation('alerts', 'Алерты', 'alerts.business_metrics', 'Оповещения по бизнес-метрикам', 100)?.text,
    'Воспользуйтесь инструментом Модуль Отклонений в Навигаторе',
  );
  assert.equal(
    recommendation('alerts', 'Алерты', 'alerts.business_metrics', 'Неописанная метрика', 100),
    null,
  );
  assert.match(
    metricRowSource,
    /const metricName = metricRecommendation && indexUplift === 0 && value < 100\s*\? \([\s\S]*?<MetricRecommendationTrigger[\s\S]*?className="metric-name-recommendation-trigger"[\s\S]*?triggerLabel=\{`Открыть рекомендацию для метрики «\$\{metric\.name\}»`\}[\s\S]*?<b>\{metric\.name\}<\/b>[\s\S]*?<\/MetricRecommendationTrigger>[\s\S]*?\)\s*: <b>\{metric\.name\}<\/b>;/,
  );
  assert.match(
    metricRowSource,
    /const indexUpliftBadge = indexUplift > 0 && <MetricUpliftBadge [^;]+recommendation=\{metricRecommendation\} \/>;/,
  );
  assert.doesNotMatch(
    metricRowSource,
    /indexUplift > 0[\s\S]{0,180}className="metric-name-recommendation-trigger"/,
  );
  assert.match(nameTriggerStyles, /border-bottom:\s*1px dashed var\(--g-color-line-positive\);/);
  assert.match(nameTriggerStyles, /background:\s*transparent;/);
  assert.match(nameTriggerHoverStyles, /color:\s*var\(--g-color-text-positive-heavy\);/);
  assert.match(nameTriggerHoverStyles, /border-bottom-style:\s*solid;/);
  assert.doesNotMatch(nameTriggerHoverStyles, /background:/);
  assert.match(nameTriggerFocusStyles, /outline:\s*2px solid var\(--g-color-line-focus\);/);
});

test('completed guidance is plain while incomplete guidance keeps exactly one popup trigger', () => {
  const usesNameTrigger = ({recommendation: mappedRecommendation, indexUplift, value}) => (
    Boolean(mappedRecommendation && indexUplift === 0 && value < 100)
  );
  const alertRecommendation = recommendation(
    'alerts',
    'Алерты',
    'alerts.business_metrics',
    'Оповещения по бизнес-метрикам',
    50,
  );
  const incompleteDdRecommendation = recommendation(
    'attract',
    'Воронка привлечения',
    'attract.report_completeness',
    'Полнота отчета',
    50,
  );
  const incompleteInformationalRegularityRecommendation = recommendation(
    'churn',
    'Воронка оттока',
    'churn.regulyarnostь',
    'Регулярность',
    50,
  );
  const completedCampaignRecommendation = recommendation(
    'attract',
    'Воронка привлечения',
    'attract.campaign_launches',
    'Запуски кампаний за квартал',
    100,
  );
  const completedSelfServiceRecommendation = recommendation(
    'attract',
    'Воронка привлечения',
    'attract.nalichie_self_service',
    'Наличие Self-service',
    100,
  );

  assert.equal(
    usesNameTrigger({recommendation: alertRecommendation, indexUplift: 0, value: 50}),
    true,
    'an incomplete informational mapping without uplift uses its metric name',
  );
  assert.equal(
    usesNameTrigger({
      recommendation: incompleteInformationalRegularityRecommendation,
      indexUplift: 0,
      value: 50,
    }),
    true,
    'incomplete informational churn regularity uses its name trigger without uplift',
  );
  assert.equal(
    usesNameTrigger({recommendation: alertRecommendation, indexUplift: 0, value: 100}),
    false,
    'a completed described metric keeps a plain metric name',
  );
  assert.equal(
    usesNameTrigger({recommendation: completedCampaignRecommendation, indexUplift: 0, value: 100}),
    false,
    'a completed campaign keeps a plain metric name',
  );
  assert.equal(
    usesNameTrigger({recommendation: completedSelfServiceRecommendation, indexUplift: 0, value: 100}),
    false,
    'a completed Self-service metric keeps a plain metric name',
  );
  assert.equal(completedCampaignRecommendation?.note, 'Проверено на цифровых следах за 1Q');
  assert.equal(completedSelfServiceRecommendation?.note, 'Проверено на цифровых следах за 1Q');
  assert.equal(
    usesNameTrigger({recommendation: incompleteDdRecommendation, indexUplift: 5, value: 50}),
    false,
    'an incomplete DD metric uses its uplift trigger instead of a name trigger',
  );
  assert.match(
    metricUpliftBadgeSource,
    /<MetricRecommendationTrigger[\s\S]*?className="metric-index-uplift-trigger"[\s\S]*?>\s*\{upliftLabel\}\s*<\/MetricRecommendationTrigger>/,
  );
  assert.doesNotMatch(
    metricRowSource,
    /const metricName = [^;]*(?:value === 100|value >= 100)/,
  );
});

test('recommendation notes use the shared accessible digital-trace confirmation beside uplift', () => {
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
    /const upliftDigitalTrace = metricRecommendation\?\.note\s*\? <DigitalTraceConfirmation message=\{metricRecommendation\.note\} \/>\s*: null;/,
  );
  assert.equal(
    recommendation('alerts', 'Алерты', 'alerts.business_metrics', 'Оповещения по бизнес-метрикам')?.note,
    undefined,
  );
  assert.doesNotMatch(metricRecommendationTriggerSource, /recommendation\.note|DigitalTraceConfirmation|CircleCheckFill|<small>/);
  assert.equal(
    metricRowSource.match(/\{digitallyConfirmed && <DigitalTraceConfirmation \/>\}/g)?.length,
    2,
  );
});

test('uplift and incomplete no-uplift metric name share one keyboard-accessible downward popup', () => {
  const triggerOpenTag = metricRecommendationTriggerSource.match(
    /<button\b[\s\S]*?>/,
  )?.[0] || '';
  const popupOpenTag = metricRecommendationTriggerSource.match(
    /<Popup\b[\s\S]*?>/,
  )?.[0] || '';
  const dialogOpenTag = metricRecommendationTriggerSource.match(
    /<div className="metric-index-uplift-popup-content"[^>]*>/,
  )?.[0] || '';

  assert.match(metricUpliftBadgeSource, /if \(!recommendation\) return upliftLabel;/);
  assert.match(
    metricUpliftBadgeSource,
    /<MetricRecommendationTrigger[\s\S]*?className="metric-index-uplift-trigger"[\s\S]*?>\s*\{upliftLabel\}\s*<\/MetricRecommendationTrigger>/,
  );
  assert.match(
    metricRowSource,
    /<MetricRecommendationTrigger[\s\S]*?className="metric-name-recommendation-trigger"[\s\S]*?>\s*<b>\{metric\.name\}<\/b>\s*<\/MetricRecommendationTrigger>/,
  );
  assert.match(triggerOpenTag, /type="button"/);
  assert.match(triggerOpenTag, /aria-haspopup="dialog"/);
  assert.match(triggerOpenTag, /aria-expanded=\{open\}/);
  assert.match(triggerOpenTag, /aria-controls=\{popupId\}/);
  assert.match(metricRecommendationTriggerSource, /onClick=\{\(\) => setOpen\(\(visible\) => !visible\)\}/);
  assert.match(popupOpenTag, /placement="bottom-end"/);
  assert.doesNotMatch(popupOpenTag, /\bid=\{popupId\}/);
  assert.doesNotMatch(popupOpenTag, /\brole="dialog"/);
  assert.doesNotMatch(popupOpenTag, /\baria-label=\{popupLabel\}/);
  assert.match(dialogOpenTag, /\bid=\{popupId\}/);
  assert.match(dialogOpenTag, /\brole="dialog"/);
  assert.match(dialogOpenTag, /\baria-label=\{popupLabel\}/);
  assert.match(metricRecommendationTriggerSource, /<p>\{recommendation\.text\}<\/p>/);
  assert.doesNotMatch(metricRecommendationTriggerSource, /recommendation\.note|CircleCheckFill|<small>/);
});

test('uplift precedes every digital-trace check and the value in both detail modes', () => {
  assert.match(
    metricRowSource,
    /<div className="metric-value-group">\{indexUpliftBadge\}\{upliftDigitalTrace\}\{digitallyConfirmed && <DigitalTraceConfirmation \/>\}<span className="metric-value-label">\{valueLabel\}<\/span><\/div>/,
  );
  assert.match(
    metricRowSource,
    /<div className="metric-value-group">\{indexUpliftBadge\}\{upliftDigitalTrace\}\{digitallyConfirmed && <DigitalTraceConfirmation \/>\}<Label className="metric-status-label" theme=\{status\.theme\}>\{status\.label\}<\/Label><\/div>/,
  );

  const valueGroupStyles = stylesSource.match(
    /\.metric-value-group\s*\{[^}]+\}/s,
  )?.[0] || '';
  assert.match(valueGroupStyles, /display:\s*flex;/);
  assert.match(valueGroupStyles, /flex-wrap:\s*nowrap;/);
  assert.match(valueGroupStyles, /align-items:\s*center;/);
  assert.match(valueGroupStyles, /justify-content:\s*flex-end;/);
});

test('uplift is absent from the metric name and uses transparent green Label styling', () => {
  const nameLineMarkup = metricRowSource
    .split('\n')
    .find((line) => line.includes('className="metric-name-line"')) || '';
  const nameLineStyles = stylesSource.match(
    /\.metric-name-line\s*\{[^}]+\}/s,
  )?.[0] || '';
  const upliftStyles = stylesSource.match(
    /\.metric-index-uplift\s*\{[^}]+\}/s,
  )?.[0] || '';

  assert.doesNotMatch(nameLineMarkup, /metric-index-uplift|indexUpliftBadge/);
  assert.doesNotMatch(nameLineStyles, /flex-wrap/);
  assert.doesNotMatch(stylesSource, /\.metric-name-line\s*>\s*b/);
  assert.doesNotMatch(stylesSource, /\.metric-copy \.metric-index-uplift/);
  assert.match(upliftStyles, /--_--bg-color:\s*transparent;/);
  assert.match(upliftStyles, /--_--bg-color-hover:\s*transparent;/);
  assert.match(upliftStyles, /--_--text-color:\s*var\(--g-color-text-positive-heavy\);/);
  assert.match(
    upliftStyles,
    /box-shadow:\s*inset 0 0 0 1px var\(--g-color-line-positive\);/,
  );
  const upliftHoverStyles = stylesSource.match(
    /\.metric-index-uplift-trigger:hover\s+\.metric-index-uplift\s*\{[^}]+\}/s,
  )?.[0] || '';
  assert.match(upliftHoverStyles, /box-shadow:\s*inset 0 0 0 2px var\(--g-color-line-positive\);/);
  assert.doesNotMatch(upliftHoverStyles, /--_--bg-color/);
});
