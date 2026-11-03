import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {isDdIndexMetric} from './report.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const period = 'III кв. 2026';
const allMetrics = (product) => product.metrics.flatMap((block) => block.metrics);
// Independent transcription of the user's 46 CBP assessments. Goals target the final,
// indexed score, whose PO code differs from the informational LUL/T counterpart.
const expected = {
  'Автокредит': {'goals.po_monitoring': .5, 'goals.po_factor_analysis': 0, 'goals.po_forecast': .5,
    'alerts.business_metrics': 0, 'mehaniki.vozvrat_klientov': null, 'mehaniki.doprodazhi_up_sell': 0,
    'hyp.discovery_40_backlog': 0, 'hyp.datadriven_rating_7_5': 0},
  'Вклады+НС': {'goals.po_factor_analysis': 0, 'churn.funnel_analysis': .25, 'cx.score': .5, 'general.navigator_reporting_knowledge': 1},
  'Конверсия': {'goals.po_factor_analysis': .5, 'hyp.datadriven_rating_7_5': .5},
  'Монеты': {'goals.po_factor_analysis': .5, 'churn.funnel_analysis': 0,
    'mehaniki.vozvrat_klientov': .5, 'mehaniki.cross_sell.during': 1},
  'Образовательный кредит': {'goals.po_factor_analysis': 0, 'mehaniki.vozvrat_klientov': null},
  'ОМС': {'goals.po_factor_analysis': .5, 'attract.report_completeness': .5, 'attract.funnel_analysis': .5,
    'churn.report_completeness': .5, 'churn.funnel_analysis': .5, 'hyp.datadriven_rating_7_5': 0},
  'Потребительский кредит': {'goals.po_factor_analysis': .5, 'churn.funnel_analysis': .5,
    'mehaniki.vozvrat_klientov': null, 'hyp.discovery_40_backlog': .5},
  'Сейфы': {'attract.report_completeness': 1, 'churn.nastroena_otchetnostь': .5, 'churn.report_completeness': 0,
    'mehaniki.vozvrat_klientov': .5, 'mehaniki.uderzhanie_klientov': .5, 'hyp.datadriven_rating_7_5': 0},
  'Слитки': {'general.navigator_reporting_knowledge': 0, 'goals.po_factor_analysis': .5, 'churn.funnel_analysis': 0},
  'BNPL': {'goals.po_factor_analysis': 0, 'attract.campaign_launches': 1,
    'churn.report_completeness': .5, 'mehaniki.cross_sell.during': 1},
  'POS-кредиты': {'general.navigator_reporting_knowledge': .5, 'goals.po_factor_analysis': 0, 'churn.report_completeness': 0},
};
const finalGoalCodes = {'goals.po_monitoring': 'goals.monitored',
  'goals.po_factor_analysis': 'goals.factor_analysis_l1_l2', 'goals.po_forecast': 'goals.forecast'};

