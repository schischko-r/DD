import {beforeSberIdNavigatorConfirmation} from './test-fixtures/sberIdNavigatorStage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeProductPercent, maturityLevelName} from './report.js';

const period = 'III кв. 2026';
const id = '16a909e6-2a89-532d-b1df-1f749aff70c8¦ОСАГО';
const code = 'churn.report_completeness';
const approval = 'osago-churn-report-completeness-2026-11-11';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const report = read('../../public/report-data.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`)).map(beforeSberIdNavigatorConfirmation);
// This historical correction precedes the later, independently tested max change.
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
  if (batch.scope === 'q3-score-correction' && team.id === id && team.name === 'ОСАГО'
    && team.unit === 'УБ' && team.type === 'Продукт'
    && team.metrics['mehaniki.gibkoe_izmenenie_usloviy_produkta']?.source?.approvalGroup === 'osago-flexible-max-2026-11-11') {
    delete team.metrics['mehaniki.gibkoe_izmenenie_usloviy_produkta'];
  }
}
const args = ['salary-products-q3-2026.json', 'reporting-regularity-missing-q3-2026.json', 'funnel-action-missing-q3-2026.json']
  .map(file => read(`../data/${file}`));
const backlog = read('../../public/backlog-data.json');
const flat = team => team.metrics.flatMap(block => block.metrics);
const originalId = team => String(team.id).replace(/::empty::.*/, '');
const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(report.products, selectedPeriod, facts, ...args, backlog);
const correction = overlays.find(batch => batch.scope === 'q3-score-correction');
const beforeOverlays = structuredClone(overlays);
delete beforeOverlays.find(batch => batch.scope === 'q3-score-correction').products.find(team => team.id === id).metrics[code];

test('the explicit OSAGO churn-completeness zero survives the final pipeline and changes exactly one metric', () => {
  const sourceSnapshot = structuredClone(report), overlaySnapshot = structuredClone(overlays);
  const approved = correction.products.flatMap(team => Object.entries(team.metrics)
    .filter(([, fact]) => fact.source?.approvalGroup === approval).map(([code, fact]) => ({team, code, fact})));
  assert.equal(approved.length, 1);
  const {team, fact, code: factCode} = approved[0];
  assert.equal(team.id, id); assert.equal(team.name, 'ОСАГО'); assert.equal(team.unit, 'УБ'); assert.equal(team.type, 'Продукт');
  assert.equal(factCode, code); assert.equal(fact.rawValue, 0);
  for (const proof of [fact.source, fact.source.correction]) {
    assert.equal(proof.origin, 'userConfirmedQ3ScoreCorrection'); assert.equal(proof.confirmedBy, 'user');
    assert.equal(proof.period, period); assert.equal(proof.date, '2026-11-11'); assert.equal(proof.approvalGroup, approval);
  }
  assert.equal(fact.source.correction.rawValue, 0);
  const before = build(beforeOverlays), after = build(overlays);
  assert.equal(before.length, 76); assert.equal(after.length, 76);
  let changed = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], prior = before[i];
    if (originalId(current) !== id) {
      assert.deepEqual(current, prior, `Unrelated team stays intact: ${current.name}`);
      continue;
    }
    const {metrics: blocks, ...metadata} = current, {metrics: oldBlocks, ...oldMetadata} = prior;
    assert.deepEqual(metadata, oldMetadata);
    for (let b = 0; b < blocks.length; b++) {
      const {metrics, ...blockMetadata} = blocks[b], {metrics: oldMetrics, ...oldBlockMetadata} = oldBlocks[b];
      assert.deepEqual(blockMetadata, oldBlockMetadata);
      assert.equal(metrics.length, oldMetrics.length);
      for (let j = 0; j < metrics.length; j++) {
        const metric = metrics[j], old = oldMetrics[j];
        if (metric.code !== code) {assert.deepEqual(metric, old, `Unrelated OSAGO metric: ${metric.code}`); continue;}
        changed++;
        assert.equal(old.value, 0.25); assert.equal(old.max_value, 0.5);
        assert.equal(metric.value, 0); assert.equal(metric.max_value, 0.5);
        assert.equal(metric.is_applicabble_flg, true); assert.equal(metric.excluded_from_index, false);
        assert.equal(metric.dd_calculation_flg, 1); assert.equal(metric.source.approvalGroup, approval);
        assert.deepEqual(fact.source.previousAssessment,
          {value: old.value, maxValue: old.max_value, rawValue: old.value / old.max_value, source: old.source});
        const {value, source, recommendation_items: items, ...rubric} = metric;
        const {value: oldValue, source: oldSource, recommendation_items: oldItems, ...oldRubric} = old;
        assert.deepEqual(rubric, oldRubric, 'Preserve all rubric and Q2 history fields');
        assert.deepEqual(items, oldItems.map(item => ({...item, value: 0, gap: metric.max_value})));
      }
    }
  }
  assert.equal(changed, 1);
  assert.deepEqual(build(overlays, 'II кв. 2026'), report.products);
  assert.deepEqual(build(beforeOverlays, 'II кв. 2026'), report.products);
  assert.deepEqual(report, sourceSnapshot); assert.deepEqual(overlays, overlaySnapshot);
});

test('the correction preserves all earlier knowledge approvals and excluded initiatives while updating only the OSAGO score', () => {
  const before = build(beforeOverlays), after = build(overlays);
  const osago = after.find(team => originalId(team) === id), prior = before.find(team => originalId(team) === id);
  const q2 = report.products.find(team => team.id === id), historical = flat(q2).find(metric => metric.code === code);
  const current = flat(osago).find(metric => metric.code === code);
  assert.equal(historical.value, 0); assert.equal(historical.max_value, 0.5);
  assert.equal(current.previousValue, historical.value); assert.equal(current.previousMaxValue, historical.max_value);
  assert.equal(current.previousPeriod, 'II кв. 2026');
  let selected = 0;
  for (const team of correction.products) for (const [code, fact] of Object.entries(team.metrics)) {
    if (!['segment-channel-key-metrics-2026-11-11', 'satellites-navigator-selected-12-2026-11-11'].includes(fact.source?.approvalGroup)) continue;
    const metric = flat(after.find(product => originalId(product) === team.id)).find(metric => metric.code === code);
    assert.equal(metric.value, metric.max_value, `${team.name}/${code}`); selected++;
  }
  assert.equal(selected, 49);
  for (const code of ['general.znanie_produktov_sputnikov', 'general.navigator_reporting_knowledge']) {
    const metric = flat(osago).find(metric => metric.code === code); assert.equal(metric.value, metric.max_value);
  }
  const initiatives = flat(osago).find(metric => metric.code === 'hyp.extra_initiatives');
  assert.equal(initiatives.value, null); assert.equal(initiatives.max_value, 0); assert.equal(initiatives.is_applicabble_flg, false);
  assert.equal(completeProductPercent(prior), 82); assert.equal(completeProductPercent(osago), 81);
  assert.equal(maturityLevelName(completeProductPercent(osago)), 'Лидеры Data Driven');
  assert.equal(after.filter((team, i) => completeProductPercent(team) !== completeProductPercent(before[i])).length, 1);
  const mean = after.reduce((sum, team) => sum + completeProductPercent(team), 0) / after.length;
  assert.ok(Math.abs(mean - 63.96052631578947) < 1e-9); assert.equal(Math.round(mean), 64);
});
