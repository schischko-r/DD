import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const appSource = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('./BacklogDecompositionPage.jsx', import.meta.url), 'utf8');
const teamProfileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const backlogStylesStart = stylesSource.indexOf('.backlog-header');
const backlogStylesEnd = stylesSource.indexOf('.dashboard-radar-card', backlogStylesStart);
const backlogBaseStyles = stylesSource.slice(backlogStylesStart, backlogStylesEnd);
const backlogResponsiveStyles = stylesSource.split('\n').filter((line) => line.includes('@media') && line.includes('.backlog')).join('\n');
const backlogStyleRules = `${backlogBaseStyles}\n${backlogResponsiveStyles}`;

const helpersStart = pageSource.indexOf('const GROUPING_OPTIONS');
const helpersEnd = pageSource.indexOf('function KpiCard');
const helpersSource = pageSource.slice(helpersStart, helpersEnd).replaceAll('export function', 'function');
const {selectQuarter, getTeamDatasets, selectTeamDataset, selectLatestMonth, monthsThroughQuarter, buildDashboardInsights, buildScenarioFocusRecommendations, buildBacklogChartData, buildScenarioRankingChartData, buildKpiMiniChartData, formatFreshnessDate} = Function(
  `${helpersSource}; return {selectQuarter, getTeamDatasets, selectTeamDataset, selectLatestMonth, monthsThroughQuarter, buildDashboardInsights, buildScenarioFocusRecommendations, buildBacklogChartData, buildScenarioRankingChartData, buildKpiMiniChartData, formatFreshnessDate};`,
)();

