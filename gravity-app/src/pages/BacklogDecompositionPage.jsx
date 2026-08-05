import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Chart} from '@gravity-ui/charts';
import {ArrowLeft, ChartColumn, Check, CircleFill, CircleInfo} from '@gravity-ui/icons';
import {Box, Button, Card, Divider, Flex, Icon, Label, Link, Modal, Progress, Select, Spin, Table, Text} from '@gravity-ui/uikit';
import {DD_SCENARIO_RECOMMENDATIONS} from './backlogScenarioRecommendations.js';
import {RecommendationCell} from './RecommendationCell.js';

const GROUPING_OPTIONS = [
  {value: 'directions', content: 'Направления'},
  {value: 'scenarios', content: 'Сценарии'},
];
const DISCOVERY_TARGET = 40;
const STORY_POINTS_TARGET = 90;
const STORY_POINTS_GUIDE_URL = 'https://confluence.sberbank.ru/pages/viewpage.action?pageId=15525024800';
const QUARTER_REFERENCE_COLOR = 'var(--g-color-line-generic)';
const SCENARIO_RECOMMENDATION_EXCLUSIONS = new Set([
  'dashboard_manual_data_update',
  'bi_bugfix',
  'employee_trainings',
]);

const formatNumber = (value, maximumFractionDigits = 0) => Number.isFinite(Number(value))
  ? new Intl.NumberFormat('ru-RU', {maximumFractionDigits}).format(Number(value))
  : '—';
const formatOptionalMetric = (value, unit, maximumFractionDigits = 1) => {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? `${formatNumber(number, maximumFractionDigits)} ${unit}` : '—';
};
const formatPercentValue = (value, maximumFractionDigits = 1) => `${formatNumber(value, maximumFractionDigits)}%`;
const formatPercent = ({value}) => formatPercentValue(value);
const formatFreshnessDate = (value) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'}).format(date);
};

function monthLabel(month) {
  return String(month?.label || month?.monthLabel || month?.month || month?.key || '');
}

function itemKey(item) {
  return String(item?.code || item?.key || item?.name || item?.label || '');
}

function itemLabel(item) {
  return String(item?.label || item?.name || item?.code || item?.key || 'Без категории');
}

function metric(source, ...keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) return Number(source[key]);
  }
  return null;
}

function buildQuarterReferenceLine(value, label = '') {
  if (!Number.isFinite(value) || value <= 0) return [];
  return [{
    value,
    color: QUARTER_REFERENCE_COLOR,
    width: 1,
    dashStyle: 'Dash',
    layerPlacement: 'after',
    ...(label ? {label: {text: label}} : {}),
  }];
}

function quarterKey(quarter) {
  return String(quarter?.key || quarter?.quarter || quarter?.id || '');
}

function quarterLabel(quarter) {
  const label = String(quarter?.label || quarterKey(quarter) || 'Квартал');
  return quarter?.isComplete === false ? `${label} · неполный` : label;
}

export function selectQuarter(quarters = []) {
  if (!quarters.length) return null;
  return quarters[quarters.length - 1];
}

export function getTeamDatasets(data = {}) {
  if (Array.isArray(data?.teams) && data.teams.length) return data.teams;
  return [{
    ...data,
    key: String(data?.meta?.teamKey || 'sber-tips'),
    label: String(data?.meta?.teamLabel || 'СберЧаевые'),
  }];
}

export function selectTeamDataset(data = {}, selectedKey = '') {
  const teams = getTeamDatasets(data);
  return teams.find((team) => String(team?.key) === String(selectedKey)) || teams[0];
}

function monthsForQuarter(months, quarter) {
  const explicitKeys = quarter?.monthKeys || quarter?.months?.map((month) => month?.key || month);
  if (Array.isArray(explicitKeys) && explicitKeys.length) {
    const keys = new Set(explicitKeys.map(String));
    return months.filter((month) => keys.has(String(month?.key)));
  }
  const match = quarterKey(quarter).match(/(\d{4}).*?[QК]([1-4])/i);
  if (!match) return months;
  const firstMonth = (Number(match[2]) - 1) * 3 + 1;
  const prefix = `${match[1]}-`;
  return months.filter((month) => {
    const key = String(month?.key || '');
    const monthNumber = Number(key.slice(prefix.length));
    return key.startsWith(prefix) && monthNumber >= firstMonth && monthNumber < firstMonth + 3;
  });
}

export function selectLatestMonth(months = []) {
  return months.length ? months[months.length - 1] : null;
}

function monthOrdinal(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return Number(match[1]) * 12 + month - 1;
}

export function monthsThroughQuarter(months = [], quarter = null) {
  const explicitKeys = quarter?.monthKeys || quarter?.months?.map((month) => month?.key || month);
  const quarterMatch = quarterKey(quarter).match(/(\d{4}).*?[QК]([1-4])/i);
  if ((!Array.isArray(explicitKeys) || !explicitKeys.length) && !quarterMatch) return [];

  const selectedMonths = monthsForQuarter(months, quarter);
  const selectedOrdinals = selectedMonths
    .map((month) => monthOrdinal(month?.key))
    .filter(Number.isFinite);
  let upperBound = selectedOrdinals.length ? Math.max(...selectedOrdinals) : null;

  if (upperBound === null && quarterMatch) {
    upperBound = Number(quarterMatch[1]) * 12 + Number(quarterMatch[2]) * 3 - 1;
  }

  if (!Number.isFinite(upperBound)) return [];
  return months.filter((month) => {
    const ordinal = monthOrdinal(month?.key);
    return Number.isFinite(ordinal) && ordinal <= upperBound;
  });
}

