import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeProductPercent, isDdIndexMetricForPeriod, maturityLevelName} from './report.js';
import {navigatorKnowledgeFraction} from './navigatorKnowledge.js';

const period = 'III кв. 2026';
const approval = 'satellites-navigator-selected-12-2026-11-11';
const satellite = 'general.znanie_produktov_sputnikov';
const navigator = 'general.navigator_reporting_knowledge';
const selected = [
  ['16a909e6-2a89-532d-b1df-1f749aff70c8¦ОСАГО', 'ОСАГО', 'УБ'],
  ['11a243e6-5b73-56ad-8ac7-203e0d744062¦Оплата улыбкой', 'Оплата улыбкой', 'DB'],
  ['9721f391-d1a5-57d5-beb1-e0eaccbf0ed1¦Трансграничные переводы', 'Трансграничные переводы', 'DB'],
  ['723125c3-303d-5d2e-adc3-18460f242f63¦СберПрайм', 'СберПрайм', 'CX'],
  ['5b3c81af-8ad4-5fcd-84c0-729f3f44093f¦СберЧаевые', 'СберЧаевые', 'DB'],
  ['8cba2f54-2829-5599-9ee7-d1f288bb1f03¦ВЗР', 'ВЗР', 'УБ'],
  ['aa80593f-3f07-5935-96b3-2e367d6a78f4¦Платежи', 'Платежи', 'DB'],
  ['afe119a5-a944-5e11-90f9-e3facbd32e5c¦Кредитные карты', 'Кредитные карты', 'DB'],
  ['75028b72-7f89-55c1-a309-8c5b4193250a¦Трансграничный эквайринг', 'Трансграничный эквайринг', 'DB'],
  ['4bf2be31-ba6b-5ee2-b60d-bf62932ea0ce¦Переводы по РФ', 'Переводы по РФ', 'DB'],
  ['89b13e92-db89-516e-823f-1d102242bdc9¦КАСКО', 'КАСКО', 'УБ'],
  ['715a3090-94df-5954-b638-bb36c1ae24ae¦Личная защита Плюс', 'Личная защита Плюс', 'УБ'],
];
const upliftNames = ['КАСКО', 'ОСАГО', 'Личная защита Плюс'];
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const report = read('../../public/report-data.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
// Reproduce this approval's historical stage before the later, separately tested
// single-metric OSAGO churn correction.
for (const batch of overlays) for (const team of batch.products || []) {
  // Exclude only the two later Premier scores when reproducing this approval.
  if (batch.scope === 'q3-score-correction' && batch.period === period
    && team.id === 'cf93b82b-89a1-588c-992b-ed349f585aa0¦Пакет услуг СберПремьер'
    && team.name === 'Пакет услуг СберПремьер' && team.unit === 'CX' && team.type === 'Продукт') {
    for (const code of ['attract.nalichie_uspeshnyh_biznes_zapuskov', 'general.navigator_reporting_knowledge']) {
      const fact = team.metrics[code];
      if (fact?.source?.approvalGroup === 'premier-business-launches-navigator-2026-11-12'
        && fact.source.correction?.approvalGroup === 'premier-business-launches-navigator-2026-11-12') delete team.metrics[code];
    }
  }
  if (batch.scope === 'q3-score-correction' && team.id === 'cf93b82b-89a1-588c-992b-ed349f585aa0¦Пакет услуг СберПремьер'
    && team.name === 'Пакет услуг СберПремьер' && team.unit === 'CX' && team.type === 'Продукт'
    && team.metrics['attract.initiatives_list']?.source?.approvalGroup === 'premier-attract-initiatives-2026-11-11') {
    delete team.metrics['attract.initiatives_list'];
  }
  if (batch.scope === 'q3-score-correction' && team.id === '11a243e6-5b73-56ad-8ac7-203e0d744062¦Оплата улыбкой'
    && team.name === 'Оплата улыбкой' && team.unit === 'DB' && team.type === 'Продукт'
    && team.metrics['general.obъem_celevogo_rynka_v_rossii']?.source?.approvalGroup === 'smile-russia-market-2026-11-11') {
    delete team.metrics['general.obъem_celevogo_rynka_v_rossii'];
  }
  if (batch.scope === 'q3-score-correction' && team.id === '16a909e6-2a89-532d-b1df-1f749aff70c8¦ОСАГО'
    && team.name === 'ОСАГО' && team.unit === 'УБ' && team.type === 'Продукт'
    && team.metrics['churn.report_completeness']?.source?.approvalGroup === 'osago-churn-report-completeness-2026-11-11') {
    delete team.metrics['churn.report_completeness'];
  }
  if (batch.scope === 'q3-score-correction' && team.id === '16a909e6-2a89-532d-b1df-1f749aff70c8¦ОСАГО'
    && team.name === 'ОСАГО' && team.unit === 'УБ' && team.type === 'Продукт'
    && team.metrics['mehaniki.gibkoe_izmenenie_usloviy_produkta']?.source?.approvalGroup === 'osago-flexible-max-2026-11-11') {
    delete team.metrics['mehaniki.gibkoe_izmenenie_usloviy_produkta'];
  }
}
const args = ['salary-products-q3-2026.json', 'reporting-regularity-missing-q3-2026.json', 'funnel-action-missing-q3-2026.json']
  .map(file => read(`../data/${file}`));
const backlog = read('../../public/backlog-data.json');
const flat = product => product.metrics.flatMap(block => block.metrics);
const originalId = product => String(product.id).replace(/::empty::.*/, '');
const identity = product => [originalId(product), product.name, product.unit, product.type].join('|');
const pair = (product, code) => `${identity(product)}|${code}`;
const expected = new Set(selected.flatMap(([id, name, unit]) => {
  const team = {id, name, unit, type: 'Продукт'};
  return [satellite, ...(upliftNames.includes(name) ? [navigator] : [])].map(code => pair(team, code));
}));
const corrections = overlays.find(batch => batch.scope === 'q3-score-correction');
const facts = corrections.products.flatMap(team => Object.entries(team.metrics)
  .filter(([, fact]) => fact.source?.approvalGroup === approval).map(([code, fact]) => ({team, code, fact})));
const beforeOverlays = structuredClone(overlays);
for (const batch of beforeOverlays) for (const team of batch.products || []) {
  for (const [code, fact] of Object.entries(team.metrics || {})) if (fact.source?.approvalGroup === approval) delete team.metrics[code];
}
const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(report.products, selectedPeriod, facts, ...args, backlog);
const close = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-9, `${value} != ${expected}`);
const applicable = metric => metric.is_applicabble_flg !== false && metric.max_value > 0;

