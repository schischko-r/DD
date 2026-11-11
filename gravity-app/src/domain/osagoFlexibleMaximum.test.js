import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
import {completeProductPercent, isDdIndexMetricForPeriod, maturityLevelName} from './report.js';

const period = 'III кв. 2026';
const id = '16a909e6-2a89-532d-b1df-1f749aff70c8¦ОСАГО';
const code = 'mehaniki.gibkoe_izmenenie_usloviy_produkta';
const approval = 'osago-flexible-max-2026-11-11';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const report = read('../../public/report-data.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
const args = ['salary-products-q3-2026.json', 'reporting-regularity-missing-q3-2026.json', 'funnel-action-missing-q3-2026.json']
  .map(file => read(`../data/${file}`));
const backlog = read('../../public/backlog-data.json');
const flat = product => product.metrics.flatMap(block => block.metrics);
const originalId = product => String(product.id).replace(/::empty::.*/, '');
const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(report.products, selectedPeriod, facts, ...args, backlog);
const corrections = overlays.find(batch => batch.scope === 'q3-score-correction');
const team = corrections.products.find(team => team.id === id);
const fact = team.metrics[code];
const beforeOverlays = structuredClone(overlays);
delete beforeOverlays.find(batch => batch.scope === 'q3-score-correction').products.find(team => team.id === id).metrics[code];

test('the live OSAGO maximum changes from one to 1.5 while earned points, all other metrics and Q2 stay intact', () => {
  const reportSnapshot = structuredClone(report), overlaysSnapshot = structuredClone(overlays);
  const selected = corrections.products.flatMap(team => Object.entries(team.metrics)
    .filter(([, fact]) => fact.source?.approvalGroup === approval).map(([code, fact]) => ({team, code, fact})));
  assert.equal(selected.length, 1); assert.equal(selected[0].team.id, id); assert.equal(selected[0].code, code);
  assert.equal(team.name, 'ОСАГО'); assert.equal(team.unit, 'УБ'); assert.equal(team.type, 'Продукт');
  assert.equal(fact.rawValue, 0); assert.equal(fact.maxValueOverride, 1.5);
  for (const proof of [fact.source, fact.source.correction]) {
    assert.equal(proof.origin, 'userConfirmedQ3ScoreCorrection'); assert.equal(proof.confirmedBy, 'user');
    assert.equal(proof.period, period); assert.equal(proof.date, '2026-11-11'); assert.equal(proof.approvalGroup, approval);
  }
  assert.equal(fact.source.correction.rawValue, 0); assert.equal(fact.source.correction.maxValueOverride, 1.5);
  const before = build(beforeOverlays), after = build(overlays);
  assert.equal(before.length, 76); assert.equal(after.length, 76);
  let changed = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], old = before[i];
    if (originalId(current) !== id) {assert.deepEqual(current, old, `Unrelated team: ${current.name}`); continue;}
    const {metrics: blocks, indexMaxPoints, ...metadata} = current;
    const {metrics: oldBlocks, indexMaxPoints: oldMax, ...oldMetadata} = old;
    assert.deepEqual(metadata, oldMetadata); assert.equal(indexMaxPoints, oldMax + 0.5);
    assert.equal(indexMaxPoints, 23.75);
    for (let b = 0; b < blocks.length; b++) {
      const {metrics, ...blockMetadata} = blocks[b], {metrics: oldMetrics, ...oldBlockMetadata} = oldBlocks[b];
      assert.deepEqual(blockMetadata, oldBlockMetadata); assert.equal(metrics.length, oldMetrics.length);
      for (let j = 0; j < metrics.length; j++) {
        const metric = metrics[j], prior = oldMetrics[j];
        if (metric.code !== code) {assert.deepEqual(metric, prior, `Unrelated OSAGO metric: ${metric.code}`); continue;}
        changed++;
        assert.equal(metric.value, 0); assert.equal(prior.value, 0);
        assert.equal(metric.max_value, 1.5); assert.equal(prior.max_value, 1);
        assert.equal(metric.source.approvalGroup, approval);
        assert.deepEqual(fact.source.previousAssessment,
          {value: prior.value, maxValue: prior.max_value, rawValue: 0, source: prior.source});
        const {value, max_value, source, recommendation_items: items, ...rubric} = metric;
        const {value: oldValue, max_value: oldMaximum, source: oldSource, recommendation_items: oldItems, ...oldRubric} = prior;
        assert.deepEqual(rubric, oldRubric, 'Applicability, index flags, history and recommendations stay unchanged');
        assert.deepEqual(items, oldItems.map(item => ({...item, value: 0, max_value: 1.5, gap: 1.5})));
      }
    }
    const indexed = product => flat(product).filter(metric => isDdIndexMetricForPeriod(metric, period));
    const sum = (product, field) => indexed(product).reduce((total, metric) => total + metric[field], 0);
    assert.equal(sum(current, 'value'), sum(old, 'value'));
    assert.equal(sum(current, 'max_value'), sum(old, 'max_value') + 0.5);
    assert.equal(completeProductPercent(current), Math.round(sum(old, 'value') / (sum(old, 'max_value') + 0.5) * 100));
    assert.equal(completeProductPercent(old), 81); assert.equal(completeProductPercent(current), 79);
    assert.equal(maturityLevelName(completeProductPercent(current)), 'Зрелые');
    assert.equal(flat(current).find(m => m.code === 'churn.report_completeness').value, 0);
    for (const code of ['general.znanie_produktov_sputnikov', 'general.navigator_reporting_knowledge']) {
      const metric = flat(current).find(m => m.code === code); assert.equal(metric.value, metric.max_value);
    }
    const initiatives = flat(current).find(m => m.code === 'hyp.extra_initiatives');
    assert.equal(initiatives.value, null); assert.equal(initiatives.max_value, 0); assert.equal(initiatives.is_applicabble_flg, false);
  }
  assert.equal(changed, 1);
  const mean = after.reduce((total, team) => total + completeProductPercent(team), 0) / after.length;
  assert.ok(Math.abs(mean - 63.93421052631579) < 1e-9); assert.equal(Math.round(mean), 64);
  assert.deepEqual(build(overlays, 'II кв. 2026'), report.products);
  assert.deepEqual(build(beforeOverlays, 'II кв. 2026'), report.products);
  assert.deepEqual(report, reportSnapshot); assert.deepEqual(overlays, overlaysSnapshot);
});