function fallbackQuarters(months = []) {
  const grouped = new Map();
  months.forEach((month) => {
    const match = String(month?.key || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return;
    const number = Math.ceil(Number(match[2]) / 3);
    const key = `${match[1]}-Q${number}`;
    if (!grouped.has(key)) grouped.set(key, {key, label: `${number} квартал ${match[1]}`, monthKeys: [], isComplete: false});
    grouped.get(key).monthKeys.push(month.key);
  });
  return [...grouped.values()].map((quarter) => ({...quarter, isComplete: quarter.monthKeys.length === 3}));
}

function shortQuarterLabel(quarter) {
  const match = quarterKey(quarter).match(/(\d{4}).*?[QК]([1-4])/i);
  if (!match) return quarterLabel(quarter);
  return `${match[2]}Q${match[1].slice(-2)}`;
}

export function buildScenarioFocusRecommendations(quarters = [], recommendationRows = DD_SCENARIO_RECOMMENDATIONS) {
  const quarter = [...quarters].reverse().find((item) => item?.isComplete === true);
  if (!quarter) return {quarter: null, periodLabel: '', items: []};

  const scenarios = Array.isArray(quarter?.scenarios) ? quarter.scenarios : [];
  const scenarioTotal = scenarios.reduce((sum, item) => sum + (Number(item?.count) || 0), 0);
  const total = metric(quarter, 'createdCount', 'totalCount', 'total') || scenarioTotal;
  const recommendationsByKey = recommendationRows.reduce((result, item) => {
    const key = String(item?.key || '').toLocaleLowerCase('ru-RU');
    if (!key) return result;
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(item);
    return result;
  }, new Map());

  const items = scenarios
    .map((scenario) => {
      const scenarioKey = String(scenario?.key || '').toLocaleLowerCase('ru-RU');
      if (SCENARIO_RECOMMENDATION_EXCLUSIONS.has(scenarioKey)) return null;
      const count = Number(scenario?.count) || 0;
      const share = total > 0 ? count / total * 100 : Number(scenario?.share) || 0;
      const sourceRows = recommendationsByKey.get(scenarioKey) || [];
      const approvedRows = sourceRows.filter((item) => item?.recommendation);
      const continuous25thHours = scenario?.continuous25thHours;
      const medianCycleTimeHours = scenario?.medianCycleTimeHours;
      const scenarioLabel = String(scenario?.label || scenario?.key || 'Без сценария');
      const hasValidBenchmark = Number.isFinite(scenario?.cycleTimeSampleCount)
        && scenario.cycleTimeSampleCount > 0
        && Number.isFinite(continuous25thHours)
        && Number.isFinite(medianCycleTimeHours);
      const exceedsBenchmark = hasValidBenchmark && medianCycleTimeHours > continuous25thHours;
      const hasHighShare = share > 10;
      if (!approvedRows.length || (!hasHighShare && !exceedsBenchmark)) return null;

      const resources = approvedRows
        .flatMap((item) => item.resources || [])
        .filter((resource, index, all) => all.findIndex((item) => (item.href || item.action) === (resource.href || resource.action)) === index);
      const shouldShowBenchmarkSummary = hasValidBenchmark
        && scenarioKey !== 'unknown'
        && scenarioLabel.trim() !== 'Невозможно разметить';
      const recommendationSummary = shouldShowBenchmarkSummary
        ? `25-й перцентиль аналитиков выполняет такие задачи за ${formatNumber(continuous25thHours, 2)} часа.\nЗначение по вашей команде: ${formatNumber(medianCycleTimeHours, 1)} часов.`
        : '';
      const toolRecommendation = approvedRows.map((item) => item.recommendation).join(' ');
      const isUnmappedScenario = scenarioKey === 'unknown'
        || scenarioLabel.trim() === 'Невозможно разметить';
      return {
        key: String(scenario?.key || scenario?.label || ''),
        scenario: scenarioLabel,
        share,
        continuous25thHours,
        medianCycleTimeHours,
        recommendation: isUnmappedScenario
          ? toolRecommendation
          : `${recommendationSummary ? `${recommendationSummary}\n\n` : ''}Предлагаемый инструментарий: ${toolRecommendation}`,
        recommendationSummary,
        toolRecommendation,
        resources,
        isUnmappedScenario,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.share - a.share);

  return {quarter, periodLabel: shortQuarterLabel(quarter), items};
}

export function buildBacklogChartData(months = [], grouping = 'directions', scaleMonths = months) {
  const categories = [];
  const categoryByKey = new Map();

  months.forEach((month) => {
    const items = Array.isArray(month?.[grouping]) ? month[grouping] : [];
    items.forEach((item) => {
      const key = itemKey(item);
      if (key && !categoryByKey.has(key)) {
        const category = {key, name: itemLabel(item)};
        categoryByKey.set(key, category);
        categories.push(category);
      }
    });
  });

  const scaleTotals = scaleMonths.map((month) => {
    const items = Array.isArray(month?.[grouping]) ? month[grouping] : [];
    return items.reduce((total, item) => {
      const value = Number(item?.count);
      return total + (Number.isFinite(value) ? value : 0);
    }, 0);
  });
  const rawScaleMax = scaleTotals.length ? Math.max(...scaleTotals) : null;
  const scaleMax = rawScaleMax > 0 ? rawScaleMax : null;
  const valueFormat = {type: 'number', precision: 0, showRankDelimiter: true};
  const referenceLabel = scaleMax === null ? '' : `Макс. квартала: ${formatNumber(scaleMax)} задач`;

  return {
    chart: {margin: {top: 8, right: 16, bottom: 4, left: 4}},
    legend: {enabled: true, position: 'bottom', align: 'left', justifyContent: 'start', itemDistance: 12, margin: 12},
    tooltip: {
      enabled: true,
      sorting: {key: 'value', direction: 'desc'},
      totals: {enabled: true, label: 'Всего', valueFormat},
      valueFormat,
    },
    xAxis: {type: 'category', categories: months.map(monthLabel), labels: {autoRotation: true}},
    yAxis: [{
      type: 'linear',
      min: 0,
      title: {text: 'Созданные задачи'},
      labels: {numberFormat: {precision: 0, showRankDelimiter: true}},
      grid: {enabled: true},
      plotLines: buildQuarterReferenceLine(scaleMax, referenceLabel),
    }],
    series: {data: categories.map((category) => ({
      type: 'bar-x',
      name: category.name,
      stacking: 'normal',
      borderRadius: 1,
      dataLabels: {enabled: false},
      data: months.map((month, index) => {
        const items = Array.isArray(month?.[grouping]) ? month[grouping] : [];
        const item = items.find((candidate) => itemKey(candidate) === category.key);
        const value = Number(item?.count);
        return {x: index, y: Number.isFinite(value) ? value : 0};
      }),
    }))},
  };
}

export function buildScenarioRankingChartData(items = []) {
  const valueFormat = {type: 'number', precision: 0, showRankDelimiter: true};
  return {
    chart: {margin: {top: 4, right: 36, bottom: 8, left: 4}},
    legend: {enabled: false},
    tooltip: {enabled: true, valueFormat},
    xAxis: {
      type: 'linear',
      min: 0,
      title: {text: 'Созданные задачи'},
      labels: {numberFormat: {precision: 0, showRankDelimiter: true}},
      grid: {enabled: true},
    },
    yAxis: [{
      type: 'category',
      categories: items.map(itemLabel),
      labels: {maxWidth: 180},
    }],
    series: {data: [{
      type: 'bar-y',
      name: 'Созданные задачи',
      borderRadius: 2,
      dataLabels: {enabled: true, inside: false},
      data: items.map((item, index) => ({
        x: item.rankValue,
        y: index,
        label: formatNumber(item.rankValue),
      })),
    }]},
  };
}

export function buildKpiMiniChartData(months = [], seriesDefs = [], options = {}) {
  const scaleMonths = Array.isArray(options.scaleMonths) ? options.scaleMonths : months;
  const scaleValues = scaleMonths.flatMap((month) => seriesDefs.map((definition) => {
    const keys = Array.isArray(definition?.keys) ? definition.keys : [definition?.key];
    return metric(month, ...keys.filter(Boolean));
  })).filter(Number.isFinite);
  const rawScaleMax = scaleValues.length ? Math.max(...scaleValues) : null;
  const scaleMax = rawScaleMax > 0 ? rawScaleMax : null;
  const series = seriesDefs
    .map((definition) => {
      const keys = Array.isArray(definition?.keys) ? definition.keys : [definition?.key];
      const data = months.map((month, index) => {
        const value = metric(month, ...keys.filter(Boolean));
        return {x: index, y: Number.isFinite(value) ? value : null};
      });
      return {
        type: seriesDefs.length > 1 ? 'line' : (options.type || 'area'),
        name: String(definition?.name || ''),
        ...(definition?.color ? {color: definition.color} : {}),
        lineWidth: 2,
        marker: {enabled: true, radius: 2},
        nullMode: 'connect',
        ...(seriesDefs.length === 1 ? {opacity: 0.14} : {}),
        data,
      };
    })
    .filter((item) => item.data.some((point) => point.y !== null));
  const valueFormat = options.format === 'percent'
    ? {type: 'custom', formatter: formatPercent}
    : options.unit
      ? {
          type: 'custom',
          formatter: ({value}) => `${formatNumber(value, options.precision ?? 0)} ${options.unit}`,
        }
      : {type: 'number', precision: options.precision ?? 0, showRankDelimiter: true};

  return {
    chart: {margin: {top: 3, right: 3, bottom: 3, left: 3}},
    legend: {enabled: options.legend === true},
    tooltip: {enabled: true, valueFormat},
    xAxis: {
      type: 'category',
      categories: months.map(monthLabel),
      visible: false,
      grid: {enabled: false},
    },
    yAxis: [{
      type: 'linear',
      visible: false,
      grid: {enabled: false},
      startOnTick: false,
      endOnTick: false,
      maxPadding: 0.08,
      plotLines: buildQuarterReferenceLine(scaleMax),
    }],
    series: {data: series},
  };
}

export function buildDashboardInsights(quarter = {}) {
  const created = metric(quarter, 'createdCount', 'created') || 0;
  const discovery = metric(quarter, 'discoveryCount') || 0;
  const discoveryShare = metric(quarter, 'discoveryShare') ?? (created ? discovery / created * 100 : 0);
  const routineShare = metric(quarter, 'exportRoutineShare', 'routineShare') || 0;
  const automationShare = metric(quarter, 'automationShare') || 0;
  const automationCount = metric(quarter, 'automationCount') || 0;
  const routineCount = metric(quarter, 'exportRoutineCount', 'routineCount') || 0;
  const unknownShare = metric(quarter, 'unknownShare') || 0;
  const storyPointsFilledShare = metric(quarter, 'storyPointsFilledShare', 'storyPointsFillShare');
  const gap = Math.max(0, DISCOVERY_TARGET - discoveryShare);
  const missingDiscovery = Math.max(0, Math.ceil(created * DISCOVERY_TARGET / 100) - discovery);
  const insights = [
    {
      title: discoveryShare >= DISCOVERY_TARGET ? 'Цель по Discovery подтверждена' : 'Discovery ниже целевой доли',
      text: `К Discovery относится ${formatNumber(discovery)} из ${formatNumber(created)} задач, созданных в выбранном квартале — ${formatPercentValue(discoveryShare)} при цели не менее ${DISCOVERY_TARGET}%.`,
    },
    {
      title: routineShare > automationShare ? 'Рутина опережает автоматизацию' : 'Рутина и автоматизация',
      text: `Выгрузки и отчётность — ${formatPercentValue(routineShare)} созданных задач (задач: ${formatNumber(routineCount)}); задачи про автоматизацию — ${formatPercentValue(automationShare)} созданных задач (задач: ${formatNumber(automationCount)}).`,
    },
  ];
  if (unknownShare > 0) insights.push({
    title: 'Классификация покрывает не весь бэклог',
    text: `${formatPercentValue(100 - unknownShare)} созданных задач имеют определённое направление; оставшиеся ${formatPercentValue(unknownShare)} ограничивают точность выводов по структуре.`,
  });

  const recommendations = [];
  if (Number.isFinite(storyPointsFilledShare) && storyPointsFilledShare < STORY_POINTS_TARGET) recommendations.push({
    title: 'Заполнять Story Points',
    text: 'Рекомендуем заполнять поле Story Points / Относительная сложность для планирования. Базовой считается нагрузка 6,4 SP в день для аналитика. Подробнее можно почитать здесь',
    resources: [{label: 'здесь', href: STORY_POINTS_GUIDE_URL, placement: 'inline'}],
    theme: 'warning',
  });
  if (discoveryShare < DISCOVERY_TARGET) recommendations.push({
    title: 'Зарезервировать ≥40% задач под аналитику и исследования',
    text: `При объёме ${formatNumber(created)} созданных задач нужно направить ещё ${formatNumber(missingDiscovery)} задач в направление «Аналитика».`,
    theme: 'danger',
  });
  if (routineShare >= 20 && automationShare < routineShare) recommendations.push({
    title: 'Автоматизировать повторяющиеся выгрузки и Excel-отчёты',
    text: `Рутина занимает ${formatPercentValue(routineShare)} созданных задач, а задачи про автоматизацию — ${formatPercentValue(automationShare)}. Начать с самых частых сценариев.`,
    theme: 'warning',
  });
  if (unknownShare > 0) recommendations.push({
    title: 'Улучшить заполнение задач',
    text: `Повысить полноту описаний и заполнение обязательных полей, чтобы улучшить качество автоматической разметки. Сейчас направление не определено у ${formatPercentValue(unknownShare)} задач.`,
    theme: 'info',
  });
  return {insights: insights.slice(0, 5), recommendations, missingDiscovery, gap, confirmed: discoveryShare >= DISCOVERY_TARGET};
}

function KpiCard({value, label, note, chartData, chartUnit}) {
  const hasChart = chartData?.series?.data?.length > 0;
  const referenceMax = chartData?.yAxis?.[0]?.plotLines?.[0]?.value;
  const referenceText = Number.isFinite(referenceMax)
    ? `. Максимум выбранного квартала: ${formatNumber(referenceMax, chartUnit === 'задач' ? 0 : 1)} ${chartUnit}`
    : '';
  return (
    <Card className="backlog-kpi-card" view="outlined" size="l" spacing={{p: 4}}>
      <Flex direction="column" gap="2" height="100%">
        <Text as="div" variant="caption-2" color="secondary">{label}</Text>
        <Text as="div" variant="header-2">{value}</Text>
        {note && <Text as="div" variant="body-1" color="secondary">{note}</Text>}
        {hasChart && <Box className="backlog-kpi-chart" spacing={{px: 2, py: 1}} role="img" aria-label={`Помесячная динамика: ${label}. Единица измерения: ${chartUnit}${referenceText}`}><Chart data={chartData} lang="ru" /></Box>}
      </Flex>
    </Card>
  );
}

function RoutineAutomationCard({periodLabel, total, routineShare, routineCount, automationShare, automationCount, chartData}) {
  const hasChart = chartData?.series?.data?.length > 0;
  const referenceMax = chartData?.yAxis?.[0]?.plotLines?.[0]?.value;
  const referenceText = Number.isFinite(referenceMax)
    ? `. Максимум выбранного квартала: ${formatNumber(referenceMax, 1)} %`
    : '';
  return (
    <Card className="backlog-kpi-card backlog-kpi-card--combined" view="outlined" size="l" spacing={{p: 4}}>
      <Flex direction="column" gap="2" height="100%">
        <Text as="div" variant="caption-2" color="secondary">Рутина и автоматизация</Text>
        <Text as="div" variant="body-1" color="secondary">{periodLabel}</Text>
        <Box className="backlog-kpi-comparison">
          <Flex direction="column" gap="1">
            <Text as="div" variant="subheader-1">Рутина</Text>
            <Text as="div" variant="header-2">{formatPercentValue(routineShare)}</Text>
            <Text as="div" variant="body-1" color="secondary">{formatNumber(routineCount)} из {formatNumber(total)} созданных</Text>
          </Flex>
          <Flex direction="column" gap="1">
            <Text as="div" variant="subheader-1">Автоматизация</Text>
            <Text as="div" variant="header-2">{formatPercentValue(automationShare)}</Text>
            <Text as="div" variant="body-1" color="secondary">{formatNumber(automationCount)} из {formatNumber(total)} созданных</Text>
          </Flex>
        </Box>
        {hasChart && (
          <Flex className="backlog-kpi-chart-layout" alignItems="stretch" gap="2">
            <Box className="backlog-kpi-chart backlog-kpi-chart--comparison" spacing={{px: 2, py: 1}} role="img" aria-label={`Помесячная динамика рутины и автоматизации. Единица измерения: %${referenceText}`}><Chart data={chartData} lang="ru" /></Box>
            <Flex className="backlog-kpi-chart-legend" direction="column" justifyContent="center" gap="1" role="list" aria-label="Легенда графика">
              <Flex alignItems="center" gap="1" role="listitem"><Text color="danger"><Icon data={CircleFill} size={8} /></Text><Text variant="caption-2">Рутина</Text></Flex>
              <Flex alignItems="center" gap="1" role="listitem"><Text color="info"><Icon data={CircleFill} size={8} /></Text><Text variant="caption-2">Автоматизация</Text></Flex>
            </Flex>
          </Flex>
        )}
      </Flex>
    </Card>
  );
}

function RecommendationResources({item}) {
  const resources = (item.resources || []).filter((resource) => resource.placement !== 'inline');
  if (!resources.length) return null;
  if (resources.every((resource) => resource.placement === 'after')) {
    return <> {resources.map((resource, index) => <React.Fragment key={resource.href}>{index > 0 && ', '}<Link href={resource.href} target="_blank" rel="noreferrer">{resource.label}</Link></React.Fragment>)}</>;
  }
  if (resources.length === 1) {
    return <> Посмотрите рекомендации по <Link href={resources[0].href} target="_blank" rel="noreferrer">{resources[0].label}</Link>.</>;
  }
  return <> Материалы: {resources.map((resource, index) => <React.Fragment key={resource.href}>{index > 0 && (index === resources.length - 1 ? ' и ' : ', ')}<Link href={resource.href} target="_blank" rel="noreferrer">{resource.label}</Link></React.Fragment>)}.</>;
}

const EX_EL_SERVICE_URL = 'https://qlik.sigma.sbrf.ru/qs_b2c_data/scim_sigma/extensions/excelapp/index.html#/';
const EX_EL_ACCESS_COLUMNS = [
  {id: 'system', name: 'АС', width: '28%'},
  {id: 'role', name: 'Роль', width: '30%'},
  {id: 'comment', name: 'Комментарий', width: '34%'},
  {id: 'block', name: 'Блок', width: '8%'},
];
const EX_EL_ACCESS_ROWS = [
  {
    id: 'alpha',
    system: 'АС ПКАП Аналитика персонализации клиента (ПРОМ)',
    role: 'QS B2C Data Группа пользователей ЦА QS_B2C_DATA_A_CAU',
    comment: 'Сотрудникам ЦА для доступа к ресурсу платформы в альфе (чтение)',
    block: 'ЦА',
  },
  {
    id: 'sigma',
    system: 'АС ПКАП Аналитика персонализации клиента (ПРОМ)',
    role: 'QS B2C Data Группа пользователей ЦА (SIGMA) QS_B2C_DATA_S_CAU',
    comment: 'Сотрудникам ЦА для доступа к ресурсу платформы в сигме (чтение)',
    block: 'ЦА',
  },
];

function RecommendationCopy({item}) {
  const [accessModal, setAccessModal] = useState(null);
  const text = String(item.recommendation || item.text || '');
  const allResources = item.resources || [];
  const inlineResources = allResources.filter((resource) => resource.placement === 'inline');
  const productAnalystResource = allResources.find((resource) => resource.action === 'product-analyst-access');
  const exElResource = allResources.find((resource) => resource.action === 'ex-el-access');
  const parts = [];
  let cursor = 0;
  inlineResources.forEach((resource) => {
    const start = text.indexOf(resource.label, cursor);
    if (start < 0) return;
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(resource.action
      ? <button key={`${resource.action}-${start}`} type="button" className="backlog-inline-action" aria-haspopup="dialog" onClick={() => setAccessModal(resource.action)}>{resource.label}</button>
      : <Link key={`${resource.href}-${start}`} href={resource.href} target="_blank" rel="noreferrer">{resource.label}</Link>);
    cursor = start + resource.label.length;
  });
  parts.push(text.slice(cursor));
  const emphasizedParts = parts.flatMap((part, partIndex) => {
    if (typeof part !== 'string') return [part];
    return part.split(/(Предлагаемый инструментарий:|\d+(?:[,.]\d+)?(?=\s+час(?:а|ов)?(?:[.\s]|$)))/u).map((segment, segmentIndex) => (
      segment === 'Предлагаемый инструментарий:' || /^\d+(?:[,.]\d+)?$/.test(segment)
        ? <strong key={`emphasis-${partIndex}-${segmentIndex}`}>{segment}</strong>
        : segment
    ));
  });
  return <>
    <span className="backlog-recommendation-copy">{emphasizedParts}<RecommendationResources item={item} /></span>
    {productAnalystResource && (
      <Modal
        open={accessModal === 'product-analyst-access'}
        onOpenChange={(open) => setAccessModal(open ? 'product-analyst-access' : null)}
        contentClassName="product-analyst-access-modal"
        contentOverflow="auto"
        aria-labelledby="product-analyst-access-title"
      >
        <Flex className="product-analyst-access-content" direction="column" gap="4">
          <Flex direction="column" gap="2">
            <Text id="product-analyst-access-title" as="h2" variant="subheader-3">AI Toolkit «Продуктовый аналитик»</Text>
            <Text variant="body-1">Для доступа непосредственно к системе необходимо в АС Друг в поисковой строке ввести «Доступ к стендам разработки и тестирования», далее:</Text>
          </Flex>
          <ul className="product-analyst-access-steps">
            <li>Выбрать «Открыть доступ».</li>
            <li>В поле «Выберите автоматизированную систему или ИТ услугу» указать «AI HUB B2C (CI06049712)».</li>
            <li>В обосновании указать «Для разработки и тестирования инструмента AI суммаризации».</li>
          </ul>
          <Text variant="body-1">Для входа в систему используйте почтовый адрес сигма и первичный пароль. ФИО, кому направить первичный пароль, просьба направить на почту (Хазипова Мария Юрьевна).</Text>
          <Flex justifyContent="flex-end"><Button view="action" size="l" onClick={() => setAccessModal(null)}>Закрыть</Button></Flex>
        </Flex>
      </Modal>
    )}
    {exElResource && (
      <Modal
        open={accessModal === 'ex-el-access'}
        onOpenChange={(open) => setAccessModal(open ? 'ex-el-access' : null)}
        contentClassName="ex-el-access-modal"
        contentOverflow="auto"
        aria-labelledby="ex-el-access-title"
      >
        <Flex className="ex-el-access-content" direction="column" gap="4">
          <Flex direction="column" gap="2">
            <Text id="ex-el-access-title" as="h2" variant="subheader-3">EX-EL</Text>
            <Text variant="body-1">Сервис: <Link href={EX_EL_SERVICE_URL} target="_blank" rel="noreferrer">EX-EL</Link>.</Text>
            <Text variant="body-1">Если нет доступа, его можно оформить через АС Друг.</Text>
          </Flex>
          <div className="ex-el-access-table-scroll">
            <Table
              className="ex-el-access-table"
              columns={EX_EL_ACCESS_COLUMNS}
              data={EX_EL_ACCESS_ROWS}
              getRowId={(row) => row.id}
              verticalAlign="top"
              width="max"
              wordWrap
              aria-label="Роли доступа к EX-EL через АС Друг"
            />
          </div>
          <Flex justifyContent="flex-end"><Button view="action" size="l" onClick={() => setAccessModal(null)}>Закрыть</Button></Flex>
        </Flex>
      </Modal>
    )}
  </>;
}

function buildScenarioFocusColumns(periodLabel) {
  return [
    {
      id: 'scenario',
      name: 'Сценарий',
      width: '20%',
      primary: true,
      template: (item) => <Text className="backlog-table-scenario" variant="subheader-1">{item.scenario}</Text>,
    },
    {
      id: 'share',
      name: `Доля · ${periodLabel}`,
      width: '12%',
      template: (item) => <Text className="backlog-table-metric" variant="subheader-1">{formatPercentValue(item.share)}</Text>,
    },
    {
      id: 'continuous25thHours',
      name: 'Время в работе · 25-й перцентиль по всем аналитикам',
      width: '12%',
      template: (item) => <Text className="backlog-table-metric" color="secondary">{item.isUnmappedScenario ? '—' : formatOptionalMetric(item.continuous25thHours, 'ч', 2)}</Text>,
    },
    {
      id: 'medianCycleTimeHours',
      name: 'Медианное время в работе вашей команды',
      width: '12%',
      template: (item) => <Text className="backlog-table-metric" variant="subheader-1">{item.isUnmappedScenario ? '—' : formatOptionalMetric(item.medianCycleTimeHours, 'ч', 1)}</Text>,
    },
    {
      id: 'recommendation',
      name: 'Рекомендация',
      width: '44%',
      template: (item) => <RecommendationCell><RecommendationCopy item={item} /></RecommendationCell>,
    },
  ];
}

function PageState({type}) {
  if (type === 'loading') return <main className="content dashboard-page backlog-page"><Flex className="backlog-page-state" alignItems="center" justifyContent="center" gap="3"><Spin size="l" /><Text color="secondary">Загружаем данные бэклога…</Text></Flex></main>;
  return <main className="content dashboard-page backlog-page"><Flex className="backlog-page-state" alignItems="center" justifyContent="center" gap="3"><Icon data={type === 'error' ? CircleInfo : ChartColumn} size={24} /><Flex direction="column" gap="1"><Text variant="subheader-1">{type === 'error' ? 'Данные бэклога пока недоступны' : 'Нет данных для отображения'}</Text><Text color="secondary">{type === 'error' ? 'Остальные разделы приложения продолжают работать.' : 'Для построения дашборда нужны квартальные данные.'}</Text></Flex></Flex></main>;
}

export function BacklogDecompositionPage({data, status = 'ready', onOpenTeam, initialTeamKey = ''}) {
  const [grouping, setGrouping] = useState('directions');
  const teams = useMemo(() => getTeamDatasets(data || {}), [data]);
  const [selectedTeamKey, setSelectedTeamKey] = useState(() => String(initialTeamKey || teams[0]?.key || ''));
  const appliedInitialTeamKey = useRef(null);
  useEffect(() => {
    const requestedTeamKey = String(initialTeamKey || '');
    if (requestedTeamKey !== appliedInitialTeamKey.current) {
      if (requestedTeamKey && teams.some((team) => String(team?.key) === requestedTeamKey)) {
        appliedInitialTeamKey.current = requestedTeamKey;
        if (selectedTeamKey !== requestedTeamKey) setSelectedTeamKey(requestedTeamKey);
        return;
      }
      if (!requestedTeamKey) {
        appliedInitialTeamKey.current = '';
        const defaultTeamKey = String(teams[0]?.key || '');
        if (selectedTeamKey !== defaultTeamKey) setSelectedTeamKey(defaultTeamKey);
        return;
      }
    }
    if (!teams.some((team) => String(team?.key) === selectedTeamKey)) setSelectedTeamKey(String(teams[0]?.key || ''));
  }, [initialTeamKey, selectedTeamKey, teams]);
  const team = selectTeamDataset(data || {}, selectedTeamKey);
  const months = Array.isArray(team?.months) ? team.months : [];
  const quarters = useMemo(() => Array.isArray(team?.quarters) && team.quarters.length ? team.quarters : fallbackQuarters(months), [team?.quarters, months]);
  const defaultQuarter = selectQuarter(quarters);
  const [selectedQuarterKey, setSelectedQuarterKey] = useState(() => quarterKey(defaultQuarter));
  useEffect(() => {
    if (!quarters.some((quarter) => quarterKey(quarter) === selectedQuarterKey)) setSelectedQuarterKey(quarterKey(selectQuarter(quarters)));
  }, [quarters, selectedQuarterKey]);
  const quarter = quarters.find((item) => quarterKey(item) === selectedQuarterKey) || defaultQuarter;
  const selectedMonths = useMemo(() => monthsForQuarter(months, quarter), [months, quarter]);
  const visibleMonths = useMemo(() => monthsThroughQuarter(months, quarter), [months, quarter]);
  const chartData = useMemo(() => buildBacklogChartData(visibleMonths, grouping, selectedMonths), [grouping, selectedMonths, visibleMonths]);
  const dashboard = useMemo(() => buildDashboardInsights(quarter), [quarter]);
  const teamOptions = useMemo(() => teams.map((item) => ({value: String(item?.key), content: String(item?.label || item?.key)})), [teams]);
  const quarterOptions = useMemo(() => quarters.map((item) => ({value: quarterKey(item), content: quarterLabel(item)})), [quarters]);
  const scenarioFocus = useMemo(() => buildScenarioFocusRecommendations(quarters), [quarters]);
  const updateTeam = (value) => {
    const nextTeamKey = value[0] || '';
    const nextTeam = selectTeamDataset(data || {}, nextTeamKey);
    const nextMonths = Array.isArray(nextTeam?.months) ? nextTeam.months : [];
    const nextQuarters = Array.isArray(nextTeam?.quarters) && nextTeam.quarters.length ? nextTeam.quarters : fallbackQuarters(nextMonths);
    setSelectedTeamKey(nextTeamKey);
    setSelectedQuarterKey(quarterKey(selectQuarter(nextQuarters)));
  };

  if (status === 'loading') return <PageState type="loading" />;
  if (status === 'error') return <PageState type="error" />;
  if (!quarter) return <PageState type="empty" />;

  const discoveryCount = metric(quarter, 'discoveryCount');
  const created = metric(quarter, 'createdCount', 'created');
  const discoveryShare = metric(quarter, 'discoveryShare') ?? (created ? discoveryCount / created * 100 : 0);
  const createdResolved = metric(quarter, 'createdResolvedCount');
  const createdResolvedShare = created ? (createdResolved ?? 0) / created * 100 : 0;
  const routineCount = metric(quarter, 'exportRoutineCount', 'routineCount');
  const routineShare = metric(quarter, 'exportRoutineShare', 'routineShare');
  const automationCount = metric(quarter, 'automationCount');
  const automationShare = metric(quarter, 'automationShare');
  const medianCycleTimeDays = metric(quarter, 'medianCycleTimeDays', 'cycleTimeMedianDays');
  const cycleTimeSampleCount = metric(quarter, 'cycleTimeSampleCount');
  const storyPointsFilledCount = metric(quarter, 'storyPointsFilledCount');
  const storyPointsBaseCount = metric(quarter, 'storyPointsBaseCount', 'storyPointsTotalCount');
  const storyPointsFilledShare = metric(quarter, 'storyPointsFilledShare', 'storyPointsFillShare');
  const scenarios = Array.isArray(quarter?.scenarios) ? quarter.scenarios : [];
  const rankedScenarios = [...scenarios]
    .map((item) => ({...item, rankValue: metric(item, 'count') || 0}))
    .filter((item) => item.rankValue > 0)
    .sort((a, b) => b.rankValue - a.rankValue)
    .slice(0, 6);
  const rankingChartData = buildScenarioRankingChartData(rankedScenarios);
  const hasSeries = chartData.series.data.length > 0;
  const freshness = formatFreshnessDate(team?.meta?.asOf || data?.meta?.asOf);
  const discoveryGoalProgress = Math.min(100, Math.max(0, discoveryShare / DISCOVERY_TARGET * 100));
  const scenarioFocusColumns = buildScenarioFocusColumns(scenarioFocus.periodLabel);
  const selectedPeriodLabel = shortQuarterLabel(quarter);
  const kpiMiniCharts = {
    created: buildKpiMiniChartData(visibleMonths, [{name: 'Создано', key: 'createdCount'}], {unit: 'задач', scaleMonths: selectedMonths}),
    createdResolved: buildKpiMiniChartData(visibleMonths, [{name: 'Завершено из созданных', key: 'createdResolvedCount'}], {unit: 'задач', scaleMonths: selectedMonths}),
    medianTtm: buildKpiMiniChartData(visibleMonths, [{name: 'Медианное время в работе', key: 'medianCycleTimeDays'}], {unit: 'дн.', scaleMonths: selectedMonths}),
    storyPoints: buildKpiMiniChartData(visibleMonths, [{name: 'Заполнение Story Points', key: 'storyPointsFilledShare'}], {format: 'percent', scaleMonths: selectedMonths}),
    routineAutomation: buildKpiMiniChartData(visibleMonths, [
      {name: 'Рутина', key: 'exportRoutineShare', color: 'var(--g-color-text-danger)'},
      {name: 'Автоматизация', key: 'automationShare', color: 'var(--g-color-text-info)'},
    ], {format: 'percent', scaleMonths: selectedMonths}),
  };

  return (
    <main className="content dashboard-page backlog-page">
      {onOpenTeam && <Box spacing={{mb: 2}}><Button view="flat" size="m" onClick={() => onOpenTeam(team)}><Icon data={ArrowLeft} size={16} />Назад к карточке команды</Button></Box>}
      <header className="backlog-header">
        <Flex direction="column" gap="1">
          <Text as="h1" variant="display-2">Декомпозиция бэклога</Text>
          <Text variant="body-1" color="secondary">Структура и статус задач, созданных в выбранном квартале</Text>
          {freshness && <Flex alignItems="center" gap="2"><Icon data={CircleInfo} size={16} /><Text variant="caption-2" color="secondary">Данные на {freshness}</Text></Flex>}
        </Flex>
        <Flex className="backlog-header-controls" alignItems="flex-end" gap="3">
          <Flex className="backlog-filter-control backlog-team-control" direction="column" gap="1">
            <Text variant="caption-2" color="secondary">Команда</Text>
            <Select value={team ? [String(team.key)] : []} options={teamOptions} onUpdate={updateTeam} size="l" width="max" popupWidth="fit" popupPlacement="bottom-end" aria-label="Команда" />
          </Flex>
          <Flex className="backlog-filter-control" direction="column" gap="1">
            <Text variant="caption-2" color="secondary">Квартал</Text>
            <Select value={quarter ? [quarterKey(quarter)] : []} options={quarterOptions} onUpdate={(value) => setSelectedQuarterKey(value[0] || '')} size="l" width="max" popupWidth="fit" popupPlacement="bottom-end" aria-label="Квартал" />
          </Flex>
        </Flex>
      </header>

      <Card className="backlog-goal-card" view="outlined" size="l" spacing={{p: 5}}>
        <Flex direction="column" gap="4">
          <Flex alignItems="flex-start" justifyContent="space-between" gap="4" wrap>
            <Flex direction="column" gap="1">
              <Text as="h2" variant="subheader-3">Доля Discovery в созданных задачах квартала</Text>
              <Text variant="body-1" color="secondary">Задачи с датой создания в выбранном квартале · цель ≥{DISCOVERY_TARGET}%</Text>
            </Flex>
            <Label size="m" theme={dashboard.confirmed ? 'normal' : 'danger'}>{dashboard.confirmed ? 'Цель подтверждена' : 'Цель не подтверждена'}</Label>
          </Flex>
          <Flex alignItems="baseline" gap="3" wrap><Text variant="display-2">{formatPercentValue(discoveryShare)}</Text><Text variant="body-1" color="secondary">{formatNumber(discoveryCount)} из {formatNumber(created)} созданных задач</Text></Flex>
          <Box className="backlog-goal-progress-row">
            <Flex className="backlog-goal-scale" direction="column" gap="2">
              <Box className="backlog-goal-progress"><Progress value={discoveryGoalProgress} theme={dashboard.confirmed ? 'default' : 'danger'} size="m" /></Box>
              <Flex justifyContent="space-between"><Text variant="caption-2" color="secondary">Факт {formatPercentValue(discoveryShare)}</Text><Text variant="caption-2" color="secondary">Цель {DISCOVERY_TARGET}%</Text></Flex>
            </Flex>
            <Flex className="backlog-goal-metrics" gap="6" wrap>
              <Flex direction="column" gap="1"><Text variant="caption-2" color="secondary">Разрыв до цели</Text><Text variant="header-1" color={dashboard.confirmed ? undefined : 'danger-heavy'}>{dashboard.confirmed ? '0 п.п.' : `${formatNumber(dashboard.gap, 1)} п.п.`}</Text></Flex>
              <Flex direction="column" gap="1"><Text variant="caption-2" color="secondary">Задач до цели</Text><Text variant="header-1">{formatNumber(dashboard.missingDiscovery)}</Text></Flex>
            </Flex>
          </Box>
        </Flex>
      </Card>

      <section className="backlog-kpi-grid" aria-label="Ключевые показатели квартала">
        <KpiCard value={formatNumber(created)} label="Создано за квартал" note={selectedPeriodLabel} chartData={kpiMiniCharts.created} chartUnit="задач" />
        <KpiCard value={formatNumber(createdResolved)} label="Завершено из созданных" note={`${selectedPeriodLabel} · ${formatPercentValue(createdResolvedShare)} от задач · Resolved / Done`} chartData={kpiMiniCharts.createdResolved} chartUnit="задач" />
        <KpiCard value={Number.isFinite(medianCycleTimeDays) ? `${formatNumber(medianCycleTimeDays, 1)} дн.` : '—'} label="Медианное время в работе" note={`${selectedPeriodLabel} · ${Number.isFinite(cycleTimeSampleCount) ? `по ${formatNumber(cycleTimeSampleCount)} завершённым задачам` : 'от In Progress до Resolved / Done'}`} chartData={kpiMiniCharts.medianTtm} chartUnit="дн." />
        <KpiCard value={Number.isFinite(storyPointsFilledShare) ? formatPercentValue(storyPointsFilledShare) : '—'} label="Заполнение Story Points" note={`${selectedPeriodLabel} · ${Number.isFinite(storyPointsFilledCount) && Number.isFinite(storyPointsBaseCount) ? `${formatNumber(storyPointsFilledCount)} из ${formatNumber(storyPointsBaseCount)} созданных задач` : 'доля созданных задач с оценкой'}`} chartData={kpiMiniCharts.storyPoints} chartUnit="%" />
        <RoutineAutomationCard periodLabel={selectedPeriodLabel} total={created} routineShare={routineShare} routineCount={routineCount} automationShare={automationShare} automationCount={automationCount} chartData={kpiMiniCharts.routineAutomation} />
      </section>

      <section className="backlog-analysis-grid">
        <Card className="backlog-chart-card" view="outlined" size="l" spacing={{p: 4}}>
          <Flex direction="column" gap="4" height="100%">
            <Flex alignItems="flex-start" justifyContent="space-between" gap="4" wrap>
              <Flex direction="column" gap="1"><Text as="h2" variant="subheader-2">Структура созданных задач</Text><Text variant="caption-2" color="secondary">Задача учитывается один раз — в месяце создания</Text></Flex>
              <Flex className="backlog-controls" alignItems="center" justifyContent="flex-end" gap="2" wrap>
                <Select value={[grouping]} options={GROUPING_OPTIONS} onUpdate={(value) => setGrouping(value[0] || 'directions')} size="m" width={164} popupWidth={164} popupPlacement="bottom-start" aria-label="Группировка" />
              </Flex>
            </Flex>
            {hasSeries ? <Box className="backlog-chart"><Chart data={chartData} lang="ru" /></Box> : <Flex className="backlog-chart-empty" alignItems="center" justifyContent="center" gap="2"><Icon data={ChartColumn} size={22} /><Text color="secondary">Нет помесячных данных</Text></Flex>}
          </Flex>
        </Card>

        <Card className="backlog-ranking-card" view="outlined" size="l" spacing={{p: 4}}>
          <Flex direction="column" gap="4">
            <Flex alignItems="flex-start" justifyContent="space-between" gap="3"><Flex direction="column" gap="1"><Text as="h2" variant="subheader-2">Топ сценариев</Text><Text variant="caption-2" color="secondary">По задачам, созданным в выбранном квартале</Text></Flex><Text variant="caption-2" color="secondary">Топ-6</Text></Flex>
            {rankedScenarios.length
              ? <Box className="backlog-ranking-chart"><Chart data={rankingChartData} lang="ru" /></Box>
              : <Text color="secondary">Нет данных по сценариям</Text>}
          </Flex>
        </Card>
      </section>

      <section className="backlog-actions-grid">
        <Card className="backlog-list-card" view="outlined" size="l" spacing={{p: 5}} style={{'--g-card-background-color': 'var(--g-color-base-background)'}}>
            <Flex direction="column" gap="4">
              <Flex direction="column" gap="1"><Text as="h2" variant="subheader-2">Рекомендации</Text><Text variant="caption-2" color="secondary">Следующие действия из наблюдаемых метрик</Text></Flex>
              <Divider />
              <Flex direction="column" gap="3">
                <Flex direction="column" gap="1">
                  <Text variant="subheader-1">Сценарии в фокусе</Text>
                  <Text variant="caption-2" color="secondary">Доля &gt;10% или время в работе команды выше 25-го перцентиля · последний полный квартал · {scenarioFocus.periodLabel || 'нет данных'}</Text>
                </Flex>
                {scenarioFocus.items.length
                  ? <Box className="backlog-focus-recommendations-scroll"><Table className="backlog-focus-recommendations-table" columns={scenarioFocusColumns} data={scenarioFocus.items} getRowId="key" verticalAlign="top" width="max" wordWrap aria-label={`Рекомендации по сценариям в фокусе за ${scenarioFocus.periodLabel}`} /></Box>
                  : <Text color="secondary">В последнем полном квартале нет сценариев с долей &gt;10% или временем в работе команды выше 25-го перцентиля и доступными рекомендациями.</Text>}
              </Flex>
              <Divider />
              <Text variant="subheader-1">Другие действия по метрикам</Text>
              <Flex direction="column" gap="4">{dashboard.recommendations.map((item, index) => <React.Fragment key={item.title}><Flex alignItems="flex-start" gap="3"><Label theme="normal" size="s" icon={<Icon data={Check} size={14} />}>Шаг {index + 1}</Label><Flex direction="column" gap="1" grow><Text variant="subheader-1">{item.title}</Text><Text variant="body-1" color="secondary"><RecommendationCopy item={item} /></Text></Flex></Flex>{index < dashboard.recommendations.length - 1 && <Divider />}</React.Fragment>)}{!dashboard.recommendations.length && <Text color="secondary">Критических отклонений в выбранном квартале нет.</Text>}</Flex>
          </Flex>
        </Card>
      </section>

      <Card className="backlog-method-note" view="outlined" spacing={{p: 4}}>
        <Flex alignItems="flex-start" gap="2" wrap><Icon data={CircleInfo} size={16} /><Text variant="subheader-1">Методика</Text><Text variant="caption-2" color="secondary">Временные графики показывают историю по месяцу создания до выбранного квартала включительно. Discovery, рутина и автоматизация считаются внутри Created-когорты; «Завершено из созданных» — задачи в статусах Resolved / Done.{freshness ? ` Источник актуален на ${freshness}.` : ''}</Text></Flex>
      </Card>
    </main>
  );
}
