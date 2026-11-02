import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyCampaignSelfService, isCampaignSelfServiceConfirmation} from './campaignSelfService.js';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
const period = 'III кв. 2026';
const launch = {code: 'attract.campaign_launches', value: 0, max_value: .5, is_applicabble_flg: true,
  source: {cell: 'B3'}, recommendation_items: [{value: 0, max_value: .5, gap: .5}]};
const self = {code: 'attract.nalichie_self_service', value: .5, max_value: .5, is_applicabble_flg: true};
const team = (l = launch, s = self) => ({id: 'test', unit: 'DB', metrics: [{code: 'attract', metrics: [l, s,
  {code: 'attract.nalichie_uspeshnyh_biznes_zapuskov', value: 0, max_value: .5}]}]});
const flat = p => p.metrics.flatMap(b => b.metrics);

test('zero launches become full only with full applicable self-service, preserving weights and provenance', () => {
  const before = [team()], snapshot = structuredClone(before);
  const after = applyCampaignSelfService(before, period);
  assert.equal(flat(after[0])[0].value, .5);
  const confirmed = flat(after[0])[0];
  assert.equal(isCampaignSelfServiceConfirmation(confirmed, period), true);
  assert.equal(isCampaignSelfServiceConfirmation(confirmed, 'II кв. 2026'), false);
  for (const changed of [{...confirmed, code: self.code}, {...confirmed, value: 0},
    {...confirmed, is_applicabble_flg: false}, {...confirmed, source: {origin: 'userConfirmedManualScore'}},
    {...confirmed, source: {...confirmed.source, basis: {...confirmed.source.basis, value: 0}}}]) {
    assert.equal(isCampaignSelfServiceConfirmation(changed, period), false);
  }
  assert.equal(flat(after[0])[0].max_value, .5);
  assert.deepEqual(flat(after[0])[0].source.previousAssessmentSource, launch.source);
  assert.deepEqual(flat(after[0])[0].recommendation_items, [{value: .5, max_value: .5, gap: 0}]);
  assert.deepEqual(flat(after[0]).slice(1), flat(before[0]).slice(1));
  assert.deepEqual(before, snapshot);
  assert.deepEqual(applyCampaignSelfService(after, period), after);
  assert.equal(applyCampaignSelfService(before, 'II кв. 2026'), before);
  for (const [l, s] of [[{...launch, value: null}, self], [{...launch, value: .25}, self],
    [{...launch, value: .5}, self], [{...launch, is_applicabble_flg: false}, self],
    [{...launch, max_value: 0}, self], [launch, {...self, value: null}],
    [launch, {...self, value: 0}], [launch, {...self, value: .25}],
    [launch, {...self, is_applicabble_flg: false}], [launch, {...self, value: 0, max_value: 0}]]) {
    const input = [team(l, s)];
    assert.equal(applyCampaignSelfService(input, period)[0], input[0]);
  }
  assert.equal(flat(applyCampaignSelfService([team({...launch, max_value: 2}, {...self, value: 1, max_value: 2})], period)[0])[0].value, 0,
    'literal one point is not full self-service when its maximum is two');
});

test('live Q3 pipeline preserves current self-service launch corrections and Q2', () => {
  const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));
  const raw = read('../../public/report-data.json').products;
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k => read(`../data/${imports.get(k.trim())}`));
  const build = p => buildDdiPeriodProducts(raw, p, overlays, read('../data/salary-products-q3-2026.json'),
    read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json'));
  const changed = build(period).filter(p => flat(p).some(m => m.source?.origin === 'userConfirmedCampaignLaunchesFromSelfService20261102'));
  assert.deepEqual(changed.map(p => p.name).sort(), ['Пенсионный продукт', 'Страхование залога', 'ЦФА', 'Образовательный кредит', 'КАСКО'].sort());
  for (const p of changed) {
    const l = flat(p).find(m => m.code === launch.code), s = flat(p).find(m => m.code === self.code);
    assert.equal(l.value, l.max_value);
    assert.equal(l.source.previousAssessmentValue, 0);
    assert.equal(s.value, s.max_value);
    assert.equal(isCampaignSelfServiceConfirmation(l, period), true);
  }
  assert.deepEqual(build('II кв. 2026'), raw);
});
