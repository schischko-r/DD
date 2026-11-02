import test from 'node:test';
import assert from 'node:assert/strict';
import {withCurrentAbQuarterWeights} from './test-fixtures/abQuarterWeightStage.js';
import {salaryBeforeMechanicsConfirmation} from './test-fixtures/salaryMechanicsStage.js';
import {isPostSnapshotExternalAssessment, historicalAssessmentBatch} from './test-fixtures/assessmentBatches.js';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Historical snapshots retain the explicitly separated cohort pipeline.
import {buildDdiCohortProducts as buildDdiPeriodProducts} from './quarterProfiles.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);
const code = 'voronka_vhoda_v_kanal.meropriyatiya_po_rabote_s_otkloneniyami';

test('Savins explicit yes restores only the Chat entry actions score with all four source links and unchanged Q2', () => {
  const original = read('../../public/report-data.json').products;
  const before = withCurrentAbQuarterWeights(read('../../../outputs/chat-entry-actions-2026-10-30/before.json'));
  const assessment = read('../data/chat-entry-actions-q3-2026.json');
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
  .filter((key) => !isPostSnapshotExternalAssessment(imports.get(key.trim()))).map((key) => historicalAssessmentBatch(read(`../data/${imports.get(key.trim())}`)));
  const salary = salaryBeforeMechanicsConfirmation(read('../data/salary-products-q3-2026.json'));
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  const after = buildDdiPeriodProducts(original, assessment.period, overlays, salary, reporting, actions);
  let changes = 0;
  for (let i = 0; i < after.length; i++) {
    const product = after[i], old = before[i];
    assert.equal(product.id, old.id);
    assert.equal(product.indexMaxPoints, old.indexMaxPoints);
    for (const [index, metric] of metrics(product).entries()) {
      const prior = metrics(old)[index];
      if (product.name !== 'Чат' || metric.code !== code) {assert.deepEqual(metric, prior); continue;}
      assert.equal(prior.value, null);
      assert.equal(metric.value, 1);
      assert.equal(metric.max_value, 1);
      assert.equal(metric.previousValue, 1);
      assert.equal(metric.previousPeriod, 'II кв. 2026');
      const source = metric.source;
      assert.equal(source.origin, 'userConfirmedChatEntryActions');
      assert.equal(source.respondent, 'Савин Евгений Юрьевич');
      assert.equal(source.questionId, 'entryDeviations');
      assert.equal(source.answer, 'Да');
      assert.equal(source.comment, '');
      assert.deepEqual(source.questionSource, {sheet: 'Каналы Phigital', row: 82});
      assert.equal(source.csvRow, 9);
      const csv = readFileSync(new URL(`../../../${source.file}`, import.meta.url));
      assert.equal(source.sha256, createHash('sha256').update(csv).digest('hex'));
      assert.equal(source.evidenceLinks.length, 4);
      assert.deepEqual(source.evidenceLinks.map((link) => link.url), source.evidence.split('\n'));
      assert.equal(source.evidenceLinks.filter((link) => link.url.includes('confluence')).length, 3);
      assert.equal(source.evidenceLinks.filter((link) => link.url.includes('mark.sber.ru')).length, 1);
      const block = product.metrics.find((entry) => entry.code === 'voronka_vhoda_v_kanal');
      assert.equal(block.referencePeriod, assessment.period);
      assert.deepEqual(block.participant_links, source.evidenceLinks);
      changes++;
    }
  }
  assert.equal(changes, 1);
  assert.deepEqual(buildDdiPeriodProducts(original, 'II кв. 2026', overlays, salary, reporting, actions), original);
});