test('the special maximum cannot leak through another identity, period, metric, scope or unsupported override proof', () => {
  const prior = report.products.find(team => team.id === id);
  const baseline = {period, scope: 'q3-score-correction', products: [{id, name: 'ОСАГО', unit: 'УБ', type: 'Продукт', metrics: {[code]: structuredClone(fact)}}]};
  const maximum = (source, batch = baseline) => flat(buildTeamProfileProducts([source], period, batch)[0]).find(metric => metric.code === code).max_value;
  assert.equal(maximum(prior), 1.5);
  for (const field of ['id', 'name', 'unit', 'type']) {
    const source = {...prior, [field]: `Other ${prior[field]}`}, batch = structuredClone(baseline);
    batch.products[0][field] = source[field];
    assert.equal(maximum(source, batch), 1, `Unsupported source identity: ${field}`);
  }
  for (const [label, mutate] of [
    ['scope', batch => {batch.scope = 'selected-metrics-carry-forward';}],
    ['period', batch => {batch.period = 'II кв. 2026';}],
    ['maximum', batch => {batch.products[0].metrics[code].maxValueOverride = 99;}],
    ['superseded maximum two', batch => {
      batch.products[0].metrics[code].maxValueOverride = 2;
      batch.products[0].metrics[code].source.correction.maxValueOverride = 2;
    }],
    ['earned fraction', batch => {batch.products[0].metrics[code].rawValue = 1;}],
    ...['source', 'correction'].flatMap(level => ['origin', 'confirmedBy', 'period', 'date', 'approvalGroup'].map(field =>
      [`${level}.${field}`, batch => {const proof = batch.products[0].metrics[code].source; (level === 'source' ? proof : proof.correction)[field] = 'other';}])),
    ['nested maximum', batch => {batch.products[0].metrics[code].source.correction.maxValueOverride = 99;}],
    ['nested raw', batch => {batch.products[0].metrics[code].source.correction.rawValue = 1;}],
  ]) {
    const batch = structuredClone(baseline); mutate(batch);
    assert.equal(maximum(prior, batch), 1, label);
  }
  const otherMetric = structuredClone(baseline);
  otherMetric.products[0].metrics = {'mehaniki.cross_sell': structuredClone(fact)};
  assert.equal(maximum(prior, otherMetric), 1);
  for (const max of [0, 0.5, 2, 3]) {
    const source = structuredClone(prior); flat(source).find(metric => metric.code === code).max_value = max;
    assert.equal(maximum(source), max, 'Only the explicitly approved one-to-1.5 change is supported');
  }
  const nonapplicable = structuredClone(prior); flat(nonapplicable).find(metric => metric.code === code).is_applicabble_flg = false;
  assert.equal(maximum(nonapplicable), 1);
  assert.deepEqual(buildTeamProfileProducts([prior], 'II кв. 2026', baseline), [prior]);
});
