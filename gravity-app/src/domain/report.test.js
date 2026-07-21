import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateIndexUplifts, antiTopBlockLabel, blockPercent, difficultyMeta, filterCampaigningLinks, filterDraftLinks, filterInapplicableMetricGroups, filterInapplicableMetricSubgroups, filterMetricsForBlock, groupFor, hasMetricDeviations, inapplicableMetricLabel, isCampaigningRelevant, isCrossSellDigitallyConfirmed, isDdIndexMetric, isDraftsRelevant, isInformationalMetric, isTbdMetric, metricDomId, percent, radarBlockPercent, scoreFor, summarizeRecommendationUplifts, teamHelpAudience} from './report.js';

test('report selectors preserve score and group fallbacks', () => {
  const product = {name: 'Team', unit: 'Unit'};
  const rows = [{name: 'Team', unit: 'Unit', score: 61, group: 'Mature'}];
  assert.equal(scoreFor(product, rows), 61);
  assert.equal(groupFor(product, rows), 'Mature');
  assert.equal(scoreFor(product, []), 0);
  assert.equal(groupFor(product, []), 'Нет данных');
});

test('report percentage helpers clamp and aggregate values', () => {
  assert.equal(percent(3, 4), 75);
  assert.equal(percent(5, 4), 100);
  assert.equal(percent(1, 0), 0);
  assert.equal(blockPercent({metrics: [{value: 1, max_value: 2}, {value: 2, max_value: 2}]}), 75);
});

test('recommendation uplifts add up to the remaining displayed index', () => {
  const recommendations = allocateIndexUplifts(
    [{gap: 1}, {gap: 1}, {gap: 1}],
    68,
  );

  assert.deepEqual(recommendations.map((item) => item.indexUplift), [10.7, 10.7, 10.6]);
  assert.equal(recommendations.reduce((sum, item) => sum + item.indexUplift, 68), 100);
});

test('recommendation card aggregates hidden uplift into the displayed total', () => {
  const summary = summarizeRecommendationUplifts(
    [5.1, 4.9, 8.3, 2.2, 11.5].map((indexUplift) => ({indexUplift})),
    4,
  );

  assert.equal(summary.visible.length, 4);
  assert.equal(summary.hiddenCount, 1);
  assert.equal(summary.hiddenUplift, 11.5);
  assert.equal(
    summary.visible.reduce((sum, item) => sum + item.indexUplift, 68) + summary.hiddenUplift,
    100,
  );
});

test('DD index metrics exclude display-only and inapplicable rows', () => {
  assert.equal(isDdIndexMetric({max_value: 1}), true);
  assert.equal(isDdIndexMetric({max_value: 1, excluded_from_index: true}), false);
  assert.equal(isDdIndexMetric({max_value: 1, dd_calculation_flg: 0}), false);
  assert.equal(isDdIndexMetric({max_value: 1, is_applicabble_flg: false}), false);
  assert.equal(isDdIndexMetric({max_value: 0}), false);
});

test('metric deviations include only applicable DD index gaps', () => {
  assert.equal(hasMetricDeviations([{value: 0.5, max_value: 1}]), true);
  assert.equal(hasMetricDeviations([{value: 1, max_value: 1}]), false);
  assert.equal(hasMetricDeviations([{value: 0, max_value: 1, is_applicabble_flg: false}]), false);
  assert.equal(hasMetricDeviations([{value: 0, max_value: 1, dd_calculation_flg: 0}]), false);
});

test('radar percentage omits inapplicable blocks without hiding real zero scores', () => {
  assert.equal(radarBlockPercent({metrics: [{value: 0, max_value: 1, is_applicabble_flg: true}]}), 0);
  assert.equal(radarBlockPercent({metrics: [{value: 0, max_value: 0, is_applicabble_flg: false}]}), null);
  assert.equal(radarBlockPercent({metrics: []}), null);
});

