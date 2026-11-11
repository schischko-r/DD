import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeBlockPercent, completeProductPercent, isDdIndexMetricForPeriod, maturityLevelName} from './report.js';

const period = 'III кв. 2026';
const approval = 'segment-channel-key-metrics-2026-11-11';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const report = read('../../public/report-data.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
const args = ['salary-products-q3-2026.json', 'reporting-regularity-missing-q3-2026.json', 'funnel-action-missing-q3-2026.json']
  .map(file => read(`../data/${file}`));
const backlog = read('../../public/backlog-data.json');
const flatten = product => product.metrics.flatMap(block => block.metrics);
const originalId = product => product.id.replace(/::empty::.*/, '');
const pair = (product, code) => [originalId(product), product.name, product.unit, product.type, code].join('|');
const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(report.products, selectedPeriod, facts, ...args, backlog);
const nav = 'navigator_reporting_knowledge';
const active = 'aktivnaya_klientskaya_baza';
const major = 'kol_vo_major_klientov';
const nonfinancial = 'kol_vo_klientov_s_2_nefin_servisov';
const income = 'sredniy_dohoda_na_klienta';
const expectedTeams = [
  ['Дети', 'CX', 'Сегмент', [active, major, nav]],
  ['Зрелость', 'CX', 'Сегмент', [active, major, nonfinancial]],
  ['МВС', 'CX', 'Сегмент', [active, major, nonfinancial, income]],
  ['Молодежь', 'CX', 'Сегмент', [active, major, nonfinancial, nav]],
  ['Рабочий возраст', 'CX', 'Сегмент', [active, major, nonfinancial, 'kol_vo_poluchateley_zp', 'dolya_rynka_fot', 'obъem_zachisleniy_fot', nav]],
  ['Top Affluent', 'CX', 'Сегмент', [active, major, nonfinancial, income]],
  ['PB', 'CX', 'Сегмент', [active, major, nonfinancial, income, nav]],
  ['Чат', 'PC', 'Канал', [nav]],
  ['СБОЛ', 'DP', 'Канал', [nav]],
  ['Уведомления', 'DP', 'Канал', [nav]],
  ['Единый личный кабинет (ЕЛК)', 'Data', 'Канал', [nav]],
];
const expected = new Set(expectedTeams.flatMap(([name, unit, type, codes]) => {
  const source = report.products.find(product => product.name === name && product.unit === unit && product.type === type);
  assert.ok(source, name);
  return codes.map(code => pair(source, `general.${code}`));
}));
const corrections = overlays.find(batch => batch.scope === 'q3-score-correction');
const facts = corrections.products.flatMap(team => Object.entries(team.metrics)
  .filter(([, fact]) => fact.source?.approvalGroup === approval).map(([code, fact]) => ({team, code, fact})));
const withoutApproved = structuredClone(overlays);
for (const team of withoutApproved.find(batch => batch.scope === 'q3-score-correction').products) {
  for (const [code, fact] of Object.entries(team.metrics)) if (fact.source?.approvalGroup === approval) delete team.metrics[code];
}
const close = (actual, wanted) => assert.ok(Math.abs(actual - wanted) < 1e-9, `${actual} ≠ ${wanted}`);

test('the approved knowledge correction contains exactly the 34 user-selected pairs with explicit provenance', () => {
  assert.equal(expected.size, 34);
  assert.equal(facts.length, 34);
  assert.deepEqual(new Set(facts.map(({team, code}) => pair(team, code))), expected);
  const before = build(withoutApproved);
  for (const {team, code, fact} of facts) {
    assert.equal(fact.rawValue, 1);
    for (const source of [fact.source, fact.source.correction]) {
      assert.equal(source.origin, 'userConfirmedQ3ScoreCorrection');
      assert.equal(source.confirmedBy, 'user');
      assert.equal(source.period, period);
      assert.equal(source.date, '2026-11-11');
      assert.equal(source.approvalGroup, approval);
    }
    assert.equal(fact.source.correction.rawValue, 1);
    const previous = before.find(product => originalId(product) === team.id);
    const metric = flatten(previous).find(metric => metric.code === code);
    assert.deepEqual(fact.source.previousAssessment,
      {value: metric.value, maxValue: metric.max_value, rawValue: metric.value / metric.max_value, source: metric.source});
  }
});

test('all 34 approved scores survive runtime precedence while other metrics, weights and Q2 stay unchanged', () => {
  const sourceSnapshot = structuredClone(report);
  const overlaySnapshot = structuredClone(overlays);
  const before = build(withoutApproved);
  const after = build(overlays);
  assert.equal(before.length, 76);
  assert.equal(after.length, 76);
  let selected = 0, changed = 0;
  const changedTeams = new Set();
  for (let i = 0; i < after.length; i++) {
    const product = after[i], prior = before[i];
    const {metrics: blocks, ...identity} = product;
    const {metrics: priorBlocks, ...oldIdentity} = prior;
    assert.deepEqual(identity, oldIdentity);
    assert.equal(blocks.length, priorBlocks.length);
    for (let b = 0; b < blocks.length; b++) {
      const {metrics: currentMetrics, ...blockMetadata} = blocks[b];
      const {metrics: oldMetrics, ...oldMetadata} = priorBlocks[b];
      assert.deepEqual(blockMetadata, oldMetadata);
      assert.equal(currentMetrics.length, oldMetrics.length);
      for (let m = 0; m < currentMetrics.length; m++) {
        const metric = currentMetrics[m], old = oldMetrics[m];
        if (!expected.has(pair(product, metric.code))) {
          assert.deepEqual(metric, old, `${product.name}: ${metric.code}`);
          continue;
        }
        selected++;
        assert.equal(blocks[b].code, 'general');
        assert.equal(metric.value, metric.max_value);
        assert.equal(metric.source.approvalGroup, approval);
        const {value, source, recommendation_items: items, previousValue, previousMaxValue, previousPeriod, ...fixed} = metric;
        const {value: priorValue, source: oldSource, recommendation_items: oldItems,
          previousValue: oldPreviousValue, previousMaxValue: oldPreviousMax, previousPeriod: oldPreviousPeriod, ...oldFixed} = old;
        assert.deepEqual(fixed, oldFixed, 'Preserve weight, applicability and index inclusion');
        const q2 = report.products.find(team => team.id === originalId(product));
        const historical = flatten(q2).find(item => item.code === metric.code);
        for (const [current, prior, baseline] of [[previousValue, oldPreviousValue, historical.value],
          [previousMaxValue, oldPreviousMax, historical.max_value], [previousPeriod, oldPreviousPeriod, q2.period]]) {
          if (prior !== undefined) assert.equal(current, prior, 'Existing Q2 history stays intact');
          else if (current !== undefined) assert.equal(current, baseline, 'New history metadata must match the real Q2 source');
        }
        for (let r = 0; r < (items || []).length; r++) {
          const {value: rv, max_value, gap, ...metadata} = items[r];
          const {value: ov, max_value: om, gap: og, ...oldMetadata} = oldItems[r];
          assert.deepEqual(metadata, oldMetadata);
          assert.equal(rv, value); assert.equal(max_value, metric.max_value); assert.equal(gap, 0);
        }
        if (value !== priorValue) {changed++; changedTeams.add(product.id);}
      }
    }
  }
  assert.equal(selected, 34);
  assert.equal(changed, 15);
  assert.equal(changedTeams.size, 10);
  assert.deepEqual(build(overlays, 'II кв. 2026'), report.products);
  assert.deepEqual(build(withoutApproved, 'II кв. 2026'), report.products);
  assert.deepEqual(report, sourceSnapshot);
  assert.deepEqual(overlays, overlaySnapshot);
  const children = after.find(product => product.name === 'Дети');
  const childrenNavigator = flatten(children).find(metric => metric.code === `general.${nav}`);
  assert.equal(childrenNavigator.value, childrenNavigator.max_value, 'Children Navigator is explicitly confirmed at 100%');
  assert.equal(childrenNavigator.previousValue, 0.25, 'The original Q2 half score is preserved');
  assert.equal(childrenNavigator.previousMaxValue, 0.5);
  assert.equal(childrenNavigator.previousPeriod, 'II кв. 2026');
  assert.equal(completeBlockPercent(children.metrics.find(block => block.code === 'general'), period), 100);
  const elk = after.find(product => product.name === 'Единый личный кабинет (ЕЛК)');
  const mau = flatten(elk).find(metric => metric.code === 'general.mau_u_vashego_kanala');
  assert.equal(mau.value, mau.max_value);
  assert.equal(mau.source.date, '2026-11-11');
  assert.notEqual(mau.source.approvalGroup, approval, 'The separate ELK MAU confirmation is preserved');
});

test('approved runtime values reproduce the approved team scores, overall DDI and sole level transition', () => {
  const before = build(withoutApproved), after = build(overlays);
  const score = product => completeProductPercent(product);
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  close(mean(before.map(score)), 63.68421052631579);
  close(mean(after.map(score)), 63.8421052631579);
  assert.equal(Math.round(mean(after.map(score))), 64);
  const raw = product => {
    const metrics = flatten(product).filter(metric => isDdIndexMetricForPeriod(metric, period));
    return metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.reduce((sum, metric) => sum + metric.max_value, 0) * 100;
  };
  close(mean(after.map(raw)), 63.87977031092274);
  close(mean(after.filter(team => team.type === 'Сегмент').map(score)), 62.42857142857143);
  close(mean(after.filter(team => team.type === 'Канал').map(score)), 75.11111111111111);
  for (const [name, expectedScore] of Object.entries({'Дети': 62, 'МВС': 69, 'Молодежь': 69,
    'Рабочий возраст': 69, 'PB': 58, 'Top Affluent': 61, 'Чат': 82, 'СБОЛ': 75, 'Уведомления': 56,
    'Единый личный кабинет (ЕЛК)': 63})) assert.equal(score(after.find(product => product.name === name)), expectedScore, name);
  assert.equal(after.filter((product, index) => score(product) !== score(before[index])).length, 9);
  const changes = after.filter((product, index) => maturityLevelName(score(product)) !== maturityLevelName(score(before[index])));
  assert.deepEqual(changes.map(product => product.name), ['Дети']);
  assert.equal(maturityLevelName(score(changes[0])), 'Зрелые');
});
