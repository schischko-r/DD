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
const pc = overlays.find((item) => item.scope === 'pc-final-score-assessment');
const salary = read('../data/salary-products-q3-2026.json');
const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
const actions = read('../data/funnel-action-missing-q3-2026.json');
const metric = (product, code) => product.metrics.flatMap((block) => block.metrics).find((item) => item.code === code);

test('PC final scores prefer corrections and apply only populated values in Q3', () => {
  assert.equal(pc.counts.sourceRows, 149);
  assert.equal(pc.counts.selectedRows, 108);
  assert.equal(pc.counts.correctionRows, 7);
  const q3 = buildDdiPeriodProducts(source, pc.period, overlays, salary, reporting, actions);
  for (const row of pc.products) {
    const product = q3.find((item) => item.name === row.name && item.unit === 'PC' && item.type === row.type);
    assert.ok(product, row.name);
    for (const [code, fact] of Object.entries(row.metrics || {})) {
      const current = metric(product, code);
      assert.ok(current, `${row.name}: ${code}`);
      assert.equal(current.value / current.max_value, fact.rawValue, `${row.name}: ${code}`);
      assert.equal(current.source.origin, 'userConfirmedPCFinalScore20261102');
    }
    if (row.crossSellDuring) {
      const current = metric(product, 'mehaniki.cross_sell');
      const duringAssessment = overlays.find((item) => item.scope === 'crosssell-during-purchase-assessment')
        ?.products.find((team) => team.name === row.name && team.unit === product.unit && team.type === product.type);
      if (duringAssessment) {
        assert.equal(current.crossSellComponents.during.value,
          duringAssessment.metrics['mehaniki.cross_sell'].rawValue * current.max_value / 2);
        assert.equal(current.crossSellComponents.during.source.origin, 'userConfirmedCrossSellDuringPurchase');
      } else assert.equal(current.crossSellComponents.during.value, row.crossSellDuring.rawValue * current.max_value / 2);
    }
    if (row.goals) {
      const block = product.metrics.find((item) => item.code === 'goals');
      for (const [code, value] of Object.entries(row.goals.final || {})) {
        assert.equal(block.goalsFinalScores[code], value, `${row.name}: final ${code}`);
      }
      for (const [code, value] of Object.entries(row.goals.lulT || {})) {
        assert.equal(metric(product, code).value, value, `${row.name}: LЮ/LТ ${code}`);
      }
      for (const [code, value] of Object.entries(row.goals.po || {})) {
        assert.equal(block.goalsPoLevelMetrics.find((item) => item.code === code).value, value, `${row.name}: PO ${code}`);
      }
    }
  }
  const checks = [
    ['Выписки, справки', 'attract.report_completeness', 1],
    ['Выписки, справки', 'hyp.datadriven_rating_7_5', 0],
    ['Колл-центр', 'voronka_vhoda_v_kanal.polnota_otcheta', 0.5],
    ['Чат', 'mehaniki.uderzhaniya_klienta', 0.5],
  ];
  for (const [team, code, ratio] of checks) {
    const product = q3.find((item) => item.name === team && item.unit === 'PC');
    assert.equal(metric(product, code).value / metric(product, code).max_value, ratio);
  }
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', overlays, salary, reporting, actions), source);
});
