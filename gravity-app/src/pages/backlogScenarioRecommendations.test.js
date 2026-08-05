import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DD_SCENARIO_RECOMMENDATIONS} from './backlogScenarioRecommendations.js';
import {isMetricAbove} from './RecommendationCell.js';

const pageSource = readFileSync(new URL('./BacklogDecompositionPage.jsx', import.meta.url), 'utf8');
const summarySource = readFileSync(new URL('../features/llm-summary/LlmSummary.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('scenario recommendation source preserves the approved rows and exact copy', () => {
  assert.equal(DD_SCENARIO_RECOMMENDATIONS.length, 21);
  for (const item of DD_SCENARIO_RECOMMENDATIONS) {
    assert.ok(item.key);
    assert.ok(item.direction);
    assert.ok(item.scenario);
    assert.ok(item.info);
    assert.ok(item.recommendation.startsWith('Рекомендуем ') || item.key === 'presentations');
    for (const resource of item.resources || []) {
      assert.ok(resource.label);
      if (resource.href) assert.match(resource.href, /^https:\/\//);
      else assert.ok(['product-analyst-access', 'ex-el-access'].includes(resource.action));
    }
  }

  const openCode = DD_SCENARIO_RECOMMENDATIONS.find((item) => item.scenario === 'Аналитика клиентского опыта');
  assert.deepEqual(
    {direction: openCode.direction, scenario: openCode.scenario, info: openCode.info},
    {
      direction: 'Аналитика',
      scenario: 'Аналитика клиентского опыта',
      info: 'Анализ поведения пользователей, пути клиента, воронки, когортный анализ.',
    },
  );
  assert.match(openCode.recommendation, /OpenCode в DataLab AI — аналог Claude/);
  assert.doesNotMatch(openCode.recommendation, /ссылк/i);
  assert.match(openCode.recommendation, /Для оценки клиентских путей рекомендуем использовать LossHunter и CJExplorer/);
  assert.match(openCode.recommendation, /Также предлагаем воспользоваться AI Toolkit «Продуктовый аналитик»/);
  assert.deepEqual(openCode.resources, [
    {label: 'OpenCode в DataLab AI', href: 'https://mapp.sberbank.ru/b2cda/page/394333', placement: 'inline'},
    {label: 'LossHunter', href: 'https://losshunter.ru', placement: 'inline'},
    {label: 'CJExplorer', href: 'https://cjxplorer.com/', placement: 'inline'},
    {label: 'Продуктовый аналитик', action: 'product-analyst-access', placement: 'inline'},
  ]);

  const ai = DD_SCENARIO_RECOMMENDATIONS.find((item) => item.key === 'AI');
  assert.equal(ai.recommendation, 'Рекомендуем согласованить с HR-партнёром участие аналитиков в AI Bootcamp');
  assert.deepEqual(ai.resources, [{
    label: 'AI Bootcamp',
    href: 'https://bootcamp.pcbltools.ru/task/1585206?courseId=1176',
    placement: 'inline',
  }]);

  const methodology = DD_SCENARIO_RECOMMENDATIONS.find((item) => item.key === 'methodology_dev');
  assert.equal(methodology.recommendation, 'Рекомендуем оформлять согласованные методологии как переиспользуемые артефакты во FeatureStore');
  assert.deepEqual(methodology.resources, [{
    label: 'FeatureStore',
    href: 'https://confluence.sberbank.ru/pages/viewpage.action?pageId=21560591134',
    placement: 'inline',
  }]);

  const unknown = DD_SCENARIO_RECOMMENDATIONS.find((item) => item.key === 'unknown');
  assert.equal(unknown.recommendation, 'Рекомендуем повысить качество описаний задач для более корректного мапинга задач с нашей стороны');

  for (const key of [
    'exports_to_excel_regulator',
    'project_management',
    'business_requirements_composing',
    'social_communications',
  ]) {
    assert.equal(DD_SCENARIO_RECOMMENDATIONS.some((item) => item.key === key), false);
  }
  const manualDataQuality = DD_SCENARIO_RECOMMENDATIONS.filter((item) => item.key === 'manual_data_quality_control');
  assert.equal(manualDataQuality.length, 1);
  assert.doesNotMatch(manualDataQuality[0].sourceTool, /Навигатор/);

  for (const key of ['excel_reports', 'presentations']) {
    const exEl = DD_SCENARIO_RECOMMENDATIONS.find((item) => item.key === key);
    assert.match(exEl.recommendation, /EX-EL/);
    assert.deepEqual(exEl.resources, [{label: 'EX-EL', action: 'ex-el-access', placement: 'inline'}]);
  }
  assert.equal(
    DD_SCENARIO_RECOMMENDATIONS.find((item) => item.key === 'presentations').recommendation,
    'Для подготовки материалов рекомендуем использовать EX-EL.',
  );

  for (const item of DD_SCENARIO_RECOMMENDATIONS) {
    for (const resource of item.resources || []) {
      const visibleName = resource.toolLabel || resource.label;
      assert.doesNotMatch(visibleName, /^(ссылк|основн.*инструкц|шаблону|контактам|сервису|отч[её]ту)/i);
    }
  }
  assert.doesNotMatch(JSON.stringify(DD_SCENARIO_RECOMMENDATIONS), /ссылк/i);
});

test('focused time-in-work recommendation table retains Gravity UI resources and access modals', () => {
  assert.match(pageSource, /import \{[^}]*Table[^}]*\} from '@gravity-ui\/uikit'/);
  assert.match(pageSource, /function buildScenarioFocusColumns\(periodLabel\)[\s\S]*?name: 'Сценарий'[\s\S]*?name: `Доля · \$\{periodLabel\}`[\s\S]*?name: 'Время в работе · 25-й перцентиль по всем аналитикам'[\s\S]*?name: 'Медианное время в работе вашей команды'[\s\S]*?name: 'Рекомендация'/);
  assert.match(pageSource, /formatOptionalMetric\(item\.continuous25thHours, 'ч', 2\)/);
  assert.match(pageSource, /formatOptionalMetric\(item\.medianCycleTimeHours, 'ч', 1\)/);
  assert.match(pageSource, /width: '20%'[\s\S]*?width: '12%'[\s\S]*?width: '12%'[\s\S]*?width: '12%'[\s\S]*?width: '44%'/);
  assert.match(pageSource, /<Link href=\{resources\[0\]\.href\} target="_blank" rel="noreferrer">\{resources\[0\]\.label\}<\/Link>/);
  assert.match(pageSource, /function RecommendationCopy\(\{item\}\)[\s\S]*?allResources\.filter\(\(resource\) => resource\.placement === 'inline'\)[\s\S]*?text\.indexOf\(resource\.label, cursor\)[\s\S]*?<Link key=\{`\$\{resource\.href\}-\$\{start\}`\}/);
  assert.match(pageSource, /<button[^>]*className="backlog-inline-action"[^>]*aria-haspopup="dialog"/);
  assert.match(pageSource, /<Modal[\s\S]*?AI Toolkit «Продуктовый аналитик»[\s\S]*?AI HUB B2C \(CI06049712\)[\s\S]*?Хазипова Мария Юрьевна/);
  assert.match(pageSource, /const EX_EL_SERVICE_URL = 'https:\/\/qlik\.sigma\.sbrf\.ru\/qs_b2c_data\/scim_sigma\/extensions\/excelapp\/index\.html#\/'/);
  assert.match(pageSource, /name: 'АС'[\s\S]*?name: 'Роль'[\s\S]*?name: 'Комментарий'[\s\S]*?name: 'Блок'/);
  assert.match(pageSource, /<Modal[\s\S]*?id="ex-el-access-title"[\s\S]*?Если нет доступа, его можно оформить через АС Друг[\s\S]*?columns=\{EX_EL_ACCESS_COLUMNS\}[\s\S]*?data=\{EX_EL_ACCESS_ROWS\}/);
  assert.match(pageSource, /QS_B2C_DATA_A_CAU[\s\S]*?QS_B2C_DATA_S_CAU/);
  assert.doesNotMatch(pageSource, /DdScenarioRecommendationTable|buildScenarioRecommendation(?:Rows|Columns)|Рекомендации по сценариям работы|Справочная информация, визуализация разовая, для инфо/);
  assert.doesNotMatch(summarySource, /DdScenarioRecommendationTable|DD_SCENARIO_RECOMMENDATIONS/);
  assert.doesNotMatch(stylesSource, /dd-scenario-recommendations/);
  assert.match(pageSource, /medianTtm/);
  assert.doesNotMatch(pageSource, /TTM/);
  assert.match(stylesSource, /\.ex-el-access-modal\s*\{[^}]*--g-modal-width:\s*min\(1040px,/s);
  assert.match(stylesSource, /\.ex-el-access-table-scroll\s*\{[^}]*overflow-x:\s*auto;/s);
});

