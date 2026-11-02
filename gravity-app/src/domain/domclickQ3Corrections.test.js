import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const source = read('../../public/report-data.json').products;
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlayNames = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => imports.get(key.trim()));
const overlays = overlayNames.map((name) => read(`../data/${name}`));
const salary = read('../data/salary-products-q3-2026.json');
const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
const actions = read('../data/funnel-action-missing-q3-2026.json');
const metric = (product, code) => product.metrics.flatMap((block) => block.metrics).find((item) => item.code === code);
const names = ['Много денег (НКПЗН)', 'Сделка вторичка', 'Сделка ИЖС', 'Сделка с Первичным жильём'];

test('DomClick Q3 corrections apply the explicit survey, campaign, mechanics and CX scores without changing Q2', () => {
  const q3 = buildDdiPeriodProducts(source, 'III кв. 2026', overlays, salary, reporting, actions);
  const expectations = {
    'Много денег (НКПЗН)': {'attract.funnel_analysis': 0.5, 'attract.campaign_launches': 1,
      'attract.chernoviki_v_sbol_70': 1, 'attract.nalichie_uspeshnyh_biznes_zapuskov': 1,
      'churn.report_completeness': 0.5},
    'Сделка вторичка': {'general.navigator_reporting_knowledge': 0.5, 'attract.funnel_analysis': 0.5,
      'attract.chernoviki_v_sbol_70': 1, 'attract.nalichie_uspeshnyh_biznes_zapuskov': 1},
    'Сделка ИЖС': {'attract.funnel_analysis': 0.5, 'attract.chernoviki_v_sbol_70': 1,
      'attract.nalichie_uspeshnyh_biznes_zapuskov': 1, 'hyp.discovery_40_backlog': 0.5},
    'Сделка с Первичным жильём': {'attract.chernoviki_v_sbol_70': 1,
      'attract.nalichie_uspeshnyh_biznes_zapuskov': 1, 'churn.nastroena_otchetnostь': 0.5,
      'churn.regulyarnostь': 0.5, 'churn.funnel_analysis': 0.5},
  };
  for (const name of names) {
    const product = q3.find((item) => item.name === name && item.unit === 'ДомКлик');
    assert.ok(product, name);
    for (const [code, ratio] of Object.entries(expectations[name])) {
      const result = metric(product, code);
      assert.ok(result, `${name}: ${code}`);
      assert.equal(result.value / result.max_value, ratio, `${name}: ${code}`);
    }
    const returnMetric = metric(product, 'mehaniki.vozvrat_klientov');
    assert.equal(returnMetric.is_applicabble_flg, false, `${name}: return mechanics`);
    assert.equal(returnMetric.max_value, 0, `${name}: return mechanics denominator`);
    const crossSell = metric(product, 'mehaniki.cross_sell');
    assert.equal(crossSell.crossSellComponents.during.value, 0.5, `${name}: during-sale cross-sell is 100% of its half weight`);
    const afterValue = ['Сделка ИЖС', 'Сделка с Первичным жильём'].includes(name) ? 0.5 : 1;
    assert.equal(crossSell.crossSellComponents.after.rawValue, afterValue, `${name}: after-sale cross-sell is preserved`);
    assert.equal(crossSell.value, 0.5 + afterValue / 2, `${name}: total cross-sell`);
    assert.equal(metric(product, 'cx.score').value / metric(product, 'cx.score').max_value, 1, `${name}: CX Score`);
  }
  const primary = q3.find((item) => item.name === 'Сделка с Первичным жильём');
  assert.equal(metric(primary, 'churn.nastroena_otchetnostь').max_value, 0.5);
  assert.equal(metric(primary, 'churn.regulyarnostь').max_value, 1);
  assert.equal(metric(q3.find((item) => item.name === 'Сделка вторичка'), 'general.navigator_reporting_knowledge').value, 0.25);
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', overlays, salary, reporting, actions), source);
});
