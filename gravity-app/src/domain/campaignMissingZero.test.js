import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
import {excludeRemovedTeams} from './report.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const source = excludeRemovedTeams(read('../../public/report-data.json')).products;
const assessment = read('../data/campaign-missing-zero-q3-2026.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
// These regressions describe the October/November 2 campaign stages, before the audit corrections.
const beforeCampaignAudit = o => o.scope !== 'q3-score-correction' ? o : {...o, products: o.products.map(p => ({...p,
  metrics: Object.fromEntries(Object.entries(p.metrics).filter(([, f]) => f.source?.correction?.group !== 'campaignAudit20261103'))}))};
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').filter((key) => imports.get(key.trim()) !== 'domclick-self-service-q3-2026.json').map((key) => beforeCampaignAudit(read(`../data/${imports.get(key.trim())}`)));
const metrics = (p) => p.metrics.flatMap((b) => b.metrics);

test('Applicable blanks across 17 teams become explicit Q3 zeros, preserving every other score and Q2', () => {
  const snapshot = JSON.stringify({source, overlays});
  const before = buildTeamProfileProducts(source, assessment.period, overlays.filter((o) => o.scope !== assessment.scope));
  const after = buildTeamProfileProducts(source, assessment.period, overlays);
  const counts = Object.fromEntries(Object.keys(assessment.counts.byMetric).map((code) => [code, 0]));
  let teams = 0;
  for (let i = 0; i < after.length; i++) {
    const product = after[i], old = before[i];
    const facts = assessment.products.find((t) => t.id === product.id.replace(/::empty::.*/, ''));
    assert.equal(product.indexMaxPoints, old.indexMaxPoints);
    if (!facts) {assert.deepEqual(product, old); continue;}
    teams++;
    for (const metric of metrics(product)) {
      const prior = metrics(old).find((m) => m.code === metric.code);
      if (!facts.metrics[metric.code]) {assert.deepEqual(metric, prior); continue;}
      if (!prior || prior.is_applicabble_flg === false || !(prior.max_value > 0)) {
        assert.deepEqual(metric, prior, `${product.name}: ${metric.code} is non-applicable`);
        continue;
      }
      const explicit = overlays.find((overlay) => overlay.scope === 'campaign-user-assessment')?.products
        ?.find((team) => team.id === product.id.replace(/::empty::.*/, ''))?.metrics?.[metric.code];
      if (explicit) {
        assert.equal(metric.value, explicit.rawValue * metric.max_value);
        assert.equal(metric.source.origin, explicit.source.origin);
        continue;
      }
      assert.equal(prior.value, null);
      assert.equal(metric.value, 0);
      assert.equal(metric.max_value, prior.max_value);
      assert.equal(metric.is_applicabble_flg, prior.is_applicabble_flg);
      assert.equal(metric.source.origin, 'userConfirmedMissingAsZero');
      counts[metric.code]++;
    }
  }
  assert.equal(teams, 17);
  assert.deepEqual(Object.values(counts), [10, 3, 11, 10]);
  // Nine explicit user scores supersede the campaign-missing-zero facts in this Q3 build.
  for (const p of after) for (const m of metrics(p)) {
    if (Object.hasOwn(counts, m.code) && m.is_applicabble_flg !== false && m.max_value > 0) assert.ok(Number.isFinite(m.value));
  }
  assert.deepEqual(buildTeamProfileProducts(source, 'II кв. 2026', overlays), source);
  assert.equal(JSON.stringify({source, overlays}), snapshot);
});

test('explicit campaign assessments preserve prior corrections and update DSZh only in Q3', () => {
  const manual = read('../data/campaign-user-assessments-q3-2026.json');
  assert.deepEqual(manual.products.map((p) => p.name).sort(), ['БПИФ', 'ДСЖ КК', 'ДСЖ ПК', 'ЗПИФ', 'ВЗР', 'ОСАГО',
    'Много денег (НКПЗН)', 'Сделка вторичка', 'Сделка ИЖС', 'Сделка с Первичным жильём'].sort());
  // Compare this batch alone; later campaign corrections must remain in both runs.
  const before = buildTeamProfileProducts(source, manual.period, overlays.filter((o) => o.source?.origin !== manual.source.origin));
  const after = buildTeamProfileProducts(source, manual.period, overlays);
  for (let i = 0; i < after.length; i++) {
    const current = after[i], old = before[i];
    const record = manual.products.find((p) => p.id === current.id.replace(/::empty::.*/, ''));
    if (!record) {assert.deepEqual(current, old); continue;}
    for (const [code, fact] of Object.entries(record.metrics)) {
      const result = metrics(current).find((m) => m.code === code);
      const prior = metrics(old).find((m) => m.code === code);
      assert.equal(result.value / result.max_value, fact.rawValue);
      assert.equal(result.max_value, prior.max_value);
      assert.equal(result.source.origin, fact.source.origin);
    }
    assert.equal(current.indexMaxPoints, old.indexMaxPoints);
    assert.deepEqual(metrics(current).filter((m) => !record.metrics[m.code]), metrics(old).filter((m) => !record.metrics[m.code]));
  }
  const codes = ['attract.campaign_launches', 'attract.nalichie_self_service', 'attract.nalichie_uspeshnyh_biznes_zapuskov'];
  for (const [name, values] of [['ОПИФ', [0, 0, 0]], ['ДСЖ КК', [1, 1, 1]]]) {
    const team = after.find((p) => p.name === name);
    assert.deepEqual(codes.map((code) => {const m = metrics(team).find((m) => m.code === code); return m.value / m.max_value;}), values);
  }
  assert.deepEqual(buildTeamProfileProducts(source, 'II кв. 2026', overlays), source);
});

test('final campaign confirmations preserve applicability, other metrics and Q2', async () => {
  const {buildDdiPeriodProducts} = await import('./quarterProfiles.js');
  const all = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => beforeCampaignAudit(read(`../data/${imports.get(key.trim())}`)));
  const prior = structuredClone(all);
  const batch = prior.find(item => item.scope === 'campaign-user-assessment');
  batch.products = batch.products.filter(item => !['ЗПИФ', 'ВЗР', 'ДСЖ ПК'].includes(item.name));
  const kk = batch.products.find(item => item.name === 'ДСЖ КК');
  for (const code of ['attract.campaign_launches', 'attract.nalichie_self_service']) kk.metrics[code] = kk.metrics[code].source.previousAssessment;
  const raw = read('../../public/report-data.json').products;
  const build = (facts, period = 'III кв. 2026') => buildDdiPeriodProducts(raw, period, facts,
    read('../data/salary-products-q3-2026.json'), read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json'));
  const before = build(prior), after = build(all);
  let changed = 0;
  for (let i = 0; i < after.length; i++) {
    const p = after[i], old = before[i];
    for (const m of metrics(p)) {
      const priorMetric = metrics(old).find(item => item.code === m.code);
      if ((['ДСЖ КК', 'ЗПИФ', 'ВЗР'].includes(p.name) && ['attract.campaign_launches', 'attract.nalichie_self_service'].includes(m.code))
        || (p.name === 'ДСЖ ПК' && ['attract.nalichie_self_service', 'attract.nalichie_uspeshnyh_biznes_zapuskov'].includes(m.code))
        || (p.name === 'ЗПИФ' && m.code === 'attract.nalichie_uspeshnyh_biznes_zapuskov')) {
        changed++;
        assert.equal(m.value, .5);
        assert.equal(m.max_value, .5);
        assert.equal(m.is_applicabble_flg, true);
        assert.equal(m.source.origin, 'userConfirmedCampaignPresence20261102');
        assert.equal(m.recommendation_items[0].gap, 0);
      } else assert.deepEqual(m, priorMetric, `${p.name}/${m.code}`);
    }
    assert.equal(p.indexMaxPoints, old.indexMaxPoints);
  }
  assert.equal(changed, 9);
  assert.deepEqual(build(all, 'II кв. 2026'), raw);
});
