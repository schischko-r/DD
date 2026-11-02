import test from 'node:test';
import assert from 'node:assert/strict';
import {salaryBeforeMechanicsConfirmation} from './test-fixtures/salaryMechanicsStage.js';
import {isPostSnapshotExternalAssessment, historicalAssessmentBatch} from './test-fixtures/assessmentBatches.js';
import {readFileSync} from 'node:fs';
// Historical snapshots retain the explicitly separated cohort pipeline.
import {buildDdiCohortProducts as buildDdiPeriodProducts} from './quarterProfiles.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);

test('manual Navigator scores for Chat and DomClick are applied with their existing maxima', () => {
  const source = read('../../public/report-data.json').products;
  const manual = read('../data/knowledge-user-assessments-q3-2026.json');
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
  .filter((key) => !isPostSnapshotExternalAssessment(imports.get(key.trim())))
    .filter((key) => imports.get(key.trim()) !== 'chat-entry-actions-q3-2026.json')
    .map((key) => historicalAssessmentBatch(read(`../data/${imports.get(key.trim())}`)));
  const salary = salaryBeforeMechanicsConfirmation(read('../data/salary-products-q3-2026.json'));
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  const before = buildDdiPeriodProducts(source, manual.period, overlays, salary, reporting, actions);
  const snapshot = JSON.stringify({source, overlays, salary, reporting, actions, manual});
  const after = buildDdiPeriodProducts(source, manual.period, [...overlays, manual], salary, reporting, actions);
  let changes = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], old = before[i];
    assert.equal(current.id, old.id);
    assert.equal(current.indexMaxPoints, old.indexMaxPoints);
    for (const [index, metric] of metrics(current).entries()) {
      const prior = metrics(old)[index];
      if (metric.code === 'general.navigator_reporting_knowledge' && current.name === 'Сделка вторичка') {
        assert.equal(current.unit, 'ДомКлик');
        assert.equal(current.type, 'Продукт');
        assert.equal(metric.value, .25);
        assert.equal(metric.max_value, .5);
        assert.equal(metric.value / metric.max_value, .5);
        assert.equal(metric.source.origin, 'userConfirmedDirectNavigatorAssessment');
        changes++;
        continue;
      }
      if (current.name !== 'Чат' || metric.code !== 'general.navigator_reporting_knowledge') {
        assert.deepEqual(metric, prior); continue;
      }
      assert.equal(current.unit, 'PC');
      assert.equal(current.type, 'Канал');
      assert.equal(prior.value, null);
      assert.equal(metric.value, .5);
      assert.equal(metric.max_value, .5);
      assert.equal(metric.value / metric.max_value, 1);
      assert.equal(metric.source.origin, 'userConfirmedNavigatorManualAssessment');
      assert.equal(metric.previousValue, .25);
      changes++;
    }
  }
  assert.equal(changes, 2);
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', [...overlays, manual], salary, reporting, actions), source);
  assert.equal(JSON.stringify({source, overlays, salary, reporting, actions, manual}), snapshot);
});
