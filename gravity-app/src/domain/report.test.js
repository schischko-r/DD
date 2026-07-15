import test from 'node:test';
import assert from 'node:assert/strict';
import {antiTopBlockLabel, blockPercent, difficultyMeta, filterCampaigningLinks, filterDraftLinks, filterInapplicableMetricGroups, filterInapplicableMetricSubgroups, filterMetricsForBlock, groupFor, isCampaigningRelevant, isCrossSellDigitallyConfirmed, isDraftsRelevant, isInformationalMetric, isTbdMetric, metricDomId, percent, scoreFor} from './report.js';

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
