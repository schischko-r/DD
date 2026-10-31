import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
import {completeBlockPercent} from './report.js';
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const source = read('../../public/report-data.json').products;
const data = read('../data/campaigning-performance-q3-2026.json');
const app = fs.readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k => read(`../data/${imports.get(k.trim())}`));
const args = [read('../data/salary-products-q3-2026.json'), read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json')];
const metrics = p => p.metrics.flatMap(b => b.metrics);

test('only the three campaigning performance criteria receive 1/1, quarter/1, 1/1; knowledge metrics, other teams and Q2 stay intact', () => {
  const before = buildDdiPeriodProducts(source, data.period, overlays.filter(o => o.scope !== data.scope), ...args);
  const after = buildDdiPeriodProducts(source, data.period, overlays, ...args);
  const record = data.products[0];
  let checked = 0;
  for (const p of after) {
    const old = before.find(t => t.id === p.id);
    if (p.id.split('::empty::')[0] !== record.id) {assert.deepEqual(p, old); continue;}
    assert.equal(p.indexMaxPoints, old.indexMaxPoints);
    for (const [code, fact] of Object.entries(record.metrics)) {
      const m = metrics(p).find(m => m.code === code);
      assert.equal(m.value, fact.rawValue); assert.equal(m.max_value, 1);
      assert.equal(m.source.origin, 'userConfirmedCampaigningPerformance');
      assert.ok(m.recommendation_items.every(item => item.value === fact.rawValue && item.max_value === 1 && item.gap === 1-fact.rawValue));
      checked++;
    }
    assert.equal(completeBlockPercent(p.metrics.find(b => b.code === 'rezulьtativnostь')), 75);
    assert.deepEqual(metrics(p).filter(m => !record.metrics[m.code]), metrics(old).filter(m => !record.metrics[m.code]));
  }
  assert.equal(checked, 3);
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', overlays, ...args), source);
});

test('quarter performance scores cannot enter knowledge criteria or a mismatched team', () => {
  const team = {id:'x', name:'X', unit:'Data', type:'Канал', period:'II кв. 2026', metrics:[{code:'rezulьtativnostь', metrics:[
    {code:'rezulьtativnostь.dop_npv_vypolneniya', value:1, max_value:1, is_applicabble_flg:true},
    {code:'general.dop_npv_mlrd_rub', value:.2, max_value:.2, is_applicabble_flg:true},
  ]}]};
  const fact = {...data, products:[{id:'x',name:'X',unit:'Data',type:'Канал',metrics:{
    'rezulьtativnostь.dop_npv_vypolneniya':{rawValue:.25},'general.dop_npv_mlrd_rub':{rawValue:.25},
  }}]};
  const result = buildTeamProfileProducts([team], data.period, [fact])[0];
  assert.equal(metrics(result)[0].value,.25);assert.equal(metrics(result)[0].max_value,1);
  assert.equal(metrics(result)[1].value,null);
  fact.products[0].unit='wrong';
  assert.deepEqual(buildTeamProfileProducts([team],data.period,[fact]),buildTeamProfileProducts([team],data.period));
});
