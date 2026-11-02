import test from 'node:test';
import assert from 'node:assert/strict';
import {isPostSnapshotExternalAssessment} from './test-fixtures/assessmentBatches.js';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts, metricActualGrowth} from './teamProfileSelection.js';
import {excludeRemovedTeams} from './report.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = excludeRemovedTeams(read('../../public/report-data.json')).products;
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => imports.get(key.trim()))
  .filter((file) => !isPostSnapshotExternalAssessment(file))
  .map((file) => read(`../data/${file}`))
  // This regression isolates the original assessment batch; later explicit additions have their own test.
  .filter((overlay) => !['userConfirmedAdditionalFunnelAssessment', 'userConfirmedChatEntryActions', 'userMaximumSurveyAssessment'].includes(overlay.source?.origin)
    && overlay.scope !== 'funnel-link-quality-assessment' && overlay.scope !== 'q3-score-correction');
const manual = read('../data/funnel-user-assessments-q3-2026.json');
const metrics = (p) => p.metrics.flatMap((b) => b.metrics);
const skipped = ['Зарплатный продукт', 'ОМС', 'Слитки'];

test('explicit Q3 funnel scores override earlier facts using existing weights, leaving Q2 and all other metrics intact', () => {
  const snapshot = JSON.stringify({source, overlays});
  const before = buildTeamProfileProducts(source, manual.period, overlays.filter((o) => o.scope !== manual.scope));
  const after = buildTeamProfileProducts(source, manual.period, overlays);
  const pcFinal = overlays.find((o) => o.scope === 'pc-final-score-assessment');
  let facts = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], old = before[i];
    const record = manual.products.find((p) => p.id === current.id.replace(/::empty::.*/, ''));
    const activated = Object.entries(record?.metrics || {}).filter(([, fact]) => fact.applicabilityOverride);
    assert.equal(current.indexMaxPoints, old.indexMaxPoints + activated.length * 0.5);
    if (!record) {assert.deepEqual(current, old); continue;}
    assert.ok(!skipped.includes(current.name));
    assert.equal(record.unit, current.unit);
    assert.equal(record.type, current.type);
    for (const m of metrics(current)) {
      const prior = metrics(old).find((p) => p.code === m.code);
      const fact = record.metrics[m.code];
      if (!fact) {assert.deepEqual(m, prior); continue;}
      facts++;
      const pcRow = pcFinal?.products.find((team) => team.id === record.id && team.name === record.name && team.unit === record.unit);
      if (pcRow?.metrics?.[m.code]) {
        assert.equal(m.value / m.max_value, pcRow.metrics[m.code].rawValue, `${current.name} / ${m.code}: PC final score`);
        assert.equal(m.source.origin, 'userConfirmedPCFinalScore20261102');
        continue;
      }
      assert.equal(m.value, fact.rawValue * m.max_value, `${current.name} / ${m.code}`);
      if (fact.applicabilityOverride) {
        assert.equal(prior.is_applicabble_flg, false);
        assert.equal(m.max_value, 0.5);
        assert.equal(m.is_applicabble_flg, true);
        assert.equal(m.previousValue, undefined);
        assert.equal(metricActualGrowth(m, current.indexMaxPoints, manual.period), null);
      } else {
        assert.equal(m.max_value, prior.max_value);
        assert.equal(m.is_applicabble_flg, prior.is_applicabble_flg);
      }
      assert.equal(m.source.origin, 'userConfirmedFunnelAssessment');
      const baseline = source.find((p) => p.id === record.id);
      if (!fact.applicabilityOverride) assert.equal(m.previousValue, metrics(baseline).find((p) => p.code === m.code).value);
    }
  }
  assert.equal(facts, manual.products.reduce((sum, p) => sum + Object.keys(p.metrics).length, 0));
  assert.equal(facts, 352);
  assert.equal(manual.products.length, 73);
  for (const name of skipped) {
    assert.equal(manual.products.some((p) => p.name === name), false);
    assert.deepEqual(after.find((p) => p.name === name), before.find((p) => p.name === name));
  }
  assert.deepEqual(buildTeamProfileProducts(source, 'II кв. 2026', overlays), source);
  assert.equal(JSON.stringify({source, overlays}), snapshot);
});

