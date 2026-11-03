import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const source = read('../../public/report-data.json').products;
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`));
const products = buildDdiPeriodProducts(source, 'III кв. 2026', overlays,
  read('../data/salary-products-q3-2026.json'), read('../data/reporting-regularity-missing-q3-2026.json'),
  read('../data/funnel-action-missing-q3-2026.json'));
const find = (name, code, unit = 'DB') => {
  const product = products.find((item) => item.name === name && item.unit === unit);
  assert.ok(product, name);
  const metric = product.metrics.flatMap((block) => block.metrics).find((item) => item.code === code);
  assert.ok(metric, `${name}: ${code}`);
  return metric;
};

test('explicit DB Q3 score corrections apply to their exact metrics and preserve unspecified pension scores', () => {
  const expected = [
    ['Дебетовая карта', 'attract.report_completeness', 0.5],
    ['Дебетовая карта', 'attract.funnel_analysis', 0.5],
    ['Дебетовая карта', 'attract.benchmarks', 0.5],
    ['Дебетовая карта', 'churn.report_completeness', 0.5],
    ['Дебетовая карта', 'churn.funnel_analysis', 0.5],
    ['Дебетовая карта', 'churn.benchmarks', 0.5],
    ['Детская карта', 'attract.benchmarks', 0],
    ['Детская карта', 'churn.nastroena_otchetnostь', 0.5],
    ['Детская карта', 'churn.report_completeness', 0],
    ['Детская карта', 'mehaniki.uderzhanie_klientov', 0.5],
    ['Зарплатный продукт', 'hyp.discovery_40_backlog', 0],
    ['Кредитные карты', 'mehaniki.doprodazhi_up_sell', 0.5],
    ['Оплата улыбкой', 'churn.report_completeness', 0.5],
    ['Оплата улыбкой', 'churn.funnel_analysis', 0.5],
    ['Переводы по РФ', 'attract.nastroena_otchetnostь', 0.5],
    ['Переводы по РФ', 'attract.report_completeness', 0.5],
    ['Переводы по РФ', 'churn.funnel_analysis', 1],
    ['Переводы по РФ', 'churn.deviation_actions', 1],
    ['Переводы по РФ', 'cx.score', 1],
    ['Платежи', 'hyp.discovery_40_backlog', 0],
    ['Трансграничные переводы', 'churn.nastroena_otchetnostь', 0.5],
    ['SberPay Вжух', 'attract.report_completeness', 0.5],
    ['SberPay Вжух', 'attract.funnel_analysis', 0.5],
    ['SberPay Вжух', 'churn.nastroena_otchetnostь', 0.5],
  ];
  for (const [team, code, ratio] of expected) {
    const metric = find(team, code);
    assert.equal(metric.value / metric.max_value, ratio, `${team}: ${code}`);
  }
  for (const team of ['Оплата улыбкой', 'Трансграничные переводы']) {
    const cx = find(team, 'cx.score');
    assert.equal(cx.value, null);
    assert.equal(cx.max_value, 0);
    assert.equal(cx.is_applicabble_flg, false);
    assert.equal(cx.hidden_from_profile, true);
  }
  for (const code of ['attract.report_completeness', 'churn.report_completeness']) {
    const metric = find('Пенсионный продукт', code);
    assert.equal(metric.value / metric.max_value, 0.5, `unspecified pension correction stays as assessed: ${code}`);
  }
});

test('Internet-Acquiring Q3 product knowledge metrics use the confirmed 100% scores', () => {
  for (const code of ['general.klienty_s_produktom', 'general.mau_produkta']) {
    const metric = find('Интернет-Эквайринг', code);
    assert.equal(metric.value / metric.max_value, 1, `${code} should be 100%`);
    assert.equal(metric.source?.origin, 'userConfirmedQ3ScoreCorrection');
  }
});

test('POS Q3 clients with product uses the explicit 100 percent correction over the workbook', () => {
  const metric = find('POS-кредиты', 'general.klienty_s_produktom', 'CBP');
  assert.equal(metric.value / metric.max_value, 1);
  assert.equal(metric.source.correction.origin, 'userConfirmedQ3ScoreCorrection');
  assert.equal(metric.source.correction.rawValue, 1);
});

test('Q3 business metric alerts are 50% for the four specified insurance products', () => {
  for (const name of ['ИСЖ', 'НСЖ', 'ДСЖ КК', 'Страхование залога']) {
    const metric = find(name, 'alerts.business_metrics', 'УБ');
    assert.equal(metric.value / metric.max_value, 0.5, `${name} alerts should be 50%`);
    assert.equal(metric.source?.correction?.origin, 'userConfirmedQ3ScoreCorrection');
  }
});

test('ZPIF Q3 acquisition reporting completeness is 50%', () => {
  const metric = find('ЗПИФ', 'attract.report_completeness', 'УБ');
  assert.equal(metric.value / metric.max_value, 0.5);
  assert.equal(metric.source?.correction?.origin, 'userConfirmedQ3ScoreCorrection');
});

test('ZPIF Q3 churn deviation actions score is zero', () => {
  const metric = find('ЗПИФ', 'churn.deviation_actions', 'УБ');
  assert.equal(metric.value, 0);
  assert.equal(metric.source?.correction?.origin, 'userConfirmedQ3ScoreCorrection');
});

test('ZPIF Q3 churn funnel analysis score is 100%', () => {
  const metric = find('ЗПИФ', 'churn.funnel_analysis', 'УБ');
  assert.equal(metric.value / metric.max_value, 1);
  assert.equal(metric.source?.correction?.origin, 'userConfirmedQ3ScoreCorrection');
});

test('ZPIF Q3 acquisition initiative list score is zero', () => {
  const metric = find('ЗПИФ', 'attract.initiatives_list', 'УБ');
  assert.equal(metric.value, 0);
  assert.equal(metric.source?.correction?.origin, 'userConfirmedQ3ScoreCorrection');
});

test('ZPIF Q3 acquisition funnel analysis score is 100%', () => {
  const metric = find('ЗПИФ', 'attract.funnel_analysis', 'УБ');
  assert.equal(metric.value / metric.max_value, 1);
  assert.equal(metric.source?.correction?.origin, 'userConfirmedQ3ScoreCorrection');
});

test('BPIF Q3 acquisition and churn funnel corrections use the requested scores', () => {
  const expected = [
    ['churn.funnel_analysis', 1],
    ['churn.deviation_actions', 0],
    ['attract.funnel_analysis', 0.5],
    ['attract.initiatives_list', 0],
  ];
  for (const [code, score] of expected) {
    const metric = find('БПИФ', code, 'УБ');
    assert.equal(metric.value / metric.max_value, score, `${code} score`);
    assert.equal(metric.source?.correction?.origin, 'userConfirmedQ3ScoreCorrection');
  }
});

test('OPIF Q3 acquisition and churn funnel corrections use the requested scores', () => {
  const expected = [
    ['attract.funnel_analysis', 1],
    ['attract.initiatives_list', 0],
    ['churn.funnel_analysis', 1],
    ['churn.deviation_actions', 0],
  ];
  for (const [code, score] of expected) {
    const metric = find('ОПИФ', code, 'УБ');
    assert.equal(metric.value / metric.max_value, score, `${code} score`);
    assert.equal(metric.source?.correction?.origin, 'userConfirmedQ3ScoreCorrection');
  }
});
