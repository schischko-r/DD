import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeProductPercent, isDdIndexMetricForPeriod, maturityLevelName} from './report.js';
import {beforeDszhPkSelfServiceConfirmation} from './test-fixtures/sberIdNavigatorStage.js';

const period = 'III кв. 2026';
const id = 'e8c97fe4-bd38-5aa1-9388-5c532cbde6f2¦ДСЖ ПК';
const code = 'attract.nalichie_self_service';
const approval = 'dszh-pk-self-service-2026-11-19';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const report = read('../../public/report-data.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
const args = ['salary-products-q3-2026.json', 'reporting-regularity-missing-q3-2026.json', 'funnel-action-missing-q3-2026.json']
  .map(file => read(`../data/${file}`));
const backlog = read('../../public/backlog-data.json');
const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(report.products, selectedPeriod, facts, ...args, backlog);
const flat = product => product.metrics.flatMap(block => block.metrics);
const originalId = product => String(product.id).replace(/::empty::.*/, '');
const beforeOverlays = overlays.map(beforeDszhPkSelfServiceConfirmation);

test('the 19 November approval updates one existing DSZh PK Self-service fact and keeps its prior zero assessment', () => {
  const selected = overlays.flatMap(batch => (batch.products || []).flatMap(team => Object.entries(team.metrics || {})
    .filter(([, fact]) => fact.source?.approvalGroup === approval).map(([metricCode, fact]) => ({batch, team, metricCode, fact}))));
  assert.equal(selected.length, 1);
  const {batch, team, metricCode, fact} = selected[0];
  assert.equal(batch.scope, 'q3-score-correction'); assert.equal(batch.period, period);
  assert.deepEqual([team.id, team.name, team.unit, team.type, metricCode], [id, 'ДСЖ ПК', 'УБ', 'Продукт', code]);
  assert.equal(fact.rawValue, 1);
  const proof = fact.source;
  assert.equal(proof.origin, 'userConfirmedQ3ScoreCorrection'); assert.equal(proof.confirmedBy, 'user');
  assert.equal(proof.date, '2026-11-19'); assert.equal(proof.period, period);
  assert.equal(proof.sourceName, team.name); assert.equal(proof.sourceMetricName, 'Наличие Self-service');
  assert.equal(proof.correction.approvalGroup, approval); assert.equal(proof.correction.rawValue, 1);
  assert.equal(proof.correction.date, '2026-11-19'); assert.equal(proof.correction.period, period);
  assert.equal(proof.correction.confirmedBy, 'user');
  const prior = flat(build(beforeOverlays).find(product => originalId(product) === id)).find(metric => metric.code === code);
  const {rawValue: appliedRawValue, ...priorFactSource} = prior.source;
  assert.equal(appliedRawValue, 0, 'The runtime annotates the unchanged original fact with its applied raw score');
  assert.deepEqual(proof.previousAssessment, {value: prior.value, maxValue: prior.max_value, rawValue: prior.value / prior.max_value, source: priorFactSource});
  assert.equal(prior.value, 0); assert.equal(prior.max_value, 0.5);
  assert.equal(prior.source.date, '2026-11-03'); assert.equal(prior.source.correction.group, 'campaignAudit20261103');
  assert.equal(prior.source.correction.rawValue, 0); assert.equal(prior.source.previousAssessmentValue, 0.5);
  assert.equal(prior.source.previousAssessmentSource.origin, 'userConfirmedCampaignPresence20261102');
  assert.equal(batch.counts.teams, 49); assert.equal(batch.counts.facts, 134);
  assert.equal(batch.counts.teams, batch.products.length);
  assert.equal(batch.counts.facts, batch.products.reduce((sum, product) => sum + Object.keys(product.metrics).length, 0));
});

test('the live App pipeline changes only DSZh PK Self-service from zero to full weight; denominators, Q2 and all other teams stay intact', () => {
  const snapshot = structuredClone({report, overlays, args, backlog});
  const before = build(beforeOverlays), after = build(overlays);
  assert.equal(before.length, 76); assert.equal(after.length, 76);
  let changed = 0, unchangedTeams = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], prior = before[i];
    if (originalId(current) !== id) {assert.deepEqual(current, prior, `Unrelated team: ${current.name}`); unchangedTeams++; continue;}
    const {metrics: blocks, ...identity} = current, {metrics: oldBlocks, ...oldIdentity} = prior;
    assert.deepEqual(identity, oldIdentity);
    for (let b = 0; b < blocks.length; b++) {
      const {metrics, ...metadata} = blocks[b], {metrics: oldMetrics, ...oldMetadata} = oldBlocks[b];
      assert.deepEqual(metadata, oldMetadata); assert.equal(metrics.length, oldMetrics.length);
      for (let m = 0; m < metrics.length; m++) {
        const metric = metrics[m], old = oldMetrics[m];
        if (metric.code !== code) {assert.deepEqual(metric, old, `Unrelated DSZh PK metric: ${metric.code}`); continue;}
        changed++;
        assert.equal(old.value, 0); assert.equal(metric.value, 0.5); assert.equal(metric.max_value, 0.5);
        assert.equal(metric.is_applicabble_flg, true); assert.equal(metric.excluded_from_index, false);
        assert.equal(metric.dd_calculation_flg, 1); assert.equal(metric.source.approvalGroup, approval);
        const {value, source, recommendation_items: items, ...rubric} = metric;
        const {value: oldValue, source: oldSource, recommendation_items: oldItems, ...oldRubric} = old;
        assert.deepEqual(rubric, oldRubric, 'Keep weight, applicability, flags and historical values');
        assert.deepEqual(items, oldItems.map(item => ({...item, value: 0.5, gap: 0})));
      }
    }
    const indexed = team => flat(team).filter(metric => isDdIndexMetricForPeriod(metric, team.period));
    assert.deepEqual(indexed(current).map(metric => [metric.code, metric.max_value]), indexed(prior).map(metric => [metric.code, metric.max_value]));
    assert.equal(completeProductPercent(prior), 78); assert.equal(completeProductPercent(current), 80);
    assert.equal(maturityLevelName(completeProductPercent(prior)), 'Зрелые');
    assert.equal(maturityLevelName(completeProductPercent(current)), 'Зрелые');
    const launches = flat(current).find(metric => metric.code === 'attract.campaign_launches');
    assert.equal(launches.max_value, 0); assert.equal(launches.is_applicabble_flg, false);
  }
  assert.equal(changed, 1); assert.equal(unchangedTeams, 75);
  assert.equal(after.filter((team, i) => completeProductPercent(team) !== completeProductPercent(before[i])).length, 1);
  const sum = products => products.reduce((total, product) => total + completeProductPercent(product), 0);
  assert.equal(sum(before), 4901); assert.equal(sum(after), 4903);
  assert.ok(Math.abs(sum(after) / after.length - 64.51315789473684) < 1e-9);
  assert.equal(Math.floor(sum(after) / after.length), 64);
  assert.equal(Math.round(sum(after) / after.length), 65, 'The live mean exercises the B2C floor-versus-round boundary');
  assert.deepEqual(build(overlays, 'II кв. 2026'), report.products);
  assert.deepEqual(build(beforeOverlays, 'II кв. 2026'), report.products);
  assert.deepEqual({report, overlays, args, backlog}, snapshot, 'Neither build mutates its inputs');
});
