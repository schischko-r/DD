import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
import {isDdIndexMetric} from './report.js';
import {sumCrossSellComponents} from './crossSellDecomposition.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const products = read('../../public/report-data.json').products;
const api = read('../data/crosssell-metrics-q3-2026.json');
const after = read('../data/crosssell-after-purchase-scores-q3-2026.json');
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);
const cross = (product) => metrics(product).find((metric) => metric.code === 'mehaniki.cross_sell');

test('confirmed after-purchase scores restore 18 Q2 teams and only the sum is indexed', () => {
  const snapshot = JSON.stringify({products, api, after});
  const baseline = buildTeamProfileProducts(products, api.period, api);
  const next = buildTeamProfileProducts(products, api.period, [api, after]);
  const expectedNames = ['Страхование залога', 'Страхование жизни', 'Слитки', 'Сделка с Первичным жильём',
    'Сделка ИЖС', 'СберЧаевые', 'СберСова', 'Переводы по РФ', 'Пенсионный продукт', 'Пакет услуг СберПремьер',
    'Кредитные карты', 'КАСКО', 'ЗЛС', 'Зарплатный продукт', 'Залоговое страхование (корпоративное страхование)',
    'Детская карта', 'ВЗР', 'Автокредит'];
  assert.deepEqual(after.products.filter((team) => team.postPurchaseValue === 0.5).map((team) => team.name).sort(), expectedNames.sort());
  const restoredNames = ['Монеты', 'POS-кредиты', 'Потребительский кредит', 'Пакет услуг СберПервый',
    'СберСпасибо', 'Дебетовая карта', 'Платежи', 'Сценарии оплаты', 'Торговый Эквайринг', 'SberPay NFC',
    'Много денег (НКПЗН)', 'Сделка вторичка', 'БПИФ', 'Брокерский счет', 'ЗПИФ', 'ОПИФ', 'ПДС', 'Личная защита Плюс'];
  assert.deepEqual(after.products.filter((team) => team.postPurchaseValue === 1).map((team) => team.name).sort(),
    [...restoredNames, 'Вклады+НС'].sort());
  assert.equal(new Set(after.products.map((team) => team.id)).size, 54);
  for (const name of restoredNames) {
    const old = cross(products.find((team) => team.name === name));
    assert.equal(old.value, old.max_value);
  }
  for (const name of ['Как зарплатный', 'Школьные сервисы']) {
    assert.ok(!after.products.some((team) => team.name === name));
  }
  const ids = new Set(after.products.map((team) => team.id));
  let threeQuarters = 0, quarter = 0;
  for (const old of baseline) {
    const current = next.find((team) => team.id === old.id);
    assert.equal(current.indexMaxPoints, old.indexMaxPoints);
    assert.equal(metrics(current).length, metrics(old).length);
    assert.equal(metrics(current).filter(isDdIndexMetric).length, metrics(old).filter(isDdIndexMetric).length);
    assert.equal(metrics(current).filter((metric) => metric.code === 'mehaniki.cross_sell').length,
      metrics(old).filter((metric) => metric.code === 'mehaniki.cross_sell').length);
    const baseId = old.id.replace(/::empty::.*$/, '');
    if (!ids.has(baseId)) { assert.deepEqual(current, old); continue; }
    const before = cross(old), result = cross(current);
    assert.equal(result.crossSellComponents.during.value, before.value);
    assert.deepEqual(result.crossSellComponents.during.source, before.source);
    const assessment = after.products.find((team) => team.id === baseId);
    if (assessment.postPurchaseValue !== 0.5) {
      const applicable = assessment.postPurchaseApplicable !== false;
      assert.equal(result.crossSellComponents.after.applicable, applicable);
      assert.equal(result.crossSellComponents.after.rawValue, applicable ? assessment.postPurchaseValue : null);
      if (assessment.postPurchaseValue === 1) assert.equal(result.value, Math.min(before.value, before.max_value / 2) + before.max_value / 2);
      else { assert.equal(result.value, before.value); assert.equal(result.max_value, before.max_value); }
      continue;
    }
    assert.equal(result.crossSellComponents.after.value, 0.25);
    assert.equal(result.value, before.value + 0.25);
    assert.equal(result.max_value, before.max_value);
    assert.equal(result.source.origin, 'crossSellComponentSum');
    assert.ok(!['LossHunter'].includes(result.source.system), 'The sum must not be labelled API-only evidence');
    assert.deepEqual(metrics(current).filter((metric) => metric.code !== result.code), metrics(old).filter((metric) => metric.code !== result.code));
    const earned = (team) => metrics(team).filter(isDdIndexMetric).reduce((sum, metric) => sum + (metric.value || 0), 0);
    assert.ok(Math.abs(earned(current) - earned(old) - 0.25) < 1e-9, 'A 50% after-purchase component contributes one quarter of the total metric');
    if (result.value === 0.75) threeQuarters++; else if (result.value === 0.25) quarter++;
    for (const item of result.recommendation_items || []) assert.equal(item.gap, 1 - result.value);
  }
  assert.equal(threeQuarters, 12); assert.equal(quarter, 6);
  assert.deepEqual(buildTeamProfileProducts(products, 'II кв. 2026', [api, after]), products);
  assert.equal(JSON.stringify({products, api, after}), snapshot);
});