test('every source instruction is accounted for and all three excluded teams remain excluded', () => {
  assert.equal(manual.sourceRows.length, 386);
  assert.equal(manual.excludedRows.length, 34);
  assert.deepEqual(manual.pending, []);
  const applied = manual.sourceRows.filter((row) => row.status === 'applied');
  assert.equal(applied.length, 352);
  for (const row of manual.sourceRows) {
    assert.ok(row.question.length > 0);
    if (skipped.includes(row.product)) {
      assert.notEqual(row.status, 'applied');
      continue;
    }
    assert.equal(row.status, 'applied');
    const name = manual.source.aliases[row.product] || row.product;
    const product = manual.products.find((p) => p.name === name);
    assert.ok(product, row.product);
    const fact = product.metrics[row.metricCode];
    assert.equal(fact.rawValue, row.rawValue);
    assert.ok(fact.source.sourceRows.includes(row.row));
  }
});

test('normalized fractions use the correct funnels, including nonstandard reporting weights and channel aliases', () => {
  const products = buildTeamProfileProducts(source, manual.period, overlays);
  const get = (name, code) => metrics(products.find((p) => p.name === name)).find((m) => m.code === code);
  for (const [name, code, raw] of [
    ['Автокредит', 'churn.funnel_analysis', 0.5],
    ['Автокредит', 'churn.nastroena_otchetnostь', 0],
    ['Автокредит', 'attract.report_completeness', 0.5],
    ['SberPay Вжух', 'attract.report_completeness', 1],
    ['Кредитные карты', 'attract.report_completeness', 1],
    ['Дети', 'churn.report_completeness', 0.5],
    ['СберKids', 'voronka_onbordinga.nastroena_otchetnostь', 0.5],
    ['СберИнвестор', 'voronka_onbordinga.nastroena_otchetnostь', 1],
    ['СберИнвестор', 'attract.nastroena_otchetnostь', 0.5],
    ['Уведомления', 'voronka_onbordinga.polnota_otcheta', 1],
    ['Уведомления', 'attract.report_completeness', 1],
    ['Колл-центр', 'voronka_vhoda_v_kanal.polnota_otcheta', 0.5],
    ['Телемаркетинг', 'voronka_prodazh.nastroena_otchetnostь', 1],
    ['Чат', 'voronka_vhoda_v_kanal.nastroena_otchetnostь', 1],
    ['Почта, Диск, Календарь', 'attract.report_completeness', 1],
    ['Почта, Диск, Календарь', 'attract.provedenie_kompleksnogo_analiza_voronki_ispolьzovaniya', 1],
    ['Единый личный кабинет (ЕЛК)', 'voronka_ispolьzovaniya.polnota_otcheta', 0.5],
    ['SberID', 'voronka_ispolьzovaniya.polnota_otcheta', 0.5],
    ['Персональная рекомендация', 'analiz_effektivnostь.nastroena_otchetnostь', 0.5],
    ['Трансграничные переводы', 'attract.report_completeness', 0.5],
    ['Трансграничный эквайринг', 'churn.nastroena_otchetnostь', 0],
  ]) assert.equal(get(name, code).value / get(name, code).max_value, raw, `${name} / ${code}`);
  assert.equal(get('Персональная рекомендация', 'analiz_effektivnostь.nastroena_otchetnostь').value, 2);
  const current = products.find((p) => p.name === 'Автокредит');
  const m = get('Автокредит', 'attract.nastroena_otchetnostь');
  const growth = metricActualGrowth(m, current.indexMaxPoints, manual.period);
  if (m.value > m.previousValue) {
    assert.equal(growth.pointsDelta, m.value - m.previousValue);
    assert.equal(growth.indexPctDelta, (m.value - m.previousValue) / current.indexMaxPoints * 100);
  } else assert.equal(growth, null);
});

test('single-system Clickstream evidence caps completeness at 0.25 points', () => {
  const linkQuality = read('../data/funnel-link-quality-assessment-q3-2026.json');
  const before = buildTeamProfileProducts(source, linkQuality.period, overlays);
  const after = buildTeamProfileProducts(source, linkQuality.period, [...overlays, linkQuality]);
  const get = (products) => metrics(products.find((p) => p.name === 'БПИФ'))
    .find((m) => m.code === 'attract.report_completeness');
  const prior = get(before), current = get(after);
  assert.equal(prior.value, 0.5);
  assert.equal(current.value, 0.25);
  assert.equal(current.max_value, 0.5);
  assert.equal(current.source.origin, 'userConfirmedFunnelLinkQualityAssessment');
  assert.deepEqual(linkQuality.products.map((p) => [p.name, Object.keys(p.metrics)]), [
    ['БПИФ', ['attract.report_completeness']],
  ]);
});