test('the new approval contains exactly twelve satellite and three Navigator facts with explicit user provenance', () => {
  assert.equal(expected.size, 15);
  assert.equal(facts.length, 15);
  assert.deepEqual(new Set(facts.map(({team, code}) => pair(team, code))), expected);
  const before = build(beforeOverlays);
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
    const prior = before.find(product => identity(product) === identity(team));
    const metric = flat(prior).find(metric => metric.code === code);
    assert.deepEqual(fact.source.previousAssessment,
      {value: metric.value, maxValue: metric.max_value, rawValue: metric.value / metric.max_value, source: metric.source});
  }
});

test('the final runtime changes only the thirteen approved values while preserving the rubric, Q2 and excluded initiatives', () => {
  const sourceSnapshot = structuredClone(report), overlaySnapshot = structuredClone(overlays);
  const before = build(beforeOverlays), after = build(overlays);
  assert.equal(after.length, 76);
  let selectedCount = 0, satelliteChanges = 0, navigatorChanges = 0;
  const capMetadataChanges = [];
  for (let i = 0; i < after.length; i++) {
    const team = after[i], prior = before[i];
    const {metrics: blocks, ...metadata} = team, {metrics: oldBlocks, ...oldMetadata} = prior;
    assert.deepEqual(metadata, oldMetadata);
    for (let b = 0; b < blocks.length; b++) {
      const {metrics, ...blockMetadata} = blocks[b], {metrics: oldMetrics, ...oldBlockMetadata} = oldBlocks[b];
      assert.deepEqual(blockMetadata, oldBlockMetadata);
      assert.equal(metrics.length, oldMetrics.length);
      for (let j = 0; j < metrics.length; j++) {
        const metric = metrics[j], old = oldMetrics[j];
        if (!expected.has(pair(team, metric.code))) {
          if (metric.code === navigator && ['СберПрайм', 'Платежи', 'Кредитные карты'].includes(team.name)
            && JSON.stringify(metric.source) !== JSON.stringify(old.source)) {
            const {source, ...fixed} = metric, {source: oldSource, ...oldFixed} = old;
            assert.deepEqual(fixed, oldFixed, 'A revised cap proof cannot change the standing Navigator score');
            assert.equal(source.origin, 'userConfirmedKeyMetricsAccuracyCap');
            assert.equal(source.confirmedBy, 'user');
            assert.equal(source.period, period);
            assert.equal(source.rawValue, 0.5);
            const errors = team.metrics.find(block => block.code === 'general').metrics
              .filter(m => m.code !== navigator && applicable(m) && Number.isFinite(m.value) && m.value < m.max_value);
            assert.deepEqual(source.errorMetricCodes, errors.map(m => m.code));
            assert.ok(errors.length > 0);
            assert.ok(!source.errorMetricCodes.includes(satellite), 'The restored satellite is no longer a cap blocker');
            assert.equal(source.previousSource.origin, 'userConfirmedNavigatorKnowledgeHierarchy');
            assert.equal(source.previousSource.rawValue, 1);
            assert.deepEqual(source.previousSource.previousAssessmentSource, oldSource);
            for (const input of source.previousSource.inputs) {
              const current = flat(team).find(m => m.code === input.code);
              assert.equal(input.value, current.value); assert.equal(input.maxValue, current.max_value);
              assert.equal(input.applicable, current.is_applicabble_flg !== false);
            }
            capMetadataChanges.push(team.name);
          } else assert.deepEqual(metric, old, `${team.name}: ${metric.code}`);
          continue;
        }
        selectedCount++;
        assert.equal(metric.value, metric.max_value);
        assert.equal(metric.source.approvalGroup, approval);
        const {value, source, recommendation_items: items, previousValue, previousMaxValue, previousPeriod, ...fixed} = metric;
        const {value: oldValue, source: oldSource, recommendation_items: oldItems,
          previousValue: oldPreviousValue, previousMaxValue: oldPreviousMax, previousPeriod: oldPreviousPeriod, ...oldFixed} = old;
        assert.deepEqual(fixed, oldFixed, 'Weights, applicability, index flags and all rubric fields stay intact');
        const q2 = report.products.find(p => identity(p) === identity(team));
        const historical = flat(q2).find(m => m.code === metric.code);
        for (const [actual, previous, baseline] of [[previousValue, oldPreviousValue, historical.value],
          [previousMaxValue, oldPreviousMax, historical.max_value], [previousPeriod, oldPreviousPeriod, q2.period]]) {
          if (previous !== undefined) assert.equal(actual, previous);
          else if (actual !== undefined) assert.equal(actual, baseline, 'Added history must be the genuine Q2 history');
        }
        for (let r = 0; r < (items || []).length; r++) {
          const {value: rv, max_value, gap, ...metadata} = items[r];
          const {value: ov, max_value: om, gap: og, ...oldMetadata} = oldItems[r];
          assert.deepEqual(metadata, oldMetadata);
          assert.equal(rv, value); assert.equal(max_value, metric.max_value); assert.equal(gap, 0);
        }
        if (value !== oldValue) metric.code === satellite ? satelliteChanges++ : navigatorChanges++;
      }
    }
  }
  assert.equal(selectedCount, 15);
  assert.equal(satelliteChanges, 10);
  assert.equal(navigatorChanges, 3);
  assert.deepEqual(capMetadataChanges.sort(), ['СберПрайм', 'Платежи', 'Кредитные карты'].sort());
  const initiatives = flat(after.find(p => p.name === 'ОСАГО')).find(m => m.code === 'hyp.extra_initiatives');
  assert.equal(initiatives.value, null); assert.equal(initiatives.max_value, 0); assert.equal(initiatives.is_applicabble_flg, false);
  assert.deepEqual(build(overlays, 'II кв. 2026'), report.products);
  assert.deepEqual(build(beforeOverlays, 'II кв. 2026'), report.products);
  assert.deepEqual(report, sourceSnapshot); assert.deepEqual(overlays, overlaySnapshot);
});

