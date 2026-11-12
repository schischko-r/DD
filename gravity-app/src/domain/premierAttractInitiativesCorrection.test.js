import {beforeSberIdNavigatorConfirmation} from './test-fixtures/sberIdNavigatorStage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeProductPercent, maturityLevelName} from './report.js';

const period = 'III кв. 2026';
const id = 'cf93b82b-89a1-588c-992b-ed349f585aa0¦Пакет услуг СберПремьер';
const code = 'attract.initiatives_list';
const approval = 'premier-attract-initiatives-2026-11-11';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const report = read('../../public/report-data.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
// Reproduce the 11 November approval before the two later Premier facts.
const laterCodes = new Set(['attract.nalichie_uspeshnyh_biznes_zapuskov', 'general.navigator_reporting_knowledge']);
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`)).map(beforeSberIdNavigatorConfirmation)
  .map(batch => batch.scope !== 'q3-score-correction' || batch.period !== period ? batch : {...batch,
    products: batch.products.map(team => team.id !== id || team.unit !== 'CX' || team.type !== 'Продукт' ? team : {...team,
      metrics: Object.fromEntries(Object.entries(team.metrics).filter(([metricCode, fact]) =>
        !laterCodes.has(metricCode) || fact.source?.approvalGroup !== 'premier-business-launches-navigator-2026-11-12')),
    }),
  });
const args = ['salary-products-q3-2026.json', 'reporting-regularity-missing-q3-2026.json', 'funnel-action-missing-q3-2026.json']
  .map(file => read(`../data/${file}`));
const backlog = read('../../public/backlog-data.json');
const flat = product => product.metrics.flatMap(block => block.metrics);
const originalId = product => String(product.id).replace(/::empty::.*/, '');
const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(report.products, selectedPeriod, facts, ...args, backlog);
const corrections = overlays.find(batch => batch.scope === 'q3-score-correction');
const selected = corrections.products.flatMap(team => Object.entries(team.metrics)
  .filter(([, fact]) => fact.source?.approvalGroup === approval).map(([code, fact]) => ({team, code, fact})));
const beforeOverlays = structuredClone(overlays);
const priorTeam = beforeOverlays.find(batch => batch.scope === 'q3-score-correction').products.find(team => team.id === id);
if (priorTeam) delete priorTeam.metrics[code];

test('Premier attraction initiatives have one exact user-confirmed full assessment with the genuine prior assessment', () => {
  assert.equal(selected.length, 1);
  const {team, fact, code: selectedCode} = selected[0];
  assert.equal(team.id, id); assert.equal(team.name, 'Пакет услуг СберПремьер');
  assert.equal(team.unit, 'CX'); assert.equal(team.type, 'Продукт'); assert.equal(selectedCode, code);
  assert.equal(fact.rawValue, 1);
  for (const proof of [fact.source, fact.source.correction]) {
    assert.equal(proof.origin, 'userConfirmedQ3ScoreCorrection'); assert.equal(proof.confirmedBy, 'user');
    assert.equal(proof.period, period); assert.equal(proof.date, '2026-11-11'); assert.equal(proof.approvalGroup, approval);
  }
  assert.equal(fact.source.correction.rawValue, 1);
  const prior = flat(build(beforeOverlays).find(product => originalId(product) === id)).find(metric => metric.code === code);
  assert.deepEqual(fact.source.previousAssessment,
    {value: prior.value, maxValue: prior.max_value, rawValue: prior.value / prior.max_value, source: prior.source});
});

test('the 11 November Premier approval changes only its attraction initiatives and preserves the rubric, Q2 and other approvals', () => {
  const reportSnapshot = structuredClone(report), overlaysSnapshot = structuredClone(overlays);
  const before = build(beforeOverlays), after = build(overlays);
  assert.equal(before.length, 76); assert.equal(after.length, 76);
  let changed = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], previous = before[i];
    if (originalId(current) !== id) {
      assert.deepEqual(current, previous, `Unrelated team remains intact: ${current.name}`);
      continue;
    }
    const {metrics: blocks, ...metadata} = current, {metrics: priorBlocks, ...priorMetadata} = previous;
    assert.deepEqual(metadata, priorMetadata);
    for (let b = 0; b < blocks.length; b++) {
      const {metrics, ...blockMetadata} = blocks[b], {metrics: priorMetrics, ...priorBlockMetadata} = priorBlocks[b];
      assert.deepEqual(blockMetadata, priorBlockMetadata); assert.equal(metrics.length, priorMetrics.length);
      for (let j = 0; j < metrics.length; j++) {
        const metric = metrics[j], prior = priorMetrics[j];
        if (metric.code !== code) {assert.deepEqual(metric, prior, `Unrelated Premier metric: ${metric.code}`); continue;}
        changed++;
        assert.equal(prior.value, 0.5); assert.equal(prior.max_value, 1);
        assert.equal(metric.value, 1); assert.equal(metric.max_value, 1);
        assert.equal(metric.is_applicabble_flg, true); assert.equal(metric.excluded_from_index, false);
        assert.equal(metric.dd_calculation_flg, 1); assert.equal(metric.source.approvalGroup, approval);
        const {value, source, recommendation_items: items, ...rubric} = metric;
        const {value: oldValue, source: oldSource, recommendation_items: priorItems, ...priorRubric} = prior;
        assert.deepEqual(rubric, priorRubric, 'Weights, applicability, index flags and Q2 history remain intact');
        assert.deepEqual(items, priorItems.map(item => ({...item, value: 1, gap: 0})));
      }
    }
    assert.equal(completeProductPercent(previous), 72); assert.equal(completeProductPercent(current), 74);
    assert.equal(maturityLevelName(completeProductPercent(previous)), 'Зрелые');
    assert.equal(maturityLevelName(completeProductPercent(current)), 'Зрелые');
  }
  assert.equal(changed, 1);
  assert.equal(after.filter((team, index) => completeProductPercent(team) !== completeProductPercent(before[index])).length, 1);
  const mean = products => products.reduce((sum, product) => sum + completeProductPercent(product), 0) / products.length;
  assert.ok(Math.abs(mean(before) - 64.35526315789474) < 1e-9);
  assert.ok(Math.abs(mean(after) - 64.38157894736842) < 1e-9);
  assert.equal(Math.round(mean(after)), 64);
  assert.deepEqual(build(overlays, 'II кв. 2026'), report.products);
  assert.deepEqual(build(beforeOverlays, 'II кв. 2026'), report.products);
  assert.deepEqual(report, reportSnapshot); assert.deepEqual(overlays, overlaysSnapshot);
});
