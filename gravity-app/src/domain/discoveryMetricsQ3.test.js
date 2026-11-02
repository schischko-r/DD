import test from 'node:test';
import assert from 'node:assert/strict';
import {salaryBeforeMechanicsConfirmation} from './test-fixtures/salaryMechanicsStage.js';
import {isPostSnapshotExternalAssessment, historicalAssessmentBatch} from './test-fixtures/assessmentBatches.js';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
import {excludeRemovedTeams} from './report.js';
// Historical snapshots retain the explicitly separated cohort pipeline.
import {buildDdiCohortProducts as buildDdiPeriodProducts} from './quarterProfiles.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = excludeRemovedTeams(read('../../public/report-data.json')).products;
const manual = read('../data/discovery-metrics-q3-2026.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlayNames = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',');
const currentOverlays = overlayNames
  .map((key) => historicalAssessmentBatch(read(`../data/${imports.get(key.trim())}`)));
const overlays = overlayNames
  .filter((key) => !isPostSnapshotExternalAssessment(imports.get(key.trim())))
  .filter((key) => !['funnel-additional-user-assessments-q3-2026.json', 'knowledge-user-assessments-q3-2026.json', 'chat-entry-actions-q3-2026.json', 'q3-score-corrections-2026.json'].includes(imports.get(key.trim())))
  .map((key) => historicalAssessmentBatch(read(`../data/${imports.get(key.trim())}`)));
const metrics = (p) => p.metrics.flatMap((b) => b.metrics);
const code = 'hyp.discovery_40_backlog';

test('Discovery combines explicit answers and authorized absent-answer decomposition without changing other scores or Q2', () => {
  const snapshot = JSON.stringify({source, overlays});
  const before = buildTeamProfileProducts(source, manual.period, overlays.filter((o) => o.scope !== manual.scope));
  const after = buildTeamProfileProducts(source, manual.period, overlays);
  let changed = 0, missing = 0;
  const counts = {0: 0, 0.25: 0, 0.5: 0, 1: 0};
  for (let i = 0; i < after.length; i++) {
    const current = after[i], prior = before[i];
    const fact = manual.products.find((p) => p.id === current.id.replace(/::empty::.*/, ''))?.metrics[code];
    assert.equal(current.indexMaxPoints, prior.indexMaxPoints);
    for (const metric of metrics(current)) {
      const old = metrics(prior).find((m) => m.code === metric.code);
      if (metric.code !== code || !fact) {assert.deepEqual(metric, old); continue;}
      changed++;
      counts[fact.rawValue]++;
      assert.equal(old.value, null);
      assert.equal(metric.value, fact.rawValue * metric.max_value);
      assert.equal(metric.max_value, old.max_value);
      assert.equal(metric.is_applicabble_flg, old.is_applicabble_flg);
      if (metric.source.origin === 'userConfirmedDiscoveryDecompositionOverride') {
        assert.ok(['Пакет услуг СберПремьер', 'МВС'].includes(current.name));
        assert.equal(fact.rawValue, .5);
        assert.equal(metric.source.createdCount, 212);
        assert.equal(metric.source.discoveryCount, 84);
        continue;
      }
      if (metric.source.origin === 'userConfirmedDiscoveryDecompositionAssessment') {
        const evidence = metric.source;
        assert.equal(evidence.explicitAnswerPresent, false);
        assert.ok(evidence.surveyResponses.every((r) => r.answer === null || r.answer === undefined || r.answer === ''));
        assert.ok(evidence.memberTeams.includes(current.name));
        assert.equal(evidence.sharedAssessment, evidence.memberTeams.length > 1);
        assert.equal(evidence.quarterKey, '2026-Q3');
        assert.ok(evidence.createdCount > 0);
        const expected = evidence.discoveryCount * 100 >= evidence.createdCount * 40 ? 1
          : evidence.discoveryCount * 100 >= evidence.createdCount * 20 ? 0.5 : 0;
        assert.equal(fact.rawValue, expected);
        continue;
      }
      if (metric.source.origin === 'userConfirmedDiscoveryManualAssessment') {
        assert.ok(['Сделка ИЖС', 'Сделка вторичка', 'Сделка с Первичным жильём', 'Много денег (НКПЗН)', 'ОМС', 'Слитки', 'Пакет услуг СберПервый', 'Единый личный кабинет (ЕЛК)'].includes(current.name));
        assert.equal(fact.rawValue, current.name === 'Пакет услуг СберПервый' ? 0.5 : 1);
        assert.equal(metric.source.confirmedBy, 'user');
        continue;
      }
      assert.equal(metric.source.origin, 'userConfirmedDiscoveryAssessment');
      assert.ok(metric.source.responses.every((r) => r.rawValue === fact.rawValue));
      if (fact.rawValue === 0) {
        assert.ok(metric.source.responses.every((r) => ['Нет аналитиков', 'Затрудняюсь ответить', 'Меньше 20%'].includes(r.answer)));
      } else if (fact.rawValue === 0.25) {
        assert.ok(metric.source.responses.every((r) => ['От 40 до 79%', 'Больше 80%'].includes(r.answer)));
        assert.ok(metric.source.responses.every((r) => !r.backlogLink));
        assert.equal(metric.source.linkMissingOverride.to, 0.25);
      } else {
        assert.ok(metric.source.responses.every((r) => ['От 20 до 39%', 'От 40 до 79%', 'Больше 80%'].includes(r.answer)));
        assert.ok(metric.source.responses.every((r) => fact.rawValue === 1
          ? ['Собственный бэклог в Jira/SberTrack', 'Задачи ведет Штаб в Jira/SberTrack'].includes(r.backlogType)
          : r.answer === 'От 20 до 39%' || r.backlogType === 'Бэклог ведется вне Jira/SberTrack'));
      }
      assert.ok(metric.source.responses.every((r) => !/чикин/i.test(r.respondent)));
    }
    if (metrics(current).find((m) => m.code === code)?.value === null) missing++;
  }
  assert.equal(changed, 76);
  assert.deepEqual(counts, {0: 23, 0.25: 10, 0.5: 17, 1: 26});
  assert.deepEqual(manual.counts, {teams: manual.products.length, facts: changed, zeros: counts[0],
    halves: counts[0.5], ones: counts[1], pendingTeams: manual.pending.length, quarters: counts[0.25]});
  assert.equal(missing, 6);
  assert.equal(manual.products.length, 76);
  assert.equal(manual.excludedRespondents.length, 2);
  assert.deepEqual(buildTeamProfileProducts(source, 'II кв. 2026', overlays), source);
  assert.equal(JSON.stringify({source, overlays}), snapshot);
});

test('all below-20 answers score zero, while every 20–39 answer scores half regardless of backlog location', () => {
  const deposit = manual.products.find((p) => p.name === 'Вклады+НС')?.metrics[code];
  assert.equal(deposit.rawValue, 0);
  assert.ok(deposit.source.responses.every((r) => r.answer === 'Меньше 20%'
    && r.backlogType === 'Бэклог ведется вне Jira/SberTrack'));
  for (const name of ['Интернет-Эквайринг', 'SberPay Ecom', 'ПДС']) {
    assert.equal(manual.products.find((p) => p.name === name).metrics[code].rawValue, 0);
  }
  const sberId = manual.products.find((p) => p.name === 'SberID').metrics[code];
  assert.equal(sberId.rawValue, 0.5, 'Explicit survey answer takes priority over the 7.4% decomposition');
  assert.ok(sberId.source.responses.every((r) => r.answer === 'От 20 до 39%'));
  assert.equal(manual.products.filter((p) => p.metrics[code].source.responses?.some((r) => r.answer === 'От 20 до 39%')).length, 11);
  assert.equal(manual.salarySplitExclusions.length, 1);
  assert.equal(manual.salarySplitExclusions[0].rawValue, 0.5);
});

test('only the two explicitly confirmed DCREP answers receive full Discovery credit without inventing a backlog link', () => {
  for (const name of ['СБОЛ', 'СберKids']) {
    const fact = manual.products.find((product) => product.name === name).metrics[code];
    assert.equal(fact.rawValue, 1);
    assert.equal(Object.hasOwn(fact.source, 'linkMissingOverride'), false);
    assert.equal(fact.source.backlogContext, 'пространство Ани Пашковской, DCREP');
    assert.equal(fact.source.userDirectiveOverride.from, .25);
    assert.equal(fact.source.userDirectiveOverride.to, 1);
    assert.equal(fact.source.userDirectiveOverride.confirmedBy, 'user');
    assert.match(fact.source.userDirectiveOverride.reason, /несмотря на отсутствие ссылки/);
    assert.ok(fact.source.responses.every((response) => response.answer === 'От 40 до 79%'
      && response.backlogLink === null && response.rawValue === 1));
  }
  const control = manual.products.find((product) => product.name === 'PB').metrics[code];
  assert.equal(control.rawValue, .5, 'PB has its own explicit user score');
  assert.equal(control.source.userOverride.confirmedBy, 'user');
});

test('explicit user scores resolve OМС and Слитки conflicts while retaining original responses', () => {
  assert.deepEqual(manual.pending, []);
  assert.deepEqual(manual.resolvedConflicts.map((r) => r.name).sort(), ['ОМС', 'Слитки']);
  for (const name of ['ОМС', 'Слитки']) {
    const fact = manual.products.find((p) => p.name === name).metrics[code];
    assert.equal(fact.rawValue, 1);
    assert.equal(fact.source.origin, 'userConfirmedDiscoveryManualAssessment');
    assert.deepEqual(fact.source.resolvedConflicts[0].rawValues, [0.5, 1]);
    assert.equal(fact.source.resolvedConflicts[0].resolution.confirmedBy, 'user');
  }
  const pb = manual.products.find((p) => p.name === 'PB').metrics[code];
  assert.equal(pb.rawValue, 0.5);
  assert.equal(pb.source.userOverride.rawValue, 0.5);
  assert.equal(pb.source.responses[0].priorCalculatedValue, 0.25);
  assert.ok(pb.source.responses.some((r) => r.backlogComment.includes('sbertrack.sberbank.ru')));
  const sbol = manual.products.find((p) => p.name === 'СБОЛ').metrics[code];
  assert.equal(sbol.rawValue, 1);
  assert.equal(sbol.source.responses[0].backlogType, 'Задачи ведет Штаб в Jira/SberTrack');
});

test('only Discovery is permitted, with exact identity and no maximum override', () => {
  const team = source.find((p) => p.name === 'БПИФ');
  const fake = {period: manual.period, scope: manual.scope, metricMaxOverrides: {[code]: 999},
    products: [{...team, metrics: {[code]: {rawValue: 0}, 'hyp.ab_tests': {rawValue: 1}, 'goals.monitored': {rawValue: 1}}}]};
  const current = buildTeamProfileProducts([team], manual.period, fake)[0];
  assert.equal(metrics(current).find((m) => m.code === code).value, 0);
  assert.equal(metrics(current).find((m) => m.code === code).max_value, 1);
  assert.equal(metrics(current).find((m) => m.code === 'hyp.ab_tests').value, null);
  assert.equal(metrics(current).find((m) => m.code === 'goals.monitored').value, null);
  fake.products[0].metrics[code].rawValue = 0.5;
  assert.equal(metrics(buildTeamProfileProducts([team], manual.period, fake)[0]).find((m) => m.code === code).value, 0.5);
  fake.products[0].unit = 'wrong unit';
  assert.deepEqual(buildTeamProfileProducts([team], manual.period, fake), buildTeamProfileProducts([team], manual.period));
});

test('final Q3 Discovery assessment leaves every other metric unchanged and preserves Q2', () => {
  const original = read('../../public/report-data.json').products;
  const salary = salaryBeforeMechanicsConfirmation(read('../data/salary-products-q3-2026.json'));
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  // Compare the current App composition before and after the Discovery overlay. This
  // keeps unrelated newer assessments in both sides instead of relying on stale snapshots.
  const baseline = buildDdiPeriodProducts(original, manual.period, currentOverlays.filter((overlay) => overlay.scope !== manual.scope), salary, reporting, actions);
  const after = buildDdiPeriodProducts(original, manual.period, currentOverlays, salary, reporting, actions);
  const snapshot = JSON.stringify({baseline, original, salary, reporting, actions, currentOverlays});
  let missing = 0;
  for (let i = 0; i < after.length; i++) {
    const prior = baseline[i], product = after[i];
    assert.equal(product.id, prior.id);
    assert.equal(product.indexMaxPoints, prior.indexMaxPoints);
    for (const [index, metric] of metrics(product).entries()) {
      const old = metrics(prior)[index];
      if (metric.code !== code) {
        if (metric.source?.origin === 'salaryPreConfirmationFixture') {
          assert.equal(metric.value, old.value);
          assert.equal(metric.max_value, old.max_value);
          assert.equal(metric.is_applicabble_flg, old.is_applicabble_flg);
        } else assert.deepEqual(metric, old);
        continue;
      }
      assert.equal(metric.max_value, old.max_value);
      if (metric.value === null) missing++;
      else assert.ok(Number.isFinite(metric.value) && metric.value >= 0 && metric.value <= metric.max_value);
    }
  }
  assert.equal(missing, 0);
  for (const name of ['СБОЛ', 'СберKids']) {
    const metric = metrics(after.find((p) => p.name === name)).find((m) => m.code === code);
    assert.equal(metric.value / metric.max_value, 1);
  }
  assert.deepEqual(buildDdiPeriodProducts(original, 'II кв. 2026', currentOverlays, salary, reporting, actions), original);
  assert.equal(JSON.stringify({baseline, original, salary, reporting, actions, currentOverlays}), snapshot);
});

test('latest IJS correction sets final Q3 Discovery to one and changes no other metric', async () => {
  const {buildDdiPeriodProducts: buildFinal} = await import('./quarterProfiles.js');
  const all = overlayNames.map(key => read(`../data/${imports.get(key.trim())}`));
  const prior = structuredClone(all);
  const fact = prior.find(item => item.scope === manual.scope).products.find(p => p.name === 'Сделка ИЖС').metrics[code];
  fact.rawValue = .5;
  const original = read('../../public/report-data.json').products;
  const build = (facts, period = manual.period) => buildFinal(original, period, facts,
    read('../data/salary-products-q3-2026.json'), read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json'));
  const before = build(prior), after = build(all);
  let changed = 0;
  for (let i = 0; i < after.length; i++) {
    const p = after[i], old = before[i];
    assert.equal(p.indexMaxPoints, old.indexMaxPoints);
    for (const m of metrics(p)) {
      const oldMetric = metrics(old).find(entry => entry.code === m.code);
      if (p.name === 'Сделка ИЖС' && p.unit === 'ДомКлик' && m.code === code) {
        changed++;
        assert.equal(oldMetric.value, .5);
        assert.equal(m.value, 1);
        assert.equal(m.max_value, oldMetric.max_value);
        assert.equal(m.is_applicabble_flg, oldMetric.is_applicabble_flg);
        assert.equal(m.source.previousRawValue, .5);
        assert.equal(m.source.confirmedBy, 'user');
      } else assert.deepEqual(m, oldMetric, `${p.name}/${m.code}`);
    }
  }
  assert.equal(changed, 1);
  assert.deepEqual(build(all, 'II кв. 2026'), original);
});
