import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeBlockPercent, isDdIndexMetric, isInformationalMetric} from './report.js';
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const source = read('../../public/report-data.json').products;
const data = read('../data/po-goals-survey-assessments-q3-2026.json');
const app = fs.readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k => read(`../data/${imports.get(k.trim())}`));
const args = [read('../data/salary-products-q3-2026.json'), read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json')];
const metrics = p => p.metrics.flatMap(b => b.metrics);

test('all 76 teams use scoped PO survey or LT-baseline rules: 218 scores, 10 irrelevant, zero pending; LT, other facts and Q2 remain intact', () => {
  const before = buildDdiPeriodProducts(source, data.period, overlays.filter(o => o.scope !== data.scope), ...args);
  const after = buildDdiPeriodProducts(source, data.period, overlays, ...args);
  let graded = 0, irrelevant = 0;
  for (const p of after) {
    const old = before.find(t => t.id === p.id);
    const record = data.products.find(t => t.id === p.id.split('::empty::')[0]);
    assert.ok(record, p.name);
    for (const [code, fact] of Object.entries(record.metrics)) {
      const m = metrics(p).find(m => m.code === code);
      assert.equal(m.value, fact.rawValue);
      assert.equal(isInformationalMetric(m), false);
      if (fact.applicable === false) {
        irrelevant++;
        assert.equal(m.max_value, 0); assert.equal(isDdIndexMetric(m), false);
        assert.equal(m.is_applicabble_flg, false); assert.equal(m.hidden_from_profile, true);
      } else {
        graded++;
        assert.equal(m.max_value, 1); assert.equal(isDdIndexMetric(m), true);
        assert.ok(Number.isFinite(m.value));
        if (fact.source.sourceKind === 'ltBaseline' && !fact.source.formatAdjustment) {
          assert.equal(m.value, metrics(p).find(m => m.code === fact.source.ltMetricCode).value);
        }
      }
    }
    assert.equal(p.indexMaxPoints, old.indexMaxPoints - Object.values(record.metrics).filter(f => f.applicable === false).length);
    assert.deepEqual(metrics(p).filter(m => !m.code.startsWith('goals.po_')), metrics(old).filter(m => !m.code.startsWith('goals.po_')));
    assert.notEqual(completeBlockPercent(p.metrics.find(b => b.code === 'goals')), null);
    if (p.salaryCohorts) for (const child of Object.values(p.salaryCohorts)) {
      assert.deepEqual(metrics(child).filter(m => m.code.startsWith('goals.po_')), metrics(p).filter(m => m.code.startsWith('goals.po_')));
    }
  }
  assert.equal(graded, 218); assert.equal(irrelevant, 10); assert.deepEqual(data.pending, []);
  const scores = name => Object.fromEntries(metrics(after.find(p => p.name === name)).filter(m => m.code.startsWith('goals.po_')).map(m => [m.code, m.value]));
  assert.deepEqual(scores('Автокредит'), {'goals.po_monitoring': 1, 'goals.po_forecast': 1, 'goals.po_factor_analysis': 1}, 'A positive LT base is retained even when the independent Excel survey is partial');
  assert.deepEqual(scores('Дебетовая карта'), {'goals.po_monitoring': 1, 'goals.po_forecast': 1, 'goals.po_factor_analysis': 1});
  assert.deepEqual(scores('СберПрайм'), {'goals.po_monitoring': 1, 'goals.po_forecast': 1, 'goals.po_factor_analysis': 1});
  assert.deepEqual(scores('Зарплатный продукт'), {'goals.po_monitoring': .5, 'goals.po_forecast': null, 'goals.po_factor_analysis': 1});
  assert.equal(scores('СберЧаевые')['goals.po_monitoring'], .5, 'Zero LT plus full Excel response yields half');
  assert.equal(scores('Торговый Эквайринг')['goals.po_factor_analysis'],1);
  assert.equal(scores('ОМС')['goals.po_factor_analysis'], 1);
  assert.equal(scores('Слитки')['goals.po_factor_analysis'], 1);
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', overlays, ...args), source);
});