test('recommendations consistently retain inline resources and access modals', () => {
  assert.match(pageSource, /<span className="backlog-recommendation-copy">\{emphasizedParts\}<RecommendationResources item=\{item\} \/><\/span>/);
  assert.equal((pageSource.match(/<RecommendationCell><RecommendationCopy item=\{item\} \/><\/RecommendationCell>/g) || []).length, 1);
  assert.doesNotMatch(pageSource, /variant = 'default'|resourcesBelow|RecommendationToolBlock|backlog-useful-tools/);
  assert.doesNotMatch(stylesSource, /backlog-useful-tools|backlog-useful-tool-action/);
});

test('team time-in-work attention requires an actual 25th-percentile benchmark', () => {
  assert.equal(isMetricAbove(24.2, 1.86), true);
  assert.equal(isMetricAbove(24.2, null), false);
  assert.equal(isMetricAbove(24.2, undefined), false);
  assert.equal(isMetricAbove(24.2, ''), false);
});

test('high-share or long-time-in-work scenarios remain the only scenario recommendation table', () => {
  const recommendationCard = pageSource.slice(
    pageSource.indexOf('<section className="backlog-actions-grid">'),
    pageSource.indexOf('<Card className="backlog-method-note"'),
  );
  assert.match(recommendationCard, /Сценарии в фокусе/);
  assert.match(recommendationCard, /Доля &gt;10% или время в работе команды выше 25-го перцентиля/);
  assert.match(recommendationCard, /<Card className="backlog-list-card"[^>]*style=\{\{'\-\-g-card-background-color': 'var\(--g-color-base-background\)'\}\}/);
  assert.match(recommendationCard, /последний полный квартал · \{scenarioFocus\.periodLabel \|\| 'нет данных'\}/);
  assert.match(recommendationCard, /<Table className="backlog-focus-recommendations-table" columns=\{scenarioFocusColumns\} data=\{scenarioFocus\.items\}/);
  assert.match(recommendationCard, /нет сценариев с долей &gt;10% или временем в работе команды выше 25-го перцентиля и доступными рекомендациями/);
  assert.match(pageSource, /className="backlog-recommendation-copy"/);
  assert.match(pageSource, /segment === 'Предлагаемый инструментарий:'[\s\S]*?<strong key=\{`emphasis-/);
  assert.ok(pageSource.includes("part.split(/(Предлагаемый инструментарий:|\\d+"));
  assert.ok(pageSource.includes("(?=\\s+час(?:а|ов)?"));
  assert.match(stylesSource, /\.backlog-recommendation-copy\s*\{[^}]*white-space:\s*pre-line;/s);
  assert.match(pageSource, /name: `Доля · \$\{periodLabel\}`/);
  assert.doesNotMatch(pageSource, /DdScenarioRecommendationTable|Рекомендации по сценариям работы/);
  assert.match(stylesSource, /\.backlog-focus-recommendations-scroll\s*\{[^}]*overflow-x:\s*auto;/s);
});