test('report presentation helpers preserve stable output', () => {
  assert.equal(metricDomId('goals/value'), 'dd-metric-goals%2Fvalue');
  assert.deepEqual(difficultyMeta(3), {label: 'Легко', theme: 'success'});
  assert.deepEqual(difficultyMeta(6), {label: 'Средне', theme: 'warning'});
  assert.deepEqual(difficultyMeta(7), {label: 'Сложно', theme: 'danger'});
  assert.equal(antiTopBlockLabel('Цели'), 'Мониторинг: Цели/Факторный анализ/Прогнозы');
  assert.equal(antiTopBlockLabel('Механики'), 'Механики');
  assert.equal(isTbdMetric({name: 'A/B-тесты'}), false);
  assert.equal(isTbdMetric({name: 'Будущая метрика', tbd: true}), true);
  assert.equal(isInformationalMetric({dd_calculation_flg: 0}), true);
  assert.equal(isInformationalMetric({dd_calculation_flg: '0'}), true);
  assert.equal(isInformationalMetric({dd_calculation_flg: 1, excluded_from_index: true}), false);
  assert.equal(inapplicableMetricLabel({code: 'hyp.ab_tests'}), 'Нет плана по A/B');
  assert.equal(inapplicableMetricLabel({name: 'A/B-тесты'}), 'Нет плана по A/B');
  assert.equal(inapplicableMetricLabel({name: 'Другая метрика'}), 'Не применимо');
});

test('fully inapplicable metric subgroups are removed', () => {
  const metrics = [
    {name: 'Hidden 1', metric_subgroup: 'Hidden', is_applicabble_flg: false},
    {name: 'Hidden 2', metric_subgroup: 'Hidden', is_applicabble_flg: false},
    {name: 'Visible', metric_subgroup: 'Mixed', is_applicabble_flg: true},
    {name: 'Mixed N/A', metric_subgroup: 'Mixed', is_applicabble_flg: false},
    {name: 'Ungrouped N/A', metric_subgroup: '', is_applicabble_flg: false},
  ];

  assert.deepEqual(
    filterInapplicableMetricSubgroups(metrics).map((metric) => metric.name),
    ['Visible', 'Mixed N/A', 'Ungrouped N/A'],
  );
});

test('fully inapplicable metric groups are removed unless a digest is connected', () => {
  const blocks = [
    {code: 'hidden', metrics: [{is_applicabble_flg: false}, {is_applicabble_flg: false}]},
    {code: 'mixed', metrics: [{is_applicabble_flg: false}, {is_applicabble_flg: true}]},
    {code: 'cx', metrics: [{is_applicabble_flg: false}]},
    {code: 'alerts', metrics: [{is_applicabble_flg: false}]},
    {code: 'empty', metrics: []},
    {code: 'empty-ai', metrics: []},
    {code: 'visible-only-na', metrics: [{hidden: true, is_applicabble_flg: true}, {is_applicabble_flg: false}]},
  ];

  assert.deepEqual(
    filterInapplicableMetricGroups(
      blocks,
      ['cx', 'alerts', 'empty-ai'],
      (metric) => !metric.hidden,
    ).map((block) => block.code),
    ['mixed', 'cx', 'alerts', 'empty-ai'],
  );
});

test('key metrics and mechanics hide inapplicable metric rows', () => {
  const metrics = [
    {name: 'Applicable', is_applicabble_flg: true},
    {name: 'Inapplicable', is_applicabble_flg: false},
  ];

  assert.deepEqual(
    filterMetricsForBlock({code: 'general', name: 'Знание ключевых метрик'}, metrics).map((metric) => metric.name),
    ['Applicable'],
  );
  assert.deepEqual(
    filterMetricsForBlock({code: 'custom', name: 'Механики'}, metrics).map((metric) => metric.name),
    ['Applicable'],
  );
  assert.deepEqual(
    filterMetricsForBlock({code: 'cx', name: 'Клиентский опыт'}, metrics).map((metric) => metric.name),
    ['Applicable', 'Inapplicable'],
  );
});