test('the funnel scope rejects unrelated codes and identity mismatches; explicit zeros supersede carry-forward', () => {
  const team = source.find((p) => p.name === 'Автокредит');
  const code = 'churn.nastroena_otchetnostь';
  const fake = {period: manual.period, scope: manual.scope, products: [{...team, metrics: {
    [code]: {rawValue: 0}, 'hyp.discovery_40_backlog': {rawValue: 1}, 'goals.monitored': {rawValue: 0.5},
  }}]};
  const carry = {period: manual.period, scope: 'funnel-reporting-carry-forward', products: [{...team,
    metrics: {[code]: {rawValue: 1}}}]};
  const result = buildTeamProfileProducts([team], manual.period, [carry, fake]);
  assert.equal(metrics(result[0]).find((m) => m.code === code).value, 0);
  assert.equal(metrics(result[0]).find((m) => m.code === 'hyp.discovery_40_backlog').value, null);
  assert.equal(metrics(result[0]).find((m) => m.code === 'goals.monitored').value, null);
  fake.products[0].unit = 'wrong unit';
  assert.deepEqual(buildTeamProfileProducts([team], manual.period, fake), buildTeamProfileProducts([team], manual.period));
  assert.deepEqual(buildTeamProfileProducts([team], 'II кв. 2026', fake), [team]);
  const campaign=source.find(p=>p.name==='Персональная рекомендация');
  const action='analiz_effektivnostь.meropriyatiya_po_rabote_s_otkloneniyami';
  const campaignFact={period:manual.period,scope:manual.scope,products:[{id:campaign.id,name:campaign.name,unit:campaign.unit,type:campaign.type,metrics:{[action]:{rawValue:1}}}]};
  const campaignMetric=overlay=>metrics(buildTeamProfileProducts([campaign],manual.period,overlay)[0]).find(m=>m.code===action);
  assert.equal(campaignMetric(campaignFact).value,campaignMetric(campaignFact).max_value);
  assert.equal(campaignMetric({...campaignFact,scope:'key-metrics-assessment'}).value,null);
  assert.deepEqual(buildTeamProfileProducts([campaign],'II кв. 2026',campaignFact),[campaign]);
});


test('element-count fractions require exact valid provenance and stay inside completeness and its scope', () => {
  const codes = ['attract.report_completeness', 'churn.report_completeness', 'churn.funnel_analysis'];
  const team = {id: 'ratio', name: 'Полнота', unit: 'DB', type: 'Продукт', period: 'II кв. 2026',
    metrics: [{code: 'churn', metrics: codes.map((code) => ({code, value: 0, max_value: 0.5, is_applicabble_flg: true}))}]};
  const run = (code, rawValue, ratio, scope = manual.scope) => metrics(buildTeamProfileProducts([team], manual.period, {
    period: manual.period, scope, products: [{...team, metrics: {[code]: {rawValue, source: {completenessRatio: ratio}}}}],
  })[0]).find((metric) => metric.code === code);
  const snapshot = JSON.stringify(team);
  for (const code of codes.slice(0, 2)) {
    const m = run(code, 4 / 7, {selected: 4, available: 7});
    assert.equal(m.value, 0.5 * 4 / 7); assert.equal(m.max_value, 0.5);
    assert.deepEqual(m.source.completenessRatio, {selected: 4, available: 7});
    for (const ratio of [{selected: 3, available: 7}, {selected: 4, available: 0}, {selected: 8, available: 7},
      {selected: -1, available: 7}, {selected: 4.5, available: 7}, undefined]) {
      assert.equal(run(code, 4 / 7, ratio).value, null);
    }
    for (const raw of [-1 / 7, 8 / 7]) assert.equal(run(code, raw, {selected: raw * 7, available: 7}).value, null);
    assert.equal(run(code, 4 / 7, {selected: 4, available: 7}, 'funnel-reporting-carry-forward').value, null);
  }
  assert.equal(run('churn.funnel_analysis', 4 / 7, {selected: 4, available: 7}).value, null);
  assert.equal(JSON.stringify(team), snapshot);
});