test('component sum is bounded, does not invent missing scores or enable inapplicable metrics, and cannot be applied twice', () => {
  const base = {code: 'mehaniki.cross_sell', value: 0.5, max_value: 1};
  const fact = {postPurchaseValue: 0.5, source: {period: after.period}};
  const result = sumCrossSellComponents(base, fact);
  assert.equal(result.value, 0.75);
  assert.equal(sumCrossSellComponents(result, fact), result);
  assert.equal(sumCrossSellComponents({...base, value: 1}, fact).value, 0.75);
  for (const override of [{value: null}, {value: undefined}, {max_value: 0}, {is_applicabble_flg: false},
    {excluded_from_index: true}, {dd_calculation_flg: 0}, {code: 'other'}]) {
    const metric = {...base, ...override};
    if (override.code) assert.equal(sumCrossSellComponents(metric, fact), metric);
    else {
      const result = sumCrossSellComponents(metric, fact);
      assert.equal(result.value, metric.value);
      assert.equal(result.max_value, metric.max_value);
      assert.equal(isDdIndexMetric(result), isDdIndexMetric(metric));
      assert.equal(result.source, metric.source);
    }
  }
  assert.equal(sumCrossSellComponents(base, {postPurchaseValue: 1}).value, 1);
  assert.equal(sumCrossSellComponents(base, {postPurchaseValue: 0.25}), base);
  assert.equal(sumCrossSellComponents({...base, value: 0.25, max_value: 0.5}, fact).value, 0.375);
});

test('two components have equal weight in the total', () => {
  for (const [during, afterValue, total] of [[0, 1, 0.5], [0.5, 0, 0.5], [0.5, 1, 1],
    [0, 0, 0], [0, 0.5, 0.25], [0.5, 0.5, 0.75], [1, 0, 0.5]]) {
    const result = sumCrossSellComponents({code: 'mehaniki.cross_sell', value: during, max_value: 1}, {postPurchaseValue: afterValue});
    assert.equal(result.value, total);
    assert.equal(result.crossSellComponents.during.value, during);
    assert.equal(result.crossSellComponents.after.rawValue, afterValue);
  }
});

test('not applicable and zero after purchase remain distinct, without changing the during component', () => {
  const profiles = buildTeamProfileProducts(products, api.period, [api, after]);
  const statements = cross(profiles.find((team) => team.name === 'Выписки, справки'));
  const mail = cross(profiles.find((team) => team.name === 'Почта, Диск, Календарь'));
  assert.equal(statements.crossSellComponents.after.applicable, false);
  assert.equal(statements.crossSellComponents.after.value, null);
  assert.equal(mail.crossSellComponents.after.applicable, true);
  assert.equal(mail.crossSellComponents.after.value, 0);
  for (const name of ['Трансграничные переводы', 'Трансграничный эквайринг']) {
    const team = profiles.find((team) => team.name === name);
    assert.equal(cross(team).crossSellComponents.after.rawValue, 0);
  }
});
