import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DD_SCENARIO_RECOMMENDATIONS} from './backlogScenarioRecommendations.js';
import {RecommendationCell} from './RecommendationCell.js';

const pageSource = readFileSync(new URL('./BacklogDecompositionPage.jsx', import.meta.url), 'utf8');
const summarySource = readFileSync(new URL('../features/llm-summary/LlmSummary.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('scenario recommendation source preserves the approved rows and exact copy', () => {
  assert.equal(DD_SCENARIO_RECOMMENDATIONS.length, 24);
  for (const item of DD_SCENARIO_RECOMMENDATIONS) {
    assert.ok(item.key);
    assert.ok(item.direction);
    assert.ok(item.scenario);
    assert.ok(item.info);
    assert.match(item.recommendation, /^Рекомендуем /);
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
  assert.match(openCode.recommendation, /OpenCode в Datalab AI — аналог Claude/);
  assert.match(openCode.recommendation, /Для оценки клиентских путей рекомендуем использовать LossHunter и CJExplorer/);
  assert.match(openCode.recommendation, /Также предлагаем воспользоваться AI Toolkit «Продуктовый аналитик»/);
  assert.deepEqual(openCode.resources, [
    {label: 'ссылке', href: 'https://mapp.sberbank.ru/b2cda/page/394333', placement: 'inline'},
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

  assert.equal(DD_SCENARIO_RECOMMENDATIONS.some((item) => item.key === 'exports_to_excel_regulator'), false);
  const manualDataQuality = DD_SCENARIO_RECOMMENDATIONS.filter((item) => item.key === 'manual_data_quality_control');
  assert.equal(manualDataQuality.length, 1);
  assert.doesNotMatch(manualDataQuality[0].sourceTool, /Навигатор/);

  for (const key of ['excel_reports', 'presentations']) {
    const exEl = DD_SCENARIO_RECOMMENDATIONS.find((item) => item.key === key);
    assert.match(exEl.recommendation, /EX-EL/);
    assert.deepEqual(exEl.resources, [{label: 'EX-EL', action: 'ex-el-access', placement: 'inline'}]);
  }
});

test('recommendation table uses Gravity UI and is the final backlog analytics section', () => {
  assert.match(pageSource, /import \{[^}]*Table[^}]*\} from '@gravity-ui\/uikit'/);
  assert.match(pageSource, /const columns = buildScenarioRecommendationColumns\(resourcesBelow\)[\s\S]*?<Table[\s\S]*?columns=\{columns\}[\s\S]*?data=\{rows\}[\s\S]*?wordWrap/);
  assert.match(pageSource, /name: 'Направление'[\s\S]*?name: 'Сценарий'[\s\S]*?name: '% времени в сценарии'[\s\S]*?name: 'TTM · топ-25%'[\s\S]*?name: 'TTM команды'[\s\S]*?name: 'Описание'[\s\S]*?name: 'Рекомендация тимлиду'/);
  assert.match(pageSource, /formatOptionalMetric\(item\.continuous25thHours, 'ч', 2\)/);
  assert.match(pageSource, /formatOptionalMetric\(item\.medianCycleTimeHours, 'ч', 1\)/);
  assert.match(pageSource, /<Link href=\{resources\[0\]\.href\} target="_blank" rel="noreferrer">\{resources\[0\]\.label\}<\/Link>/);
  assert.match(pageSource, /function RecommendationCopy\(\{item, resourcesBelow = false\}\)[\s\S]*?resourcesBelow \? \[\] : allResources\.filter\(\(resource\) => resource\.placement === 'inline'\)[\s\S]*?text\.indexOf\(resource\.label, cursor\)[\s\S]*?<Link key=\{`\$\{resource\.href\}-\$\{start\}`\}/);
  assert.match(pageSource, /<button[^>]*className="backlog-inline-action"[^>]*aria-haspopup="dialog"/);
  assert.match(pageSource, /<Modal[\s\S]*?AI Toolkit «Продуктовый аналитик»[\s\S]*?AI HUB B2C \(CI06049712\)[\s\S]*?Хазипова Мария Юрьевна/);
  assert.match(pageSource, /const EX_EL_SERVICE_URL = 'https:\/\/qlik\.sigma\.sbrf\.ru\/qs_b2c_data\/scim_sigma\/extensions\/excelapp\/index\.html#\/'/);
  assert.match(pageSource, /name: 'АС'[\s\S]*?name: 'Роль'[\s\S]*?name: 'Комментарий'[\s\S]*?name: 'Блок'/);
  assert.match(pageSource, /<Modal[\s\S]*?id="ex-el-access-title"[\s\S]*?Если нет доступа, его можно оформить через АС Друг[\s\S]*?columns=\{EX_EL_ACCESS_COLUMNS\}[\s\S]*?data=\{EX_EL_ACCESS_ROWS\}/);
  assert.match(pageSource, /QS_B2C_DATA_A_CAU[\s\S]*?QS_B2C_DATA_S_CAU/);
  assert.match(pageSource, /<Label theme="danger" size="m">Справочная информация, визуализация разовая, для инфо<\/Label>/);
  assert.ok(
    pageSource.indexOf('<DdScenarioRecommendationTable quarter={quarter} resourcesBelow={resourcesBelow} />') > pageSource.indexOf('<Card className="backlog-method-note"'),
  );
  assert.doesNotMatch(summarySource, /DdScenarioRecommendationTable|DD_SCENARIO_RECOMMENDATIONS/);
  assert.match(stylesSource, /\.dd-scenario-recommendations-scroll\s*\{[^}]*overflow-x:\s*auto;/s);
  assert.match(stylesSource, /\.dd-scenario-recommendations-table\s*\{\s*min-width:\s*1480px;/);
  assert.match(stylesSource, /\.ex-el-access-modal\s*\{[^}]*--g-modal-width:\s*min\(1040px,/s);
  assert.match(stylesSource, /\.ex-el-access-table-scroll\s*\{[^}]*overflow-x:\s*auto;/s);
});

test('decomposition v2 moves every recommendation resource into a useful-tools widget', () => {
  assert.match(pageSource, /const resourcesBelow = variant === 'v2'/);
  assert.match(pageSource, /const pageTitle = resourcesBelow \? 'Декомпозиция v2' : 'Декомпозиция бэклога'/);
  assert.match(pageSource, /<Text as="h1" variant="display-2">\{pageTitle\}<\/Text>/);
  assert.match(pageSource, /function RecommendationToolBlock\(\{item, onAction\}\)[\s\S]*?>Полезные инструменты<\/strong>/);
  assert.match(pageSource, /resource\.action[\s\S]*?className="backlog-useful-tool-action"[\s\S]*?onClick=\{\(\) => onAction\(resource\.action\)\}/);
  assert.match(pageSource, /<Link key=\{resource\.href\} href=\{resource\.href\} target="_blank" rel="noreferrer">/);
  assert.match(pageSource, /\{resourcesBelow && <RecommendationToolBlock item=\{item\} onAction=\{setAccessModal\} \/>\}/);
  assert.match(pageSource, /\{!resourcesBelow && <RecommendationResources item=\{item\} \/>\}/);
  assert.equal((pageSource.match(/<RecommendationCell><RecommendationCopy item=\{item\} resourcesBelow=\{resourcesBelow\} \/><\/RecommendationCell>/g) || []).length, 2);
  assert.match(stylesSource, /\.backlog-useful-tools\.metric-inline-instruction\s*\{[^}]*width:\s*100%;[^}]*margin:\s*10px 0 0;/s);
  assert.match(stylesSource, /\.backlog-useful-tools \.backlog-useful-tool-action\s*\{[^}]*display:\s*inline-flex;/s);
});

test('decomposition v2 useful-tools widget has valid block markup', () => {
  const html = renderToStaticMarkup(React.createElement(
    RecommendationCell,
    null,
    React.createElement('div', {className: 'backlog-useful-tools'}, 'Полезные инструменты'),
  ));
  assert.match(html, /^<div[^>]*class="backlog-recommendation-cell/);
  assert.match(html, /<div[^>]*backlog-useful-tools/);
  assert.doesNotMatch(html, /<span[^>]*>\s*<div[^>]*backlog-useful-tools/);
});

test('high-share or high-TTM scenario recommendations are rendered above the full recommendation table', () => {
  const recommendationCard = pageSource.slice(
    pageSource.indexOf('<section className="backlog-actions-grid">'),
    pageSource.indexOf('<Card className="backlog-method-note"'),
  );
  assert.match(recommendationCard, /Сценарии в фокусе/);
  assert.match(recommendationCard, /Доля &gt;10% или TTM команды выше TTM топ-25%/);
  assert.match(recommendationCard, /<Card className="backlog-list-card"[^>]*style=\{\{'\-\-g-card-background-color': 'var\(--g-color-base-background\)'\}\}/);
  assert.match(recommendationCard, /последний полный квартал · \{scenarioFocus\.periodLabel \|\| 'нет данных'\}/);
  assert.match(recommendationCard, /<Table className="backlog-focus-recommendations-table" columns=\{scenarioFocusColumns\} data=\{scenarioFocus\.items\}/);
  assert.match(recommendationCard, /нет сценариев с долей более 10% или превышением TTM топ-25% и доступными рекомендациями/);
  assert.match(pageSource, /className="backlog-recommendation-copy"/);
  assert.match(pageSource, /segment === 'Предлагаемый инструментарий:'[\s\S]*?<strong key=\{`emphasis-/);
  assert.ok(pageSource.includes("part.split(/(Предлагаемый инструментарий:|\\d+"));
  assert.ok(pageSource.includes("(?=\\s+час(?:а|ов)?"));
  assert.match(stylesSource, /\.backlog-recommendation-copy\s*\{[^}]*white-space:\s*pre-line;/s);
  assert.match(pageSource, /name: `Доля · \$\{periodLabel\}`/);
  assert.ok(pageSource.indexOf('className="backlog-focus-recommendations-table"') < pageSource.indexOf('<DdScenarioRecommendationTable quarter={quarter} resourcesBelow={resourcesBelow} />'));
  assert.match(stylesSource, /\.backlog-focus-recommendations-scroll\s*\{[^}]*overflow-x:\s*auto;/s);
});
