import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {excludeRemovedTeams} from './report.js';
import {buildDdiPeriodProducts} from './quarterProfiles.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`));
const source = excludeRemovedTeams(read('../../public/report-data.json')).products;
const id = '6d607e87-5e45-5759-a9cc-1a162b981a26¦Персональная рекомендация';
const build = (period, facts) => buildDdiPeriodProducts(source, period, facts,
  read('../data/salary-products-q3-2026.json'), read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json'));

test('campaigning Q3 has both alerts at 50% and regularity at 0.5 without changing other scores or Q2', () => {
  const prior = overlays.filter((o) => o.source?.origin !== 'userConfirmedCampaigningAlerts').map((o) =>
    o.scope === 'regularity-user-assessment' ? {...o, products: o.products.filter((p) => p.id !== id)} : o);
  const before = build('III кв. 2026', prior);
  const after = build('III кв. 2026', overlays);
  const expected = {'alerts.nastroena_matrica_otkloneniy': 0.5,
    'alerts.nastroeny_avtoalerty_po_otkloneniyam': 0.5, 'analiz_effektivnostь.regulyarnostь': 0.5};
  let checked = 0;
  for (let i = 0; i < after.length; i++) {
    const team = after[i], old = before[i];
    if (team.id.replace(/::empty::.*/, '') !== id) {assert.deepEqual(team, old); continue;}
    for (const block of team.metrics) for (const metric of block.metrics) {
      const previous = old.metrics.flatMap((b) => b.metrics).find((m) => m.code === metric.code);
      if (!(metric.code in expected)) {assert.deepEqual(metric, previous); continue;}
      checked++;
      assert.equal(metric.value, expected[metric.code] * metric.max_value);
      for (const key of ['max_value', 'is_applicabble_flg', 'dd_calculation_flg', 'excluded_from_index']) assert.equal(metric[key], previous[key]);
      assert.equal(metric.source.confirmedBy, 'user');
    }
  }
  assert.equal(checked, 3);
  assert.deepEqual(build('II кв. 2026', overlays), build('II кв. 2026', prior));
});