test('campaigning links require an applicable campaign metric', () => {
  const links = [
    {label: 'Отчет "Пилотные кампании"'},
    {label: 'Отчет "Воронки из коммуникации в продажу"'},
    {label: 'Отчет "Черновики"'},
  ];
  const irrelevant = {
    code: 'attract',
    metrics: [{code: 'attract.campaign_launches', is_applicabble_flg: false}],
  };
  const relevant = {
    code: 'attract',
    metrics: [{code: 'attract.campaign_launches', is_applicabble_flg: true}],
  };

  assert.equal(isCampaigningRelevant(irrelevant), false);
  assert.equal(isCampaigningRelevant({code: 'attract', metrics: []}), false);
  assert.equal(isCampaigningRelevant(relevant), true);
  assert.deepEqual(filterCampaigningLinks(irrelevant, links), [{label: 'Отчет "Черновики"'}]);
  assert.deepEqual(filterCampaigningLinks(relevant, links), links);
});

test('draft link requires an applicable drafts metric', () => {
  const links = [
    {label: 'Отчет "Черновики"'},
    {label: 'Отчет "Пилотные кампании"'},
  ];
  const irrelevant = {
    code: 'attract',
    metrics: [{code: 'attract.chernoviki_v_sbol_70', is_applicabble_flg: false}],
  };
  const relevant = {
    code: 'attract',
    metrics: [{name: 'Черновики в СБОЛ >=70%', is_applicabble_flg: true}],
  };

  assert.equal(isDraftsRelevant(irrelevant), false);
  assert.equal(isDraftsRelevant({code: 'attract', metrics: []}), false);
  assert.equal(isDraftsRelevant(relevant), true);
  assert.deepEqual(filterDraftLinks(irrelevant, links), [{label: 'Отчет "Пилотные кампании"'}]);
  assert.deepEqual(filterDraftLinks({code: 'attract', metrics: []}, links), [{label: 'Отчет "Пилотные кампании"'}]);
  assert.deepEqual(filterDraftLinks(relevant, links), links);
  assert.deepEqual(filterDraftLinks({code: 'general', metrics: []}, links), links);
});

test('digital trace confirmation is limited to listed product cross-sell metrics', () => {
  const product = {type: 'Продукт', name: 'ОСАГО'};
  const block = {code: 'mehaniki', name: 'Механики'};
  const metric = {code: 'mehaniki.cross_sell', name: 'Cross-sell'};

  assert.equal(isCrossSellDigitallyConfirmed(product, block, metric), true);
  assert.equal(isCrossSellDigitallyConfirmed({...product, name: 'Другой продукт'}, block, metric), false);
  assert.equal(isCrossSellDigitallyConfirmed({...product, type: 'Сегмент'}, block, metric), false);
  assert.equal(isCrossSellDigitallyConfirmed(product, {code: 'general'}, metric), false);
  assert.equal(isCrossSellDigitallyConfirmed(product, block, {code: 'mehaniki.upsell'}), false);
});

test('team help audience distinguishes products, segments, and channel types', () => {
  assert.equal(teamHelpAudience({type: 'Продукт', name: 'ОСАГО'}), 'product');
  assert.equal(teamHelpAudience({type: 'Сегмент', name: 'Дети'}), 'age');
  assert.equal(teamHelpAudience({type: 'Сегмент', name: 'PB'}), 'income');
  assert.equal(teamHelpAudience({type: 'Сегмент', name: 'Другой сегмент'}), 'segment');
  assert.equal(teamHelpAudience({type: 'Канал', name: 'СБОЛ'}), 'digital-channel');
  assert.equal(teamHelpAudience({type: 'Канал', name: 'Чат'}), 'service-channel');
  assert.equal(teamHelpAudience({type: 'Канал', name: 'Коллцентр'}), 'service-channel');
  assert.equal(teamHelpAudience({type: 'Канал', name: 'Телемаркетинг'}), 'telemarketing');
  assert.equal(teamHelpAudience({type: 'Канал', name: 'Другой канал'}), 'channel');
});
