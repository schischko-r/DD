import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyUbWorkbookCorrections} from './ubWorkbookCorrections.js';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {isDdIndexMetric} from './report.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const config = read('../data/ub-workbook-corrections-q3-2026.json');
const raw = read('../../public/report-data.json').products;
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
const build = (period, facts) => buildDdiPeriodProducts(raw, period, facts, read('../data/salary-products-q3-2026.json'),
  read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json'));
const flatten = p => p.metrics.flatMap(block => block.metrics);

test('only the 50 nonblank UB correction cells apply; all other units, metrics, parts and Q2 are unchanged', () => {
  const before = build(config.period, overlays.filter(item => item.scope !== config.scope));
  const after = build(config.period, overlays);
  let cells = 0;
  for (let i = 0; i < after.length; i++) {
    const p = after[i], old = before[i];
    const record = config.products.find(t => t.id === p.id.replace(/::empty::.*/, '') && ['name', 'unit', 'type'].every(key => t[key] === p[key]));
    if (!record) {assert.deepEqual(p, old); continue;}
    assert.equal(p.unit, 'УБ');
    let excludedWeight = 0;
    for (const m of flatten(p)) {
      const prior = flatten(old).find(entry => entry.code === m.code);
      const fact = record.metrics[m.code];
      const during = m.code === 'mehaniki.cross_sell' && record.metrics[m.code + '.during'];
      const afterFact = m.code === 'mehaniki.cross_sell' && record.metrics[m.code + '.after'];
      if (!fact && !during && !afterFact) {assert.deepEqual(m, prior); continue;}
      if (fact?.applicable === false) {
        cells++;
        assert.equal(m.value, null); assert.equal(m.max_value, 0); assert.equal(m.is_applicabble_flg, false);
        assert.equal(m.excluded_from_index, true);
        if (isDdIndexMetric(prior)) excludedWeight += prior.max_value;
      } else if (fact) {
        cells++;
        if (prior.source?.origin === 'userConfirmedCampaignPresence20261102') {
          assert.deepEqual(m, prior, 'latest campaign confirmation has priority over workbook');
        } else {
          assert.equal(m.value, fact.rawValue * prior.max_value, p.name + ' / ' + m.code);
          assert.equal(m.source.cell, fact.source.cell);
        }
        for (const key of ['max_value', 'is_applicabble_flg', 'excluded_from_index', 'dd_calculation_flg']) assert.equal(m[key], prior[key]);
      } else {
        for (const [key, part] of [['during', during], ['after', afterFact]]) {
          if (!part) {assert.deepEqual(m.crossSellComponents[key], prior.crossSellComponents[key]); continue;}
          cells++;
          assert.equal(m.crossSellComponents[key].value, part.rawValue * prior.max_value / 2);
          assert.equal(m.crossSellComponents[key].source.cell, part.source.cell);
        }
        assert.equal(m.value, m.crossSellComponents.during.value + m.crossSellComponents.after.value);
        assert.equal(m.max_value, prior.max_value);
      }
    }
    assert.equal(p.indexMaxPoints, old.indexMaxPoints - excludedWeight);
  }
  assert.equal(cells, 50);
  assert.equal(config.products.length, 16);
  assert.deepEqual(after.find(p => p.name === 'PB'), before.find(p => p.name === 'PB'));
  assert.deepEqual(build('II кв. 2026', overlays), raw);
  assert.deepEqual(applyUbWorkbookCorrections(after, config.period, overlays), after);
});

test('before newer CBP corrections no existing score becomes a hole except the explicitly non-applicable OSAGO upsell', () => {
  const before = read('../../../outputs/ub-workbook-corrections-2026-11-02/before.json');
  const after = build(config.period, overlays.filter(item => item.scope !== 'cbp-user-corrections'));
  const holes = [];
  for (const p of after) {
    const old = before.find(team => team.id === p.id);
    const record = config.products.find(team => team.id === p.id.replace(/::empty::.*/, '') && team.unit === p.unit);
    for (const m of flatten(p)) {
      const prior = flatten(old).find(entry => entry.code === m.code);
      if (Number.isFinite(prior.value) && !Number.isFinite(m.value)) holes.push([p.name, m.code]);
      const selected = record?.metrics[m.code] || (m.code === 'mehaniki.cross_sell'
        && (record?.metrics[m.code + '.during'] || record?.metrics[m.code + '.after']));
      if (!selected) {
        if (p.name === 'ДСЖ ПК' && m.code === 'general.navigator_reporting_knowledge') {
          assert.equal(m.value, m.max_value);
          assert.equal(m.source.origin, 'userConfirmedNavigatorKnowledgeHierarchy');
          continue;
        }
        if (p.name === 'Сделка ИЖС' && m.code === 'hyp.discovery_40_backlog') {
          assert.equal(m.value, 1);
          assert.equal(m.max_value, prior.max_value);
          continue;
        }
        if ((['ДСЖ КК', 'ЗПИФ', 'ВЗР'].includes(p.name)
          && ['attract.campaign_launches', 'attract.nalichie_self_service'].includes(m.code))
          || (p.name === 'ДСЖ ПК' && ['attract.nalichie_self_service', 'attract.nalichie_uspeshnyh_biznes_zapuskov'].includes(m.code))
          || (p.name === 'ЗПИФ' && m.code === 'attract.nalichie_uspeshnyh_biznes_zapuskov')) {
          assert.equal(m.value, .5);
          assert.equal(m.max_value, .5);
          assert.equal(m.source.origin, 'userConfirmedCampaignPresence20261102');
          continue;
        }
        if (m.code === 'attract.campaign_launches' && prior.value === 0
          && m.source?.origin === 'userConfirmedCampaignLaunchesFromSelfService20261102') {
          const self = flatten(p).find(item => item.code === 'attract.nalichie_self_service');
          assert.equal(self.value, self.max_value);
          assert.equal(m.value, prior.max_value);
          assert.equal(m.max_value, prior.max_value);
          continue;
        }
        if (['БПИФ', 'ЦФА'].includes(p.name) && ['general.obъem_celevogo_rynka_v_rossii', 'general.obъem_celevogo_rynka_v_sbere'].includes(m.code)) {
          assert.equal(m.value, p.name === 'БПИФ' ? m.max_value : 0);
          assert.equal(m.max_value, prior.max_value);
          continue;
        }
        assert.equal(m.value, prior.value, p.name + ' / ' + m.code);
        assert.equal(m.max_value, prior.max_value);
      }
    }
  }
  assert.deepEqual(holes, [['ОСАГО', 'mehaniki.doprodazhi_up_sell']]);
});

test('empty facts, other columns, other units, identity mismatches and Q2 cannot overwrite values', () => {
  const team = config.products[0], code = Object.keys(team.metrics)[0], fact = team.metrics[code];
  const p = {...team, metrics: [{metrics: [{code, value: 0.5, max_value: 0.5, is_applicabble_flg: true}]}]};
  const assessment = {...config, products: [{...team, metrics: {[code]: fact}}]};
  assert.equal(flatten(applyUbWorkbookCorrections([p], config.period, assessment)[0])[0].value, 0.25);
  for (const patch of [{rawValue: null}, {source: {...fact.source, column: 'E'}}, {source: {...fact.source, cell: 'E202'}},
    {source: {...fact.source, sourceUnit: 'DB'}}, {source: {...fact.source, confirmedBy: 'other'}}]) {
    const changed = {...assessment, products: [{...team, metrics: {[code]: {...fact, ...patch}}}]};
    assert.deepEqual(applyUbWorkbookCorrections([p], config.period, changed), [p]);
  }
  assert.deepEqual(applyUbWorkbookCorrections([{...p, unit: 'CX'}], config.period, assessment), [{...p, unit: 'CX'}]);
  assert.deepEqual(applyUbWorkbookCorrections([p], 'II кв. 2026', assessment), [p]);
});