test('backlog decomposition is a dedicated sidebar view with its own data source', () => {
  assert.match(appSource, /import \{BacklogDecompositionPage\} from '\.\.\/pages\/BacklogDecompositionPage\.jsx'/);
  assert.match(appSource, /fetch\('\.\/backlog-data\.json', \{cache: 'no-store'\}\)/);
  assert.match(appSource, /id="backlog"/);
  assert.match(appSource, /title="Декомпозиция бэклога"/);
  assert.match(appSource, /import \{[^\n]*Ticket[^\n]*\} from '@gravity-ui\/icons'/);
  assert.match(appSource, /id="backlog"[\s\S]*?icon=\{Ticket\}/);
  assert.match(appSource, /current=\{view === 'backlog'\}/);
  assert.match(appSource, /onItemClick=\{\(\) => openBacklog\(\)\}/);
  assert.match(appSource, /view === 'backlog'[\s\S]*?<BacklogDecompositionPage/);
  assert.doesNotMatch(appSource, /BacklogDecompositionV2Page|backlog-v2|openBacklogV2|\bCopy\b/);
  assert.match(appSource, /import \{AsideHeader, FooterItem\} from '@gravity-ui\/navigation'/);
  assert.match(appSource, /import \{Divider, Flex, Spin\} from '@gravity-ui\/uikit'/);
  assert.match(appSource, /renderFooter=\{\(\{compact: footerCompact\}\) => \([\s\S]*?<Divider \/>[\s\S]*?<FooterItem[\s\S]*?id="backlog"/);
  assert.ok(appSource.indexOf('id="backlog"') > appSource.indexOf('menuItems={menuItems}'), 'backlog belongs to the footer, not the main menu');
  const mainMenuSource = appSource.slice(appSource.indexOf('const menuItems = ['), appSource.indexOf('const openBacklog'));
  assert.doesNotMatch(mainMenuSource, /(?:id:|id=)\s*['"]backlog['"]/);
  assert.ok(appSource.indexOf('renderFooter=') > appSource.indexOf('menuItems={menuItems}'));
  assert.ok(appSource.indexOf('renderContent=') > appSource.indexOf('renderFooter='));
  assert.doesNotMatch(stylesSource, /dd-navigation-backlog-footer|\.gn-footer-item/);
});

test('backlog can return to the selected team profile with exact normalized name matching', () => {
  assert.match(appSource, /const normalizeTeamName = \(value\) => String\(value \|\| ''\)\.trim\(\)\.replace\(\/\\s\+\/g, ' '\)\.toLocaleLowerCase\('ru-RU'\)/);
  const openTeamSource = appSource.slice(appSource.indexOf('const openBacklogTeam ='), appSource.indexOf('const content ='));
  assert.match(openTeamSource, /\[teamDataset\?\.label, teamDataset\?\.meta\?\.teamLabel\]/);
  assert.match(openTeamSource, /requestedNames\.includes\(normalizeTeamName\(item\?\.name\)\)/);
  assert.match(openTeamSource, /normalizeTeamName\(item\?\.name\) === normalizeTeamName\('СберЧаевые'\)/);
  assert.match(openTeamSource, /setSelected\(target\);[\s\S]*?setView\('detail'\);[\s\S]*?window\.scrollTo\(0, 0\)/);
  assert.match(appSource, /<BacklogDecompositionPage data=\{backlog\.data\} status=\{backlog\.status\} onOpenTeam=\{openBacklogTeam\} initialTeamKey=\{backlogTeamKey\} \/>/);

  assert.match(pageSource, /import \{ArrowLeft, ChartColumn, Check, CircleFill, CircleInfo\} from '@gravity-ui\/icons'/);
  assert.match(pageSource, /import \{Box, Button, Card, Divider/);
  assert.match(pageSource, /BacklogDecompositionPage\(\{data, status = 'ready', onOpenTeam, initialTeamKey = ''\}\)/);
  assert.match(pageSource, /\{onOpenTeam && <Box spacing=\{\{mb: 2\}\}><Button view="flat" size="m" onClick=\{\(\) => onOpenTeam\(team\)\}><Icon data=\{ArrowLeft\} size=\{16\} \/>Назад к карточке команды<\/Button><\/Box>\}/);
});

test('backlog CTA is available for every team represented in backlog data and opens that team', () => {
  assert.match(appSource, /const backlogTeams = Array\.isArray\(backlog\.data\?\.teams\) \? backlog\.data\.teams : \[\]/);
  assert.match(appSource, /const productBacklogTeam = backlogTeams\.find/);
  assert.match(appSource, /teamNames\.includes\(normalizeTeamName\(product\?\.name\)\)/);
  assert.match(teamProfileSource, /metric\.code\s*===\s*['"]hyp\.discovery_40_backlog['"]/);
  assert.doesNotMatch(teamProfileSource, /product\.name\s*===\s*['"]СберЧаевые['"]/);
  assert.match(teamProfileSource, /title:\s*['"]Декомпозиция бэклога['"]/);
  assert.match(teamProfileSource, /label:\s*['"]Декомпозиция бэклога['"]/);
  assert.match(teamProfileSource, /onClick:\s*onBacklog/);
  assert.match(appSource, /const openBacklog = \(teamKey = ''\) => \{[\s\S]*?setBacklogTeamKey\(String\(teamKey \|\| ''\)\);[\s\S]*?setView\('backlog'\)/);
  assert.match(appSource, /onBacklog=\{productBacklogTeam \? \(\) => openBacklog\(productBacklogTeam\.key\) : undefined\}/);
  assert.match(appSource, /initialTeamKey=\{backlogTeamKey\}/);
  assert.match(pageSource, /BacklogDecompositionPage\(\{data, status = 'ready', onOpenTeam, initialTeamKey = ''\}\)/);
  assert.match(pageSource, /String\(initialTeamKey \|\| teams\[0\]\?\.key \|\| ''\)/);
  assert.match(pageSource, /const appliedInitialTeamKey = useRef\(null\)/);
  assert.match(pageSource, /requestedTeamKey !== appliedInitialTeamKey\.current/);
});

test('page uses Gravity UI stacked bars with a Created-only grouping switch', () => {
  assert.match(pageSource, /import \{Chart\} from ['"]@gravity-ui\/charts['"]/);
  assert.match(pageSource, /type:\s*['"]bar-x['"]/);
  assert.match(pageSource, /stacking:\s*['"]normal['"]/);

  for (const label of ['Направления', 'Сценарии']) {
    assert.match(pageSource, new RegExp(label));
  }

  assert.match(pageSource, /<Select\b[^>]*value=\{\[grouping\]\}/);
  assert.doesNotMatch(pageSource, /SegmentedRadioGroup|measure/i);
});

test('dashboard defaults to the latest available quarter and labels partial periods', () => {
  const quarters = [
    {key: '2023-Q4', isComplete: true},
    {key: '2024-Q1', isComplete: true},
    {key: '2024-Q2', isComplete: false},
  ];
  assert.equal(selectQuarter(quarters).key, '2024-Q2');
  assert.equal(selectQuarter([{key: '2024-Q2', isComplete: false}]).key, '2024-Q2');
  assert.equal(selectQuarter([]), null);
  assert.match(pageSource, /isComplete === false \? `\$\{label\} · неполный` : label/);
  assert.match(pageSource, /options=\{quarterOptions\} onUpdate=\{\(value\) => setSelectedQuarterKey/);
  assert.match(pageSource, /setSelectedQuarterKey/);
  assert.match(pageSource, /monthsForQuarter\(months, quarter\)/);
});

test('quarter filter keeps history through the selected quarter and hides later months', () => {
  const history = Array.from({length: 9}, (_, index) => {
    const month = index + 1;
    return {key: `2024-${String(month).padStart(2, '0')}`, label: `Месяц ${month}`};
  });
  const q2 = {key: '2024-Q2', monthKeys: ['2024-04', '2024-05', '2024-06']};
  const q1 = {key: '2024-Q1', monthKeys: ['2024-01', '2024-02', '2024-03']};

  assert.deepEqual(
    monthsThroughQuarter(history, q2).map((month) => month.key),
    ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'],
  );
  assert.deepEqual(
    monthsThroughQuarter(history, q1).map((month) => month.key),
    ['2024-01', '2024-02', '2024-03'],
  );
  assert.deepEqual(
    monthsThroughQuarter(history, {key: '2024-Q2'}).map((month) => month.key),
    ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'],
  );
  assert.deepEqual(monthsThroughQuarter(history, {key: 'invalid-quarter'}), []);
  assert.match(pageSource, /const visibleMonths = useMemo\(\(\) => monthsThroughQuarter\(months, quarter\), \[months, quarter\]\)/);
});

test('created KPI uses the selected-quarter total while mini charts remain monthly', () => {
  const selectedMonths = [
    {key: '2024-04', label: 'Апрель 2024', createdCount: 8},
    {key: '2024-05', label: 'Май 2024', createdCount: 13},
  ];

  assert.deepEqual(selectLatestMonth(selectedMonths), selectedMonths[1]);
  assert.equal(selectLatestMonth([]), null);
  assert.doesNotMatch(pageSource, /const latestMonth = selectLatestMonth\(selectedMonths\)/);
  assert.doesNotMatch(pageSource, /latestMonthCreated/);
  assert.match(pageSource, /value=\{formatNumber\(created\)\} label="Создано за квартал" note=\{selectedPeriodLabel\}/);
  assert.match(pageSource, /const selectedPeriodLabel = shortQuarterLabel\(quarter\)/);
  assert.equal((pageSource.match(/buildKpiMiniChartData\(visibleMonths,/g) || []).length, 5);
});

test('dashboard insights consume the backend quarter schema and enforce the 40 percent goal', () => {
  const missed = buildDashboardInsights({
    discoveryCount: 2,
    discoveryShare: 33.33,
    createdCount: 6,
    resolvedCount: 4,
    netFlow: 1,
    exportRoutineShare: 50,
    automationShare: 33.33,
    unknownShare: 16.67,
    storyPointsFilledShare: 75,
  });
  assert.equal(missed.confirmed, false);
  assert.equal(missed.missingDiscovery, 1);
  assert.ok(Math.abs(missed.gap - 6.67) < 0.001);
  assert.ok(missed.insights.some((item) => item.title.includes('Discovery')));
  assert.ok(missed.insights.every((item) => item.title && item.text));
  assert.ok(missed.recommendations.some((item) => item.title === 'Зарезервировать ≥40% задач под аналитику и исследования'));
  assert.ok(missed.recommendations.some((item) => item.title.includes('Автоматизировать')));
  assert.ok(missed.recommendations.some((item) => item.title === 'Улучшить заполнение задач'));
  assert.ok(!missed.recommendations.some((item) => item.title === 'Ограничить WIP и закрыть разрыв потока'));
  assert.equal(missed.recommendations[0].text, 'Рекомендуем заполнять поле Story Points / Относительная сложность для планирования. Базовой считается нагрузка 6,4 SP в день для аналитика. Подробнее можно почитать здесь');
  assert.deepEqual(missed.recommendations[0].resources, [{
    label: 'здесь',
    href: 'https://confluence.sberbank.ru/pages/viewpage.action?pageId=15525024800',
    placement: 'inline',
  }]);
  assert.ok(missed.recommendations.some((item) => item.text.includes('Повысить полноту описаний и заполнение обязательных полей')));
  assert.ok(missed.recommendations.some((item) => item.text.includes('Сейчас направление не определено у 16,7% задач')));
  const recommendationCopy = missed.recommendations.map(({title, text}) => `${title} ${text}`).join(' ');
  assert.doesNotMatch(recommendationCopy, /Классифицировать задачи без направления/);
  assert.doesNotMatch(recommendationCopy, /Разметить направление/);
  assert.ok(!missed.recommendations.some((item) => item.title.includes('без сценария')));

  const confirmed = buildDashboardInsights({createdCount: 5, discoveryCount: 2, discoveryShare: 40, storyPointsFilledShare: 90});
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.gap, 0);
  assert.equal(confirmed.missingDiscovery, 0);
  assert.ok(confirmed.insights[0].title.includes('Discovery'));
  assert.ok(!confirmed.recommendations.some((item) => item.title.includes('≥40%')));
  assert.ok(!confirmed.recommendations.some((item) => item.text.includes('Story Points')));
});

test('insights use Created as the shared denominator', () => {
  const {insights} = buildDashboardInsights({
    discoveryCount: 2,
    discoveryShare: 20,
    createdCount: 10,
    resolvedCount: 7,
    netFlow: 2,
    endBacklogCount: 6,
    exportRoutineCount: 5,
    exportRoutineShare: 50,
    automationCount: 1,
    automationShare: 20,
  });

  assert.ok(insights.every((item) => typeof item === 'object' && item.title && item.text));
  assert.match(insights[0].text, /2 из 10 задач, созданных в выбранном квартале — 20%/);
  assert.match(insights[1].text, /50% созданных задач \(задач: 5\); задачи про автоматизацию — 20% созданных задач \(задач: 1\)/);
  const visibleCopy = insights.map(({title, text}) => `${title} ${text}`).join(' ');
  assert.doesNotMatch(visibleCopy, /усили[йя]|трудо(?:затрат|ёмк|емк)|причин|потому|из-за|вызван/i);
});

test('scenario focus recommendations use high share or team time in work above the benchmark', () => {
  const result = buildScenarioFocusRecommendations([
    {key: '2026-Q1', isComplete: true, createdCount: 10, scenarios: [
      {key: 'alpha', label: 'Alpha', count: 5, continuous25thHours: 1, medianCycleTimeHours: 25, cycleTimeSampleCount: 1},
    ]},
    {key: '2026-Q2', isComplete: true, createdCount: 20, scenarios: [
      {key: 'alpha', label: 'Alpha', count: 3, continuous25thHours: 2.11, medianCycleTimeHours: 51.5, cycleTimeSampleCount: 4},
      {key: 'ten-percent', label: 'Ten percent', count: 2, continuous25thHours: 1, medianCycleTimeHours: 25, cycleTimeSampleCount: 2},
      {key: 'below-benchmark', label: 'Below benchmark', count: 3, continuous25thHours: 48, medianCycleTimeHours: 47, cycleTimeSampleCount: 2},
      {key: 'at-benchmark', label: 'At benchmark', count: 3, continuous25thHours: 48, medianCycleTimeHours: 48, cycleTimeSampleCount: 2},
      {key: 'small', label: 'Small', count: 1, continuous25thHours: 1, medianCycleTimeHours: 25, cycleTimeSampleCount: 2},
    ]},
    {key: '2026-Q3', isComplete: false, createdCount: 1, scenarios: [
      {key: 'alpha', label: 'Alpha', count: 1, continuous25thHours: 1, medianCycleTimeHours: 100, cycleTimeSampleCount: 1},
    ]},
  ], [
    {key: 'alpha', recommendation: 'Рекомендуем первое.', resources: [{label: 'ссылке', href: 'https://example.test/a'}]},
    {key: 'alpha', recommendation: 'Рекомендуем второе.', resources: [{label: 'ссылке', href: 'https://example.test/a'}]},
    {key: 'ten-percent', recommendation: 'Рекомендуем порог доли.'},
    {key: 'below-benchmark', recommendation: 'Рекомендуем порог времени.'},
    {key: 'at-benchmark', recommendation: 'Рекомендуем равный порог.'},
    {key: 'small', recommendation: 'Рекомендуем малую долю.'},
  ]);

  assert.equal(result.quarter.key, '2026-Q2');
  assert.equal(result.periodLabel, '2Q26');
  assert.equal(result.items.length, 5);
  assert.equal(result.items[0].scenario, 'Alpha');
  assert.equal(result.items[0].share, 15);
  assert.equal(result.items.some((item) => item.key === 'ten-percent'), true, 'exactly 10% is included when team time in work exceeds the benchmark');
  assert.equal(result.items.some((item) => item.key === 'below-benchmark'), true, 'a high-share scenario is included below the benchmark');
  assert.equal(result.items.some((item) => item.key === 'at-benchmark'), true, 'a high-share scenario is included at the benchmark');
  assert.equal(result.items.some((item) => item.key === 'small'), true, 'a low-share scenario is included when team time in work exceeds the benchmark');
  assert.equal(result.items[0].recommendation, '25-й перцентиль аналитиков выполняет такие задачи за 2,11 часа.\nЗначение по вашей команде: 51,5 часов.\n\nПредлагаемый инструментарий: Рекомендуем первое. Рекомендуем второе.');
  assert.equal(result.items[0].recommendationSummary, '25-й перцентиль аналитиков выполняет такие задачи за 2,11 часа.\nЗначение по вашей команде: 51,5 часов.');
  assert.equal(result.items[0].toolRecommendation, 'Рекомендуем первое. Рекомендуем второе.');
  assert.deepEqual(result.items[0].resources, [{label: 'ссылке', href: 'https://example.test/a'}]);
  assert.deepEqual(buildScenarioFocusRecommendations([{key: '2026-Q3', isComplete: false}], []).items, []);
});

test('scenario focus recommendations exclude manual updates, BI bugfixes and employee training', () => {
  const excludedKeys = ['dashboard_manual_data_update', 'BI_bugfix', 'employee_trainings'];
  const result = buildScenarioFocusRecommendations([{
    key: '2026-Q2',
    isComplete: true,
    createdCount: 30,
    scenarios: excludedKeys.map((key) => ({
      key,
      label: key,
      count: 10,
      continuous25thHours: 1,
      medianCycleTimeHours: 25,
      cycleTimeSampleCount: 5,
    })),
  }], excludedKeys.map((key) => ({key, recommendation: `Рекомендуем ${key}.`})));

  assert.deepEqual(result.items, []);
  assert.match(pageSource, /const SCENARIO_RECOMMENDATION_EXCLUSIONS = new Set\(\[[\s\S]*?'dashboard_manual_data_update'[\s\S]*?'bi_bugfix'[\s\S]*?'employee_trainings'/);
});

test('unmapped scenarios retain only their quality recommendation', () => {
  const recommendation = 'Рекомендуем повысить качество описаний задач для более корректного мапинга задач с нашей стороны';
  const result = buildScenarioFocusRecommendations([{
    key: '2026-Q2',
    isComplete: true,
    createdCount: 10,
    scenarios: [
      {key: 'unknown', label: 'Невозможно разметить', count: 2, continuous25thHours: 2.11, medianCycleTimeHours: 51.5, cycleTimeSampleCount: 4},
      {key: 'other', label: 'Невозможно разметить', count: 2, continuous25thHours: 2.11, medianCycleTimeHours: 51.5, cycleTimeSampleCount: 4},
    ],
  }], [
    {key: 'unknown', recommendation},
    {key: 'other', recommendation},
  ]);

  assert.equal(result.items.length, 2);
  for (const item of result.items) {
    assert.equal(item.recommendationSummary, '');
    assert.equal(item.toolRecommendation, recommendation);
    assert.equal(item.recommendation, recommendation);
    assert.equal(item.isUnmappedScenario, true);
    assert.doesNotMatch(item.recommendation, /25-й перцентиль|Значение по вашей команде|Предлагаемый инструментарий:/);
  }
  assert.match(pageSource, /item\.isUnmappedScenario \? '—' : formatOptionalMetric\(item\.continuous25thHours, 'ч', 2\)/);
  assert.match(pageSource, /item\.isUnmappedScenario \? '—' : formatOptionalMetric\(item\.medianCycleTimeHours, 'ч', 1\)/);
});

test('scenario focus recommendations require a high share when benchmark data is unavailable', () => {
  const recommendationRows = [
    {key: 'missing-sample', recommendation: 'Рекомендуем выборку.'},
    {key: 'zero-sample', recommendation: 'Рекомендуем выборку.'},
    {key: 'missing-benchmark', recommendation: 'Рекомендуем бенчмарк.'},
    {key: 'missing-median', recommendation: 'Рекомендуем медиану.'},
    {key: 'high-share-missing-benchmark', recommendation: 'Рекомендуем высокий приоритет.'},
  ];
  const result = buildScenarioFocusRecommendations([{
    key: '2026-Q2',
    isComplete: true,
    createdCount: 40,
    scenarios: [
      {key: 'missing-sample', count: 3, continuous25thHours: 1, medianCycleTimeHours: 25},
      {key: 'zero-sample', count: 3, continuous25thHours: 1, medianCycleTimeHours: 25, cycleTimeSampleCount: 0},
      {key: 'missing-benchmark', count: 3, medianCycleTimeHours: 25, cycleTimeSampleCount: 2},
      {key: 'missing-median', count: 3, continuous25thHours: 1, medianCycleTimeHours: null, cycleTimeSampleCount: 2},
      {key: 'high-share-missing-benchmark', count: 5, medianCycleTimeHours: 25, cycleTimeSampleCount: 2},
    ],
  }], recommendationRows);

  assert.deepEqual(result.items.map((item) => item.key), ['high-share-missing-benchmark']);
  assert.equal(result.items[0].recommendation, 'Предлагаемый инструментарий: Рекомендуем высокий приоритет.');
  assert.equal(result.items[0].recommendationSummary, '');
  assert.equal(result.items[0].toolRecommendation, 'Рекомендуем высокий приоритет.');
});

test('scenario focus recommendations preserve approved resources and exclude unapproved regulator exports', () => {
  const resources = [
    {label: 'ссылке', href: 'https://example.test/guide', placement: 'inline'},
    {label: 'Продуктовый аналитик', action: 'product-analyst-access', placement: 'inline'},
  ];
  const result = buildScenarioFocusRecommendations([{
    key: '2026-Q2',
    isComplete: true,
    createdCount: 20,
    scenarios: [
      {key: 'customer_experience_analytics', count: 3, continuous25thHours: 1, medianCycleTimeHours: 25, cycleTimeSampleCount: 2},
      {key: 'exports_to_excel_regulator', count: 3, continuous25thHours: 1, medianCycleTimeHours: 25, cycleTimeSampleCount: 2},
    ],
  }], [{
    key: 'customer_experience_analytics',
    recommendation: 'Рекомендуем перейти по ссылке и открыть Продуктовый аналитик.',
    resources,
  }]);

  assert.deepEqual(result.items.map((item) => item.key), ['customer_experience_analytics']);
  assert.deepEqual(result.items[0].resources, resources);
  assert.match(result.items[0].recommendation, /Предлагаемый инструментарий: Рекомендуем перейти по ссылке и открыть Продуктовый аналитик\.$/);
});

test('quarter dashboard exposes goal, KPI and evidence panels in a compact layout', () => {
  for (const label of [
    'Цель подтверждена',
    'Цель не подтверждена',
    'Доля Discovery в созданных задачах квартала',
    'Создано за квартал',
    'Завершено из созданных',
    'Медианное время в работе',
    'Заполнение Story Points',
    'Рутина',
    'Автоматизация',
    'Структура созданных задач',
    'Топ сценариев',
    'Рекомендации',
  ]) {
    assert.match(pageSource, new RegExp(label));
  }
  assert.match(pageSource, /const DISCOVERY_TARGET = 40/);
  assert.match(stylesSource, /\.backlog-kpi-grid\s*\{[^}]*grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/s);
  assert.match(stylesSource, /\.backlog-kpi-card--combined\s*\{[^}]*grid-column:\s*span 2/s);
  assert.match(pageSource, /import \{Box, Button, Card, Divider, Flex, Icon, Label,[^}]*Progress/);
  const goalCardSource = pageSource.slice(pageSource.indexOf('<Card className="backlog-goal-card"'), pageSource.indexOf('<section className="backlog-kpi-grid"'));
  for (const gravityComponent of ['Card', 'Flex', 'Text', 'Progress', 'Label']) {
    assert.match(goalCardSource, new RegExp(`<${gravityComponent}\\b`));
  }
  assert.match(goalCardSource, /view="outlined" size="l" spacing=\{\{p: 5\}\}/);
  assert.match(pageSource, /const discoveryGoalProgress = Math\.min\(100, Math\.max\(0, discoveryShare \/ DISCOVERY_TARGET \* 100\)\)/);
  assert.match(goalCardSource, /<Box className="backlog-goal-progress-row">[\s\S]*?<Flex className="backlog-goal-scale"[\s\S]*?<Box className="backlog-goal-progress"><Progress value=\{discoveryGoalProgress\} theme=\{dashboard\.confirmed \? 'default' : 'danger'\} size="m" \/><\/Box>[\s\S]*?Факт \{formatPercentValue\(discoveryShare\)\}[\s\S]*?Цель \{DISCOVERY_TARGET\}%[\s\S]*?<Flex className="backlog-goal-metrics" gap="6" wrap>[\s\S]*?Разрыв до цели[\s\S]*?Задач до цели/);
  assert.match(goalCardSource, /\{formatNumber\(discoveryCount\)\} из \{formatNumber\(created\)\} созданных задач/);
  assert.match(stylesSource, /\.backlog-goal-progress-row\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;[^}]*align-items:\s*end;/s);
  assert.match(stylesSource, /\.backlog-goal-scale\s*\{\s*min-width:\s*0;\s*\}/);
  assert.match(stylesSource, /\.backlog-goal-progress\s*\{\s*width:\s*100%;\s*\}/);
  const mobileGoalLine = stylesSource.split('\n').find((line) => line.includes('@media (max-width: 760px)') && line.includes('.backlog-goal-progress-row')) || '';
  assert.match(mobileGoalLine, /\.backlog-goal-progress-row\s*\{\s*grid-template-columns:\s*1fr;\s*\}/);
  assert.doesNotMatch(pageSource, /backlog-goal-detail|backlog-goal-note/);
  assert.doesNotMatch(stylesSource, /\.backlog-goal-detail|\.backlog-goal-note/);
  assert.match(pageSource, /function KpiCard[\s\S]*?<Card[^>]*view="outlined"[^>]*spacing=\{\{p: 4\}\}[\s\S]*?<Text[^>]*variant="caption-2"[\s\S]*?<Text[^>]*variant="header-2"[\s\S]*?<Text[^>]*variant="body-1"/);
  assert.match(stylesSource, /\.backlog-kpi-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s);
  assert.match(stylesSource, /\.backlog-kpi-card--combined\s*\{\s*grid-column:\s*span 2;\s*\}/);
  assert.match(stylesSource, /\.backlog-kpi-comparison\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  const mediaLine = (width) => stylesSource.split('\n').find((line) => line.includes(`@media (max-width: ${width}px)`) && line.includes('.backlog-kpi-grid')) || '';
  assert.match(mediaLine(1200), /\.backlog-kpi-grid(?:,\s*\.backlog-insight-grid)?\s*\{[^}]*grid-template-columns:\s*repeat\(4,/);
  assert.match(mediaLine(760), /\.backlog-kpi-grid(?:,\s*\.backlog-insight-grid)?\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
  assert.match(mediaLine(480), /\.backlog-kpi-grid(?:,\s*\.backlog-insight-grid)?\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(mediaLine(480), /\.backlog-kpi-card--combined\s*\{\s*grid-column:\s*auto;\s*\}/);
  assert.match(stylesSource, /\.backlog-chart\s*\{[^}]*height:\s*306px;/s);
});

test('dashboard header keeps Gravity UI filters beside the title like the team card', () => {
  assert.equal(formatFreshnessDate('2026-07-10'), '10 июля 2026 г.');
  assert.match(pageSource, /const freshness = formatFreshnessDate\(team\?\.meta\?\.asOf \|\| data\?\.meta\?\.asOf\)/);
  const headerSource = pageSource.slice(pageSource.indexOf('<header className="backlog-header">'), pageSource.indexOf('</header>'));
  assert.match(headerSource, /<Text as="h1"[^>]*>Декомпозиция бэклога<\/Text>/);
  assert.doesNotMatch(pageSource, /variant = 'default'|resourcesBelow|pageTitle|RecommendationToolBlock|backlog-useful-tools/);
  assert.match(headerSource, /<Flex[^>]*alignItems="center"[^>]*gap="2"[^>]*>[\s\S]*?Данные на \{freshness\}/);
  assert.match(headerSource, /<Flex className="backlog-header-controls" alignItems="flex-end" gap="3">/);
  assert.match(headerSource, /aria-label="Команда"/);
  assert.match(headerSource, /aria-label="Квартал"/);
  assert.doesNotMatch(headerSource, /popupClassName/);
  assert.doesNotMatch(pageSource, /backlog-toolbar|Все показатели и выводы ниже обновляются/);
  assert.doesNotMatch(stylesSource, /\.backlog-toolbar|\.backlog-toolbar-row|\.backlog-scope-controls/);
  assert.match(stylesSource, /\.backlog-header\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/s);
  assert.match(stylesSource, /\.backlog-filter-control\s*\{[^}]*width:\s*214px;[^}]*min-width:\s*0;/s);
});

test('KPI and recommendations are composed from neutral Gravity UI primitives', () => {
  assert.match(pageSource, /<Card className="backlog-kpi-card" view="outlined" size="l"/);
  assert.match(pageSource, /<Box className="backlog-kpi-chart" spacing=\{\{px: 2, py: 1\}\} role="img" aria-label=\{`Помесячная динамика: \$\{label\}\. Единица измерения: \$\{chartUnit\}\$\{referenceText\}`\}><Chart data=\{chartData\} lang="ru" \/><\/Box>/);
  assert.match(pageSource, /chartData=\{kpiMiniCharts\.(?:created|createdResolved|routineAutomation)\}/);
  assert.doesNotMatch(pageSource, /createdOpen|Открыто из созданных/);
  assert.match(pageSource, /chartUnit="задач"/);
  assert.match(pageSource, /<RoutineAutomationCard periodLabel=\{selectedPeriodLabel\} total=\{created\} routineShare=\{routineShare\} routineCount=\{routineCount\} automationShare=\{automationShare\} automationCount=\{automationCount\} chartData=\{kpiMiniCharts\.routineAutomation\} \/>/);
  assert.match(pageSource, /function RoutineAutomationCard\(\{periodLabel,[^}]+\}[\s\S]*?>\{periodLabel\}<\/Text>/);
  assert.equal((pageSource.match(/\$\{selectedPeriodLabel\} ·/g) || []).length, 3);
  assert.match(pageSource, /function RoutineAutomationCard[\s\S]*?<Card className="backlog-kpi-card backlog-kpi-card--combined" view="outlined" size="l"/);
  assert.match(pageSource, /<Flex className="backlog-kpi-chart-layout" alignItems="stretch" gap="2">[\s\S]*?<Chart data=\{chartData\} lang="ru" \/>[\s\S]*?<Flex className="backlog-kpi-chart-legend" direction="column" justifyContent="center" gap="1" role="list" aria-label="Легенда графика">/);
  assert.match(pageSource, /<Text color="danger"><Icon data=\{CircleFill\} size=\{8\} \/><\/Text><Text variant="caption-2">Рутина<\/Text>/);
  assert.match(pageSource, /<Text color="info"><Icon data=\{CircleFill\} size=\{8\} \/><\/Text><Text variant="caption-2">Автоматизация<\/Text>/);
  assert.match(pageSource, /className="backlog-kpi-chart backlog-kpi-chart--comparison" spacing=\{\{px: 2, py: 1\}\}/);
  assert.match(pageSource, /Помесячная динамика рутины и автоматизации\. Единица измерения: %/);
  assert.match(stylesSource, /\.backlog-kpi-chart\s*\{[^}]*width:\s*100%;[^}]*height:\s*52px;[^}]*min-height:\s*52px;[^}]*margin-top:\s*auto;/s);
  assert.match(stylesSource, /\.backlog-kpi-chart--comparison\s*\{\s*height:\s*72px;\s*min-height:\s*72px;\s*\}/);
  assert.match(stylesSource, /\.backlog-kpi-chart-layout \.backlog-kpi-chart\s*\{[^}]*width:\s*auto;[^}]*flex:\s*1 1 0;/s);
  assert.match(stylesSource, /\.backlog-kpi-chart-legend\s*\{[^}]*min-width:\s*max-content;[^}]*flex:\s*none;/s);
  assert.doesNotMatch(pageSource, /VERTICAL_LEGEND_ITEM_DISTANCE|Number\.MAX_SAFE_INTEGER/);
  assert.match(pageSource, /dashboard\.recommendations\.map[\s\S]*?<Label theme="normal"[\s\S]*?<Divider \/>/);
  assert.match(pageSource, /<RecommendationCopy item=\{item\} \/>/);
  assert.match(pageSource, /resource\.placement === 'after'[\s\S]*?<Link href=\{resource\.href\} target="_blank" rel="noreferrer">\{resource\.label\}<\/Link>/);
  assert.match(pageSource, /<Card className="backlog-method-note" view="outlined"/);
  assert.match(pageSource, /Временные графики показывают историю по месяцу создания до выбранного квартала включительно/);
  assert.match(pageSource, /<Label size="m" theme=\{dashboard\.confirmed \? 'normal' : 'danger'\}/);
  assert.doesNotMatch(pageSource, /dashboard\.confirmed \? 'success'/);
  assert.doesNotMatch(pageSource, /backlog-insights-section|backlog-insight-grid|backlog-insight-card|>Инсайты</);
  assert.doesNotMatch(stylesSource, /\.backlog-insights-section|\.backlog-insight-grid|\.backlog-insight-card/);
  assert.doesNotMatch(pageSource, /className=\{`[^`]*is-\$\{/);
  assert.doesNotMatch(pageSource, /backlog-(?:ranking-track|recommendation-row|row-index)/);
  assert.match(pageSource, />Нет помесячных данных</);
  assert.doesNotMatch(pageSource, /Нет помесячных данных за квартал/);
});

test('KPI mini charts show history only through the selected quarter with a quarter reference line', () => {
  assert.equal((pageSource.match(/buildKpiMiniChartData\(visibleMonths,/g) || []).length, 5);
  assert.equal((pageSource.match(/buildKpiMiniChartData\(months,/g) || []).length, 0);
  assert.equal((pageSource.match(/scaleMonths: selectedMonths/g) || []).length, 5);

  const history = [
    {key: '2024-01', label: 'Январь', createdCount: 17, createdResolvedCount: 12},
    {key: '2024-02', label: 'Февраль', createdCount: null, createdResolvedCount: 3},
    {key: '2024-03', label: 'Март', createdCount: 6, createdResolvedCount: 5},
    {key: '2024-04', label: 'Апрель', createdCount: 8, createdResolvedCount: 7},
  ];
  const visibleMonths = history.slice(0, 3);
  const selectedMonths = visibleMonths.slice(1);
  const chart = buildKpiMiniChartData(visibleMonths, [
    {name: 'Создано', key: 'createdCount'},
    {name: 'Завершено из созданных', key: 'createdResolvedCount'},
  ], {scaleMonths: selectedMonths});

  assert.deepEqual(chart.xAxis.categories, ['Январь', 'Февраль', 'Март']);
  assert.equal(chart.xAxis.visible, false);
  assert.equal(chart.yAxis[0].visible, false);
  assert.equal(Object.hasOwn(chart.yAxis[0], 'max'), false);
  assert.deepEqual(chart.yAxis[0].plotLines, [{
    value: 6,
    color: 'var(--g-color-line-generic)',
    width: 1,
    dashStyle: 'Dash',
    layerPlacement: 'after',
  }]);
  assert.equal(chart.legend.enabled, false);
  assert.equal(chart.tooltip.enabled, true);
  assert.equal(chart.series.data.length, 2);
  assert.ok(chart.series.data.every((series) => series.type === 'line'));
  assert.deepEqual(chart.series.data[0].data.map((point) => point.y), [17, null, 6]);
  assert.deepEqual(chart.series.data[1].data.map((point) => point.y), [12, 3, 5]);

  const tasks = buildKpiMiniChartData([
    {label: 'Январь', createdCount: 1234},
  ], [{name: 'Создано', key: 'createdCount'}], {unit: 'задач'});
  assert.equal(tasks.tooltip.valueFormat.type, 'custom');
  assert.equal(tasks.tooltip.valueFormat.formatter({value: 1234}), '1 234 задач');

  const single = buildKpiMiniChartData([
    {label: 'Январь', automationShare: 20},
    {label: 'Февраль'},
    {label: 'Март', automationShare: 40},
  ], [{name: 'Автоматизация', key: 'automationShare'}], {format: 'percent'});
  assert.equal(single.series.data[0].type, 'area');
  assert.deepEqual(single.series.data[0].data.map((point) => point.y), [20, null, 40]);
  assert.equal(single.tooltip.valueFormat.type, 'custom');
  assert.equal(single.tooltip.valueFormat.formatter({value: 40}), '40%');

  const percentReference = buildKpiMiniChartData([
    {label: 'Январь', automationShare: 87.5},
    {label: 'Апрель', automationShare: 12.5},
  ], [{name: 'Автоматизация', key: 'automationShare'}], {
    format: 'percent',
    scaleMonths: [{label: 'Апрель', automationShare: 12.5}],
  });
  assert.equal(Object.hasOwn(percentReference.yAxis[0], 'max'), false);
  assert.equal(percentReference.yAxis[0].plotLines[0].value, 12.5);

  const empty = buildKpiMiniChartData([{label: 'Январь'}], [{name: 'Нет данных', key: 'missing'}]);
  assert.deepEqual(empty.series.data, []);
  assert.equal(Object.hasOwn(empty.yAxis[0], 'max'), false);
  assert.deepEqual(empty.yAxis[0].plotLines, []);

  const allZeroQuarter = buildKpiMiniChartData([
    {label: 'Январь', automationShare: 20},
    {label: 'Февраль', automationShare: 0},
  ], [{name: 'Автоматизация', key: 'automationShare'}], {
    format: 'percent',
    scaleMonths: [{label: 'Февраль', automationShare: 0}],
  });
  assert.equal(Object.hasOwn(allZeroQuarter.yAxis[0], 'max'), false);
  assert.deepEqual(allZeroQuarter.yAxis[0].plotLines, []);

  const routineAutomation = buildKpiMiniChartData([
    {label: 'Январь', exportRoutineShare: 40, automationShare: 10},
    {label: 'Февраль', exportRoutineShare: 25, automationShare: 15},
  ], [
    {name: 'Рутина', key: 'exportRoutineShare', color: 'var(--g-color-text-danger)'},
    {name: 'Автоматизация', key: 'automationShare', color: 'var(--g-color-text-info)'},
  ], {format: 'percent'});
  assert.equal(routineAutomation.legend.enabled, false);
  assert.equal(routineAutomation.series.data[0].color, 'var(--g-color-text-danger)');
  assert.equal(routineAutomation.series.data[1].color, 'var(--g-color-text-info)');
  assert.deepEqual(routineAutomation.series.data[0].data.map((point) => point.y), [40, 25]);
  assert.deepEqual(routineAutomation.series.data[1].data.map((point) => point.y), [10, 15]);
});

test('top scenarios use a horizontal Gravity UI bar chart for Created counts', () => {
  const countChart = buildScenarioRankingChartData([
    {label: 'Выгрузки в Excel', rankValue: 15},
    {label: 'Расчёт метрик', rankValue: 3},
  ]);
  assert.equal(countChart.series.data[0].type, 'bar-y');
  assert.equal(countChart.series.data[0].dataLabels.enabled, true);
  assert.deepEqual(countChart.yAxis[0].categories, ['Выгрузки в Excel', 'Расчёт метрик']);
  assert.deepEqual(countChart.series.data[0].data.map(({x, y, label}) => ({x, y, label})), [
    {x: 15, y: 0, label: '15'},
    {x: 3, y: 1, label: '3'},
  ]);
  assert.equal(countChart.xAxis.title.text, 'Созданные задачи');
  assert.equal(countChart.series.data[0].name, 'Созданные задачи');

  const rankingSource = pageSource.slice(pageSource.indexOf('<Card className="backlog-ranking-card"'), pageSource.indexOf('</section>', pageSource.indexOf('<Card className="backlog-ranking-card"')));
  assert.match(pageSource, /const rankingChartData = buildScenarioRankingChartData\(rankedScenarios\)/);
  assert.match(rankingSource, /По задачам, созданным в выбранном квартале/);
  assert.match(rankingSource, /<Box className="backlog-ranking-chart"><Chart data=\{rankingChartData\} lang="ru" \/><\/Box>/);
  assert.doesNotMatch(rankingSource, /<Progress\b|<Label\b|<Divider \/>|backlog-row-index|>\d+\.</);
  assert.match(stylesSource, /\.backlog-ranking-chart\s*\{[^}]*width:\s*100%;[^}]*height:\s*292px;/s);
});

test('quarter and grouping filters retain native Gravity Select chrome', () => {
  const quarterSelectStart = pageSource.indexOf('<Select value={quarter ?');
  const groupingSelectStart = pageSource.indexOf('<Select value={[grouping]}');
  const quarterSelect = pageSource.slice(quarterSelectStart, pageSource.indexOf('/>', quarterSelectStart));
  const groupingSelect = pageSource.slice(groupingSelectStart, pageSource.indexOf('/>', groupingSelectStart));
  for (const prop of ['options={quarterOptions}', 'size="l"', 'width="max"', 'popupWidth="fit"', 'popupPlacement="bottom-end"']) {
    assert.ok(quarterSelect.includes(prop), `quarter Select keeps ${prop}`);
  }
  for (const prop of ['options={GROUPING_OPTIONS}', 'size="m"', 'width={164}', 'popupWidth={164}', 'popupPlacement="bottom-start"']) {
    assert.ok(groupingSelect.includes(prop), `grouping Select keeps ${prop}`);
  }
  assert.doesNotMatch(pageSource, /SegmentedRadioGroup|measure/);
  assert.doesNotMatch(pageSource, /<Select\.Option\b/);
  assert.doesNotMatch(pageSource, /popupClassName/);
  assert.doesNotMatch(backlogStyleRules, /\.g-/);
});

test('backlog dashboard keeps component chrome strictly inside Gravity UI', () => {
  for (const component of ['Box', 'Button', 'Card', 'Divider', 'Flex', 'Icon', 'Label', 'Progress', 'Select', 'Spin', 'Text']) {
    assert.match(pageSource, new RegExp(`\\b${component}\\b`));
  }
  assert.doesNotMatch(pageSource, /popupClassName|backlog-select-popup/);
  assert.doesNotMatch(backlogStyleRules, /\.g-|border(?:-radius|-color)?\s*:|background\s*:|box-shadow\s*:|color\s*:|font-(?:size|weight)\s*:/);
  assert.doesNotMatch(backlogStyleRules, /::(?:before|after)|\.is-(?:warning|positive|danger|success|info)/);
  assert.doesNotMatch(pageSource, /<i\b|backlog-ranking-track/);
});

test('team selector switches complete datasets and preserves top-level fallback', () => {
  const alpha = {key: 'alpha', label: 'Альфа', months: [{key: '2024-01'}], quarters: [{key: '2024-Q1', createdCount: 4, isComplete: true}]};
  const beta = {key: 'beta', label: 'Бета', months: [{key: '2024-07'}], quarters: [
    {key: '2024-Q3', createdCount: 9, isComplete: true},
    {key: '2024-Q4', createdCount: 11, isComplete: false},
  ]};
  const multiTeam = {teams: [alpha, beta], months: [{key: 'legacy'}]};

  assert.equal(getTeamDatasets(multiTeam).length, 2);
  assert.equal(selectTeamDataset(multiTeam, 'beta'), beta);
  assert.equal(selectTeamDataset(multiTeam, 'missing'), alpha);
  assert.equal(selectTeamDataset(multiTeam, 'beta').quarters[0].createdCount, 9);
  assert.equal(selectQuarter(selectTeamDataset(multiTeam, 'beta').quarters).key, '2024-Q4');

  const fallback = {meta: {teamKey: 'tips', teamLabel: 'СберЧаевые'}, months: [{key: '2024-01'}], quarters: [{key: '2024-Q1'}], directions: [{key: 'Аналитика'}], scenarios: [{key: 'AI'}]};
  const fallbackTeam = selectTeamDataset(fallback);
  assert.equal(fallbackTeam.key, 'tips');
  assert.equal(fallbackTeam.label, 'СберЧаевые');
  assert.equal(fallbackTeam.months, fallback.months);
  assert.equal(fallbackTeam.quarters, fallback.quarters);
  assert.equal(fallbackTeam.directions, fallback.directions);
  assert.equal(fallbackTeam.scenarios, fallback.scenarios);

  assert.match(pageSource, /const \[selectedTeamKey, setSelectedTeamKey\] = useState/);
  assert.match(pageSource, /options=\{teamOptions\} onUpdate=\{updateTeam\}/);
  assert.match(pageSource, /setSelectedQuarterKey\(quarterKey\(selectQuarter\(nextQuarters\)\)\)/);
  assert.match(pageSource, /Структура и статус задач, созданных в выбранном квартале/);
  assert.match(pageSource, /className="backlog-header-controls"[^>]*alignItems="flex-end"[^>]*gap="3"/);
  const teamSelectStart = pageSource.indexOf('<Select value={team ?');
  const teamSelect = pageSource.slice(teamSelectStart, pageSource.indexOf('/>', teamSelectStart));
  for (const prop of ['options={teamOptions}', 'onUpdate={updateTeam}', 'size="l"', 'width="max"', 'popupWidth="fit"', 'popupPlacement="bottom-end"', 'aria-label="Команда"']) {
    assert.ok(teamSelect.includes(prop), `team Select keeps ${prop}`);
  }
  const mobileScopeLine = stylesSource.split('\n').find((line) => line.includes('@media (max-width: 900px)') && line.includes('.backlog-header-controls')) || '';
  assert.match(mobileScopeLine, /\.backlog-header\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*\}/);
  assert.match(mobileScopeLine, /\.backlog-header-controls\s*\{[^}]*width:\s*100%;[^}]*flex-direction:\s*column;/);
  assert.match(mobileScopeLine, /\.backlog-filter-control, \.backlog-team-control\s*\{[^}]*width:\s*100%;/);
});

test('stacked Created chart shows history only through the selected quarter with a quarter stack reference line', () => {
  assert.match(pageSource, /buildBacklogChartData\(visibleMonths, grouping, selectedMonths\)/);
  assert.doesNotMatch(pageSource, /buildBacklogChartData\(months, grouping, selectedMonths\)/);
  const history = [
    {key: '2024-01', label: 'Январь', directions: [
      {key: 'analytics', label: 'Аналитика', count: 4},
      {key: 'automation', label: 'Автоматизация', count: 3},
    ]},
    {key: '2024-02', label: 'Февраль', directions: [
      {key: 'analytics', label: 'Аналитика', count: 2},
      {key: 'automation', label: 'Автоматизация', count: 2},
    ]},
    {key: '2024-04', label: 'Апрель', directions: [
      {key: 'analytics', label: 'Аналитика', count: 2},
      {key: 'automation', label: 'Автоматизация', count: 1},
    ]},
  ];
  const visibleMonths = history.slice(0, 2);
  const selectedMonths = visibleMonths.slice(-1);
  const chart = buildBacklogChartData(visibleMonths, 'directions', selectedMonths);

  assert.deepEqual(chart.xAxis.categories, ['Январь', 'Февраль']);
  assert.equal(chart.series.data.length, 2);
  assert.equal(chart.series.data[0].type, 'bar-x');
  assert.equal(chart.series.data[0].stacking, 'normal');
  assert.deepEqual(chart.series.data[0].data.map((point) => point.y), [4, 2]);
  assert.equal(Object.hasOwn(chart.yAxis[0], 'max'), false);
  assert.deepEqual(chart.yAxis[0].plotLines, [{
    value: 4,
    color: 'var(--g-color-line-generic)',
    width: 1,
    dashStyle: 'Dash',
    layerPlacement: 'after',
    label: {text: 'Макс. квартала: 4 задач'},
  }]);
  assert.equal(chart.yAxis[0].title.text, 'Созданные задачи');
  assert.equal(chart.tooltip.totals.label, 'Всего');

  const emptyScale = buildBacklogChartData(history, 'directions', []);
  assert.equal(Object.hasOwn(emptyScale.yAxis[0], 'max'), false);
  assert.deepEqual(emptyScale.yAxis[0].plotLines, []);
});

test('Created semantics remain explicit alongside selected-quarter delivery quality KPIs', () => {
  assert.match(pageSource, /const created = metric\(quarter, 'createdCount', 'created'\)/);
  assert.match(pageSource, /discoveryShare[\s\S]*created \? discoveryCount \/ created \* 100/);
  assert.match(pageSource, /Задача учитывается один раз — в месяце создания/);
  assert.match(pageSource, /routineShare=\{routineShare\}[\s\S]*total=\{created\}|total=\{created\}[\s\S]*routineShare=\{routineShare\}/);
  assert.match(pageSource, /const medianCycleTimeDays = metric\(quarter, 'medianCycleTimeDays', 'cycleTimeMedianDays'\)/);
  assert.match(pageSource, /const cycleTimeSampleCount = metric\(quarter, 'cycleTimeSampleCount'\)/);
  assert.match(pageSource, /const storyPointsFilledShare = metric\(quarter, 'storyPointsFilledShare', 'storyPointsFillShare'\)/);
  assert.match(pageSource, /value=\{Number\.isFinite\(medianCycleTimeDays\) \? `\$\{formatNumber\(medianCycleTimeDays, 1\)\} дн\.` : '—'\}/);
  assert.match(pageSource, /value=\{Number\.isFinite\(storyPointsFilledShare\) \? formatPercentValue\(storyPointsFilledShare\) : '—'\}/);
  assert.match(pageSource, /label="Медианное время в работе"/);
  assert.match(pageSource, /label="Медианное время в работе"[\s\S]*?chartData=\{kpiMiniCharts\.medianTtm\}/);
  assert.match(pageSource, /name: 'Время в работе · 25-й перцентиль по всем аналитикам'/);
  assert.match(pageSource, /name: 'Медианное время в работе вашей команды'/);
  assert.match(pageSource, /name: 'Медианное время в работе', key: 'medianCycleTimeDays'/);
  assert.match(pageSource, /Доля &gt;10% или время в работе команды выше 25-го перцентиля/);
  assert.match(pageSource, /нет сценариев с долей &gt;10% или временем в работе команды выше 25-го перцентиля/);
  assert.doesNotMatch(pageSource, /TTM/);
  assert.match(pageSource, /label="Заполнение Story Points"[\s\S]*?chartData=\{kpiMiniCharts\.storyPoints\}/);
});

test('KPI charts use their declared Created or completed-task cohorts', () => {
  const kpiStart = pageSource.indexOf('const kpiMiniCharts = {');
  const kpiEnd = pageSource.indexOf('\n  };', kpiStart);
  const kpiSource = pageSource.slice(kpiStart, kpiEnd);
  const chartKeys = [...kpiSource.matchAll(/key: '([^']+)'/g)].map((match) => match[1]);

  assert.deepEqual(chartKeys, [
    'createdCount',
    'createdResolvedCount',
    'medianCycleTimeDays',
    'storyPointsFilledShare',
    'exportRoutineShare',
    'automationShare',
  ]);
  assert.doesNotMatch(kpiSource, /(?:^|[^A-Za-z])resolvedCount|endBacklogCount/);
  assert.match(pageSource, /const createdResolved = metric\(quarter, 'createdResolvedCount'\)/);
  assert.match(pageSource, /label="Завершено из созданных" note=\{`\$\{selectedPeriodLabel\} · \$\{formatPercentValue\(createdResolvedShare\)\} от задач · Resolved \/ Done`\}/);
  assert.doesNotMatch(pageSource, /createdOpen|Открыто из созданных/);

  const structureBuilder = pageSource.slice(pageSource.indexOf('export function buildBacklogChartData'), pageSource.indexOf('export function buildScenarioRankingChartData'));
  assert.match(structureBuilder, /Number\(item\?\.count\)/);
  assert.doesNotMatch(structureBuilder, /resolvedCount|endBacklogCount/);
});
