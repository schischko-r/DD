import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyGoalsFinalScores, GOALS_FINAL_COUNTERPARTS} from './goalsFinalScores.js';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {isDdIndexMetric, isDdIndexMetricForPeriod} from './report.js';
import {blockActualGrowth} from './teamProfileSelection.js';
import {beforeFinalGoalsTable} from './test-fixtures/beforeFinalGoalsTable.js';
const read = (path) => beforeFinalGoalsTable(JSON.parse(readFileSync(new URL(path, import.meta.url))));
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);
const selected = read('../data/goals-final-scores-q3-2026.json');

test('before newer CBP corrections all 76 profiles take three independent goal levels; only final scores contribute to DDI', () => {
  const original = read('../../public/report-data.json').products;
  const salary = read('../data/salary-products-q3-2026.json');
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`))
    .filter((overlay) => overlay.scope !== 'cbp-user-corrections');
  assert.equal(overlays.filter((overlay) => overlay.scope === 'goals-final-scores').length, 1);
  const previousOverlays = overlays.filter((overlay) => overlay.scope !== 'goals-final-scores');
  const snapshot = JSON.stringify({original, salary, reporting, actions, overlays, selected});
  const before = buildDdiPeriodProducts(original, selected.period, previousOverlays, salary, reporting, actions);
  const after = buildDdiPeriodProducts(original, selected.period, overlays, salary, reporting, actions);
  assert.equal(after.length, 76);
  let finalFacts = 0, independentPo = 0, activated = 0, missing = 0;
  for (let i = 0; i < after.length; i++) {
    const product = after[i], prior = before[i];
    assert.equal(product.id, prior.id);
    const row = selected.products.find((item) => item.name === product.name && item.unit === product.unit);
    assert.ok(row, product.name);
    if (product.name === 'Персональная рекомендация' && product.unit === 'Data') {
      assert.deepEqual(row.final, {
        'goals.monitored': 1,
        'goals.factor_analysis_l1_l2': 0.5,
        'goals.forecast': null,
      });
      assert.deepEqual(row.lulT, {
        'goals.monitored': 1,
        'goals.factor_analysis_l1_l2': 0,
        'goals.forecast': null,
      });
      assert.deepEqual(row.po, {
        'goals.po_monitoring': 1,
        'goals.po_factor_analysis': 0.6,
        'goals.po_forecast': null,
      });
      const goals = product.metrics.find((block) => block.code === 'goals');
      const poForecast = goals.goalsPoLevelMetrics.find((metric) => metric.code === 'goals.po_forecast');
      assert.equal(poForecast.value, null);
      assert.equal(poForecast.max_value, 0);
      assert.equal(poForecast.is_applicabble_flg, false);
      const ltForecast = goals.metrics.find((metric) => metric.code === 'goals.forecast');
      assert.equal(ltForecast.value, null);
      assert.equal(ltForecast.max_value, 0);
      assert.equal(ltForecast.is_applicabble_flg, false);
      const finalForecast = goals.metrics.find((metric) => metric.code === 'goals.po_forecast');
      assert.equal(finalForecast.value, null);
      assert.equal(finalForecast.max_value, 0);
      assert.equal(finalForecast.is_applicabble_flg, false);
    }
    assert.deepEqual(product.metrics.filter((block) => block.code !== 'goals'), prior.metrics.filter((block) => block.code !== 'goals'));
    const block = product.metrics.find((item) => item.code === 'goals');
    assert.deepEqual(block.goalsFinalScores, row.final);
    for (const [baseCode, poCode] of Object.entries(GOALS_FINAL_COUNTERPARTS)) {
      const finalMetric = block.metrics.find((metric) => metric.code === poCode);
      const oldFinal = metrics(prior).find((metric) => metric.code === poCode);
      const lt = block.metrics.find((metric) => metric.code === baseCode);
      const po = block.goalsPoLevelMetrics.find((metric) => metric.code === poCode);
      assert.equal(finalMetric.value, row.final[baseCode]);
      assert.equal(finalMetric.previousValue, lt.previousValue);
      assert.equal(finalMetric.previousMaxValue, lt.previousMaxValue);
      assert.equal(finalMetric.previousPeriod, lt.previousPeriod);
      assert.equal(lt.value, row.lulT[baseCode]);
      if (row.lulT[baseCode] === null) {
        assert.equal(lt.max_value, 0);
        assert.equal(lt.is_applicabble_flg, false);
      }
      assert.equal(po.value, row.po[poCode]);
      assert.equal(po.max_value, row.po[poCode] === null ? 0 : 1);
      assert.equal(po.is_applicabble_flg, row.po[poCode] !== null);
      assert.equal(lt.metric_subgroup, 'Уровень ЛЮ/ЛТ');
      assert.equal(po.metric_subgroup, 'Уровень PO');
      assert.equal(isDdIndexMetric(lt), false);
      assert.equal(isDdIndexMetric(po), false);
      if (row.final[baseCode] !== null) {
        assert.equal(finalMetric.max_value, 1);
        assert.equal(finalMetric.is_applicabble_flg, true);
        assert.equal(isDdIndexMetric(finalMetric), true);
        if (!oldFinal.is_applicabble_flg || oldFinal.max_value === 0) activated++;
      } else {
        assert.equal(finalMetric.max_value, 0);
        assert.equal(finalMetric.is_applicabble_flg, false);
        missing++;
      }
      if (finalMetric.value !== po.value) independentPo++;
      finalFacts++;
    }
    assert.equal(product.indexMaxPoints, metrics(product).filter(isDdIndexMetric).reduce((sum, metric) => sum + metric.max_value, 0));
  }
  assert.equal(finalFacts, 228);
  assert.equal(missing, 8);
  assert.equal(activated, 2);
  assert.ok(independentPo > 0, 'Final and PO levels must not be conflated');
  assert.deepEqual(buildDdiPeriodProducts(original, 'II кв. 2026', [...overlays, selected], salary, reporting, actions), original);
  assert.equal(JSON.stringify({original, salary, reporting, actions, overlays, selected}), snapshot);
  const zls = after.find((product) => product.name === 'ЗЛС' && product.unit === 'УБ');
  const zlsQ2 = original.find((product) => product.name === 'ЗЛС' && product.unit === 'УБ');
  const zlsMax = metrics(zls).filter((metric) => isDdIndexMetricForPeriod(metric, selected.period))
    .reduce((sum, metric) => sum + Number(metric.max_value || 0), 0);
  const zlsGoalUplift = blockActualGrowth(zls.metrics.find((block) => block.code === 'goals'), zlsMax, selected.period);
  assert.ok(zlsQ2, 'ZLS Q2 baseline exists');
  assert.equal(zlsGoalUplift.pointsDelta, 2, 'two final PO goal scores improved from 0 to 1');
  assert.equal(zlsGoalUplift.indexPctDelta, 2 / zlsMax * 100,
    'the PO goals block carries its share of the Q2-to-Q3 DDI change');
});

test('an explicit final zero overrides a positive PO detail; final null preserves NA and never falls back', () => {
  const pairs = Object.entries(GOALS_FINAL_COUNTERPARTS);
  const product = {id: 'x', name: 'X', unit: 'DB', period: selected.period, metrics: [{code: 'goals', metrics: pairs.flatMap(([base, po], i) => [
    {code: base, value: 1, max_value: 1, is_applicabble_flg: true},
    {code: po, value: null, max_value: i ? 0 : 1, is_applicabble_flg: !i, excluded_from_index: !!i, dd_calculation_flg: 1},
  ])}]};
  const row = {name: 'X', unit: 'DB',
    final: Object.fromEntries(pairs.map(([base], i) => [base, [0, null, .5][i]])),
    lulT: Object.fromEntries(pairs.map(([base]) => [base, .5])),
    po: Object.fromEntries(pairs.map(([, po]) => [po, 1]))};
  const config = {...selected, products: [row]};
  const result = applyGoalsFinalScores([product], selected.period, [config])[0];
  assert.deepEqual(pairs.map(([, po]) => metrics(result).find((metric) => metric.code === po).value), [0, null, .5]);
  assert.deepEqual(result.metrics[0].goalsPoLevelMetrics.map((metric) => metric.value), [1, 1, 1]);
  assert.ok(result.metrics[0].goalsPoLevelMetrics.every((metric) => metric.max_value === 1 && metric.is_applicabble_flg === true));
  assert.equal(metrics(result).find((metric) => metric.code === pairs[1][1]).is_applicabble_flg, false);
  assert.equal(metrics(result).find((metric) => metric.code === pairs[2][1]).max_value, 1);
  assert.deepEqual(applyGoalsFinalScores([product], 'II кв. 2026', [config]), [product]);
  assert.throws(() => applyGoalsFinalScores([product], selected.period, [{...config, products: []}]), /identity/);
  const salaryRecord = {...row, name: 'Зарплатный продукт'};
  for (const name of ['Зарплатный продукт #B2B', 'Зарплатный продукт #B2C']) {
    const cohort = applyGoalsFinalScores([{...product, name}], selected.period, [{...config, products: [salaryRecord]}])[0];
    assert.equal(metrics(cohort).find((metric) => metric.code === pairs[0][1]).value, 0);
    assert.equal(metrics(cohort).find((metric) => metric.code === pairs[0][1]).source.combinedSalaryAssessment, true);
  }
});