test('all 46 latest CBP assessments win in the active Q3 pipeline while Q2 and unrelated assessments stay intact', () => {
  assert.equal(Object.keys(expected).length, 11);
  assert.equal(Object.values(expected).reduce((sum, facts) => sum + Object.keys(facts).length, 0), 46);
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((match) => [match[1], match[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`));
  const corrections = overlays.filter((batch) => batch.scope === 'cbp-user-corrections');
  assert.equal(corrections.length, 1, 'latest source is connected to App');
  const source = read('../../public/report-data.json').products;
  const snapshot = JSON.stringify(source);
  const salary = read('../data/salary-products-q3-2026.json');
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  const build = (batches, selectedPeriod = period) => buildDdiPeriodProducts(source, selectedPeriod, batches, salary, reporting, actions);
  const before = build(overlays.filter((batch) => batch.scope !== 'cbp-user-corrections'));
  const current = build(overlays);
  assert.equal(current.length, before.length);
  let checked = 0;
  for (const product of current) {
    const prior = before.find((item) => item.id === product.id);
    assert.ok(prior);
    const facts = product.unit === 'CBP' && product.type === 'Продукт' ? expected[product.name] : null;
    if (!facts) {assert.deepEqual(product, prior, `${product.name}: unrelated team`);continue;}
    const {metrics: currentEntries, indexMaxPoints: currentMaximum, ...currentIdentity} = product;
    const {metrics: priorEntries, indexMaxPoints: priorMaximum, ...priorIdentity} = prior;
    assert.deepEqual(currentIdentity, priorIdentity, 'canonical identity and product metadata preserved');
    const previousMetrics = new Map(allMetrics(prior).map((metric) => [metric.code, metric]));
    for (const metric of allMetrics(product)) {
      const previous = previousMetrics.get(metric.code);
      const code = metric.code === 'mehaniki.cross_sell' && Object.hasOwn(facts, 'mehaniki.cross_sell.during')
        ? 'mehaniki.cross_sell.during' : metric.code;
      if (!Object.hasOwn(facts, code)) {assert.deepEqual(metric, previous, `${product.name}: ${metric.code} unchanged`);continue;}
      checked++;
      const raw = facts[code];
      if (raw === null) {
        assert.equal(metric.value, null);
        assert.equal(metric.max_value, 0);
        assert.equal(metric.is_applicabble_flg, false);
        assert.equal(metric.excluded_from_index, true);
        assert.equal(isDdIndexMetric(metric), false);
      } else if (code === 'mehaniki.cross_sell.during') {
        assert.equal(metric.crossSellComponents.during.value, metric.max_value / 2);
        assert.deepEqual(metric.crossSellComponents.after, previous.crossSellComponents.after, 'after purchase preserved');
        assert.equal(metric.value, Math.min(metric.max_value, metric.max_value / 2
          + (metric.crossSellComponents.after.applicable === false ? 0 : metric.crossSellComponents.after.value)));
        assert.equal(metric.max_value, previous.max_value);
      } else {
        assert.equal(metric.value, raw * metric.max_value, `${product.name}: ${code}`);
        assert.equal(metric.max_value, previous.max_value, 'rubric maximum preserved');
        assert.equal(metric.is_applicabble_flg, previous.is_applicabble_flg);
        if (finalGoalCodes[code]) {
          assert.equal(metric.source.level, 'final');
          assert.equal(metric.dd_calculation_flg, 1);
          assert.equal(metric.excluded_from_index, false);
          const goals = product.metrics.find((block) => block.code === 'goals');
          assert.equal(goals.goalsFinalScores[finalGoalCodes[code]], raw);
        }
      }
      for (const item of metric.recommendation_items || []) {
        assert.equal(item.value, metric.value);
        assert.equal(item.max_value, metric.max_value);
        if (raw !== null) assert.equal(item.gap, metric.max_value - metric.value);
      }
    }
    const goals = product.metrics.find((block) => block.code === 'goals');
    const oldGoals = prior.metrics.find((block) => block.code === 'goals');
    assert.deepEqual(goals.goalsPoLevelMetrics, oldGoals.goalsPoLevelMetrics, 'PO detail scores remain informational and unchanged');
    const expectedGoalScores = {...oldGoals.goalsFinalScores};
    for (const [code, baseCode] of Object.entries(finalGoalCodes)) {
      if (Object.hasOwn(facts, code)) expectedGoalScores[baseCode] = facts[code];
    }
    assert.deepEqual(goals.goalsFinalScores, expectedGoalScores, 'only the selected final goal metadata changes');
    for (const block of product.metrics) {
      const oldBlock = prior.metrics.find((entry) => entry.code === block.code);
      const {metrics: entries, goalsFinalScores: scores, ...metadata} = block;
      const {metrics: oldEntries, goalsFinalScores: oldScores, ...oldMetadata} = oldBlock;
      assert.deepEqual(metadata, oldMetadata, `${product.name}: ${block.code} metadata preserved`);
    }
    assert.equal(product.indexMaxPoints, allMetrics(product).filter(isDdIndexMetric).reduce((sum, metric) => sum + metric.max_value, 0));
    const removedMaximum = Object.entries(facts).filter(([, value]) => value === null)
      .reduce((sum, [code]) => sum + (isDdIndexMetric(previousMetrics.get(code)) ? previousMetrics.get(code).max_value : 0), 0);
    assert.ok(Math.abs(product.indexMaxPoints - (prior.indexMaxPoints - removedMaximum)) < 1e-9, 'only the three non-relevant metrics change the denominator');
  }
  assert.equal(checked, 46);
  assert.deepEqual(build(overlays, 'II кв. 2026'), build(overlays.filter((batch) => batch.scope !== 'cbp-user-corrections'), 'II кв. 2026'));
  assert.equal(JSON.stringify(source), snapshot);
});
