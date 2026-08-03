import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DD_SCENARIO_RECOMMENDATIONS} from './backlogScenarioRecommendations.js';

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
      else assert.equal(resource.action, 'product-analyst-access');
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
});

test('recommendation table uses Gravity UI and is the final backlog analytics section', () => {
  assert.match(pageSource, /import \{[^}]*Table[^}]*\} from '@gravity-ui\/uikit'/);
  assert.match(pageSource, /<Table[\s\S]*?columns=\{DD_SCENARIO_RECOMMENDATION_COLUMNS\}[\s\S]*?data=\{DD_SCENARIO_RECOMMENDATIONS\}[\s\S]*?wordWrap/);
  assert.match(pageSource, /name: 'Направление'[\s\S]*?name: 'Сценарий'[\s\S]*?name: 'Описание'[\s\S]*?name: 'Рекомендация тимлиду'/);
  assert.match(pageSource, /<Link href=\{resources\[0\]\.href\} target="_blank" rel="noreferrer">\{resources\[0\]\.label\}<\/Link>/);
  assert.match(pageSource, /function RecommendationCopy\(\{item\}\)[\s\S]*?resource\.placement === 'inline'[\s\S]*?text\.indexOf\(resource\.label, cursor\)[\s\S]*?<Link key=\{`\$\{resource\.href\}-\$\{start\}`\}/);
  assert.match(pageSource, /<button[^>]*className="backlog-inline-action"[^>]*aria-haspopup="dialog"/);
  assert.match(pageSource, /<Modal[\s\S]*?AI Toolkit «Продуктовый аналитик»[\s\S]*?AI HUB B2C \(CI06049712\)[\s\S]*?Хазипова Мария Юрьевна/);
  assert.ok(
    pageSource.indexOf('<DdScenarioRecommendationTable />') > pageSource.indexOf('<Card className="backlog-method-note"'),
  );
  assert.doesNotMatch(summarySource, /DdScenarioRecommendationTable|DD_SCENARIO_RECOMMENDATIONS/);
  assert.match(stylesSource, /\.dd-scenario-recommendations-scroll\s*\{[^}]*overflow-x:\s*auto;/s);
  assert.match(stylesSource, /\.dd-scenario-recommendations-table\s*\{\s*min-width:\s*1120px;/);
});

test('high-share benchmark breaches are rendered above the full recommendation table', () => {
  const recommendationCard = pageSource.slice(
    pageSource.indexOf('<section className="backlog-actions-grid">'),
    pageSource.indexOf('<Card className="backlog-method-note"'),
  );
  assert.match(recommendationCard, /Сценарии с долей более 10% и превышением бенчмарка/);
  assert.match(recommendationCard, /<Card className="backlog-list-card"[^>]*style=\{\{'\-\-g-card-background-color': 'var\(--g-color-base-background\)'\}\}/);
  assert.match(recommendationCard, /Последний полный квартал · \{scenarioFocus\.periodLabel \|\| 'нет данных'\}/);
  assert.match(recommendationCard, /<Table className="backlog-focus-recommendations-table" columns=\{scenarioFocusColumns\} data=\{scenarioFocus\.items\}/);
  assert.match(recommendationCard, /нет сценариев с долей более 10% и медианным временем команды выше бенчмарка лучших аналитиков/);
  assert.match(pageSource, /name: `Доля · \$\{periodLabel\}`/);
  assert.ok(pageSource.indexOf('className="backlog-focus-recommendations-table"') < pageSource.indexOf('<DdScenarioRecommendationTable />'));
  assert.match(stylesSource, /\.backlog-focus-recommendations-scroll\s*\{[^}]*overflow-x:\s*auto;/s);
});