test('only removing the final satellite blocker lifts Navigator and the live scores reproduce the approved scenario', () => {
  const before = build(beforeOverlays), after = build(overlays), lifted = [];
  let liveApprovedFacts = 0;
  for (const team of corrections.products) for (const [code, fact] of Object.entries(team.metrics)) {
    if (![approval, 'segment-channel-key-metrics-2026-11-11'].includes(fact.source?.approvalGroup)) continue;
    const product = after.find(product => identity(product) === identity(team));
    const metric = flat(product).find(metric => metric.code === code);
    assert.equal(metric.value, metric.max_value, `Every prior and new approved pair survives: ${team.name}/${code}`);
    assert.equal(metric.source.approvalGroup, fact.source.approvalGroup);
    liveApprovedFacts++;
  }
  assert.equal(liveApprovedFacts, 49);
  const elkMau = flat(after.find(p => p.name === 'Единый личный кабинет (ЕЛК)')).find(m => m.code === 'general.mau_u_vashego_kanala');
  assert.equal(elkMau.value, elkMau.max_value, 'The separate November11 ELK MAU correction also survives');
  for (const [id, name] of selected) {
    const team = after.find(product => originalId(product) === id), prior = before.find(product => originalId(product) === id);
    const general = team.metrics.find(block => block.code === 'general').metrics;
    const metric = general.find(metric => metric.code === navigator), old = flat(prior).find(metric => metric.code === navigator);
    const known = general.filter(metric => metric.code !== navigator && applicable(metric));
    if (metric.value !== old.value) {
      lifted.push(name);
      assert.ok(known.every(metric => metric.value === metric.max_value));
      assert.equal(navigatorKnowledgeFraction(flat(team)), 1);
      assert.equal(old.value, old.max_value * 0.5);
      assert.equal(metric.value, metric.max_value);
      assert.deepEqual(metric.source.inputs, known.map(m => ({code: m.code, value: m.value,
        maxValue: m.max_value, rawValue: 1})));
      assert.equal(metric.source.approvedScenario.file,
        'outputs/ddi-satellites-navigator-selected-12-2026-11-11/scenario.json');
      assert.match(metric.source.approvedScenario.sha256, /^[a-f0-9]{64}$/);
    } else assert.equal(metric.value, old.value, 'Preserve standing manual scores when other blockers remain or Navigator is already full');
  }
  assert.deepEqual(lifted.sort(), upliftNames.slice().sort());
  const scores = {'ОСАГО': 82, 'Оплата улыбкой': 72, 'Трансграничные переводы': 42, 'СберПрайм': 68,
    'СберЧаевые': 36, 'ВЗР': 82, 'Платежи': 62, 'Кредитные карты': 55, 'Трансграничный эквайринг': 31,
    'Переводы по РФ': 84, 'КАСКО': 72, 'Личная защита Плюс': 59};
  for (const [name, score] of Object.entries(scores)) assert.equal(completeProductPercent(after.find(p => p.name === name)), score, name);
  const mean = products => products.reduce((sum, product) => sum + completeProductPercent(product), 0) / products.length;
  close(mean(before), 63.8421052631579); close(mean(after), 63.973684210526315);
  assert.equal(Math.round(mean(after)), 64);
  const raw = after.map(product => {
    const metrics = flat(product).filter(metric => isDdIndexMetricForPeriod(metric, period));
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.reduce((sum, m) => sum + m.max_value, 0) * 100;
  });
  close(raw.reduce((a, b) => a + b, 0) / raw.length, 63.98672026461467);
  assert.equal(after.filter((product, i) => completeProductPercent(product) !== completeProductPercent(before[i])).length, 9);
  const levelChanges = after.filter((product, i) => maturityLevelName(completeProductPercent(product)) !== maturityLevelName(completeProductPercent(before[i])));
  assert.deepEqual(levelChanges.map(p => p.name), ['ОСАГО']);
  assert.equal(maturityLevelName(completeProductPercent(levelChanges[0])), 'Лидеры Data Driven');
});
