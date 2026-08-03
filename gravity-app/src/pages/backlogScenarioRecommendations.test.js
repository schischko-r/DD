import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DD_SCENARIO_RECOMMENDATIONS} from './backlogScenarioRecommendations.js';

const pageSource = readFileSync(new URL('./BacklogDecompositionPage.jsx', import.meta.url), 'utf8');
const summarySource = readFileSync(new URL('../features/llm-summary/LlmSummary.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('scenario recommendation source preserves the workbook columns and covers every row', () => {
  assert.equal(DD_SCENARIO_RECOMMENDATIONS.length, 26);
  for (const item of DD_SCENARIO_RECOMMENDATIONS) {
    assert.ok(item.key);
    assert.ok(item.direction);
    assert.ok(item.scenario);
    assert.ok(item.info);
    assert.match(item.recommendation, /^Рекомендуем /);
    for (const resource of item.resources || []) {
      assert.ok(resource.label);
      assert.match(resource.href, /^https:\/\//);
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
  assert.deepEqual(openCode.resources, [{label: 'ссылке', href: 'https://mapp.sberbank.ru/b2cda/page/394333'}]);
});

test('recommendation table uses Gravity UI and is the final backlog analytics section', () => {
  assert.match(pageSource, /import \{[^}]*Table[^}]*\} from '@gravity-ui\/uikit'/);
  assert.match(pageSource, /<Table[\s\S]*?columns=\{DD_SCENARIO_RECOMMENDATION_COLUMNS\}[\s\S]*?data=\{DD_SCENARIO_RECOMMENDATIONS\}[\s\S]*?wordWrap/);
  assert.match(pageSource, /name: 'Направление'[\s\S]*?name: 'Сценарий'[\s\S]*?name: 'Описание'[\s\S]*?name: 'Рекомендация тимлиду'/);
  assert.match(pageSource, /<Link href=\{resources\[0\]\.href\} target="_blank" rel="noreferrer">\{resources\[0\]\.label\}<\/Link>/);
  assert.ok(
    pageSource.indexOf('<DdScenarioRecommendationTable />') > pageSource.indexOf('<Card className="backlog-method-note"'),
  );
  assert.doesNotMatch(summarySource, /DdScenarioRecommendationTable|DD_SCENARIO_RECOMMENDATIONS/);
  assert.match(stylesSource, /\.dd-scenario-recommendations-scroll\s*\{[^}]*overflow-x:\s*auto;/s);
  assert.match(stylesSource, /\.dd-scenario-recommendations-table\s*\{\s*min-width:\s*1120px;/);
});

test('high-share scenario recommendations are rendered above the full table in the backlog recommendation card', () => {
  const recommendationCard = pageSource.slice(
    pageSource.indexOf('<section className="backlog-actions-grid">'),
    pageSource.indexOf('<Card className="backlog-method-note"'),
  );
  assert.match(recommendationCard, /Сценарии с долей более 10%/);
  assert.match(recommendationCard, /<Card className="backlog-list-card"[^>]*style=\{\{'\-\-g-card-background-color': 'var\(--g-color-base-background\)'\}\}/);
  assert.match(recommendationCard, /Последний полный квартал · \{scenarioFocus\.periodLabel \|\| 'нет данных'\}/);
  assert.match(recommendationCard, /<Table className="backlog-focus-recommendations-table" columns=\{scenarioFocusColumns\} data=\{scenarioFocus\.items\}/);
  assert.match(pageSource, /name: `Доля · \$\{periodLabel\}`/);
  assert.ok(pageSource.indexOf('className="backlog-focus-recommendations-table"') < pageSource.indexOf('<DdScenarioRecommendationTable />'));
  assert.match(stylesSource, /\.backlog-focus-recommendations-scroll\s*\{[^}]*overflow-x:\s*auto;/s);
});
