import {beforeSberIdNavigatorConfirmation} from './test-fixtures/sberIdNavigatorStage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeProductPercent, maturityLevelName} from './report.js';

const period = 'III кв. 2026';
const id = 'cf93b82b-89a1-588c-992b-ed349f585aa0¦Пакет услуг СберПремьер';
const codes = ['attract.nalichie_uspeshnyh_biznes_zapuskov', 'general.navigator_reporting_knowledge'];
const approval = 'premier-business-launches-navigator-2026-11-12';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const report = read('../../public/report-data.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`)).map(beforeSberIdNavigatorConfirmation);
const args = ['salary-products-q3-2026.json', 'reporting-regularity-missing-q3-2026.json', 'funnel-action-missing-q3-2026.json']
  .map(file => read(`../data/${file}`));
const backlog = read('../../public/backlog-data.json');
const flat = product => product.metrics.flatMap(block => block.metrics);
const originalId = product => String(product.id).replace(/::empty::.*/, '');
const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(report.products, selectedPeriod, facts, ...args, backlog);
const corrections = overlays.find(batch => batch.scope === 'q3-score-correction');
const approvedTeam = corrections.products.find(team => team.id === id);
const beforeOverlays = structuredClone(overlays);
const priorTeam = beforeOverlays.find(batch => batch.scope === 'q3-score-correction').products.find(team => team.id === id);
for (const code of codes) delete priorTeam.metrics[code];

test('both Premier facts have exact approval provenance and genuine previous assessments', () => {
  const selected = corrections.products.flatMap(team => Object.entries(team.metrics)
    .filter(([, fact]) => fact.source?.approvalGroup === approval).map(([code, fact]) => ({team, code, fact})));
  assert.equal(selected.length, 2);
  assert.deepEqual(new Set(selected.map(item => item.code)), new Set(codes));
  const before = build(beforeOverlays).find(product => originalId(product) === id);
  for (const {team, code, fact} of selected) {
    assert.equal(team.name, 'Пакет услуг СберПремьер'); assert.equal(team.id, id);
    assert.equal(team.unit, 'CX'); assert.equal(team.type, 'Продукт');
    assert.equal(fact.rawValue, 1);
    for (const proof of [fact.source, fact.source.correction]) {
      assert.equal(proof.origin, 'userConfirmedQ3ScoreCorrection'); assert.equal(proof.confirmedBy, 'user');
      assert.equal(proof.period, period); assert.equal(proof.date, '2026-11-12'); assert.equal(proof.approvalGroup, approval);
    }
    assert.equal(fact.source.correction.rawValue, 1);
    const prior = flat(before).find(metric => metric.code === code);
    assert.deepEqual(fact.source.previousAssessment,
      {value: prior.value, maxValue: prior.max_value, rawValue: prior.value / prior.max_value, source: prior.source});
  }
  assert.equal(approvedTeam.metrics['attract.initiatives_list'].source.approvalGroup, 'premier-attract-initiatives-2026-11-11');
  assert.equal(corrections.counts.teams, corrections.products.length);
  assert.equal(corrections.counts.facts, corrections.products.reduce((sum, team) => sum + Object.keys(team.metrics).length, 0));
});

test('the complete live pipeline changes only the two Premier scores and preserves Navigator priority, Q2 and other approvals', () => {
  const snapshot = structuredClone({report, overlays, args, backlog});
  const before = build(beforeOverlays), after = build(overlays);
  assert.equal(after.length, 76); assert.equal(before.length, 76);
  let changed = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], previous = before[i];
    if (originalId(current) !== id) {assert.deepEqual(current, previous, `Unrelated team: ${current.name}`); continue;}
    const {metrics: blocks, ...metadata} = current, {metrics: oldBlocks, ...oldMetadata} = previous;
    assert.deepEqual(metadata, oldMetadata);
    for (let b = 0; b < blocks.length; b++) {
      const {metrics, ...blockMetadata} = blocks[b], {metrics: oldMetrics, ...oldBlockMetadata} = oldBlocks[b];
      assert.deepEqual(blockMetadata, oldBlockMetadata);
      for (let j = 0; j < metrics.length; j++) {
        const metric = metrics[j], prior = oldMetrics[j];
        if (!codes.includes(metric.code)) {assert.deepEqual(metric, prior, `Unrelated metric: ${metric.code}`); continue;}
        changed++;
        assert.equal(prior.value, metric.code === codes[0] ? 0 : 0.25); assert.equal(prior.max_value, 0.5);
        assert.equal(metric.value, 0.5); assert.equal(metric.max_value, 0.5);
        assert.equal(metric.source.approvalGroup, approval);
        const {value, source, recommendation_items: items, ...rubric} = metric;
        const {value: oldValue, source: oldSource, recommendation_items: oldItems, ...oldRubric} = prior;
        assert.deepEqual(rubric, oldRubric);
        assert.deepEqual(items, oldItems.map(item => ({...item, value: 0.5, gap: 0})));
      }
    }
    assert.equal(completeProductPercent(previous), 74); assert.equal(completeProductPercent(current), 77);
    assert.equal(maturityLevelName(completeProductPercent(previous)), 'Зрелые');
    assert.equal(maturityLevelName(completeProductPercent(current)), 'Зрелые');
  }
  assert.equal(changed, 2);
  const mean = products => products.reduce((sum, product) => sum + completeProductPercent(product), 0) / products.length;
  assert.ok(Math.abs(mean(before) - 64.38157894736842) < 1e-9);
  assert.ok(Math.abs(mean(after) - 64.42105263157895) < 1e-9);
  assert.equal(Math.round(mean(after)), 64);
  assert.deepEqual(build(overlays, 'II кв. 2026'), report.products);
  assert.deepEqual(build(beforeOverlays, 'II кв. 2026'), report.products);
  assert.deepEqual({report, overlays, args, backlog}, snapshot);
});
