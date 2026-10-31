import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const source = read('../../public/report-data.json').products;
const app = fs.readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k => read(`../data/${imports.get(k.trim())}`));
const salary = read('../data/salary-products-q3-2026.json');
const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
const actions = read('../data/funnel-action-missing-q3-2026.json');
const build = (period, batches) => buildDdiPeriodProducts(source, period, batches, salary, reporting, actions);

test('all four Domclick teams have full Self-service in Q3; other metrics, teams and Q2 are unchanged', () => {
  const before = build('III кв. 2026', overlays.filter(o => o.source?.origin !== 'userConfirmedDomclickSelfService'));
  const after = build('III кв. 2026', overlays);
  const names = [];
  for (const p of after) {
    const old = before.find(t => t.id === p.id);
    if (p.unit !== 'ДомКлик') { assert.deepEqual(p, old); continue; }
    names.push(p.name);
    const metrics = p.metrics.flatMap(b => b.metrics);
    const m = metrics.find(m => m.code === 'attract.nalichie_self_service');
    assert.equal(m.value, m.max_value);
    assert.equal(m.max_value, .5);
    assert.equal(m.is_applicabble_flg, true);
    assert.equal(m.source.origin, 'userConfirmedDomclickSelfService');
    assert.deepEqual(metrics.filter(x => x !== m), old.metrics.flatMap(b => b.metrics).filter(x => x.code !== m.code));
  }
  assert.deepEqual(names.sort(), ['Много денег (НКПЗН)', 'Сделка ИЖС', 'Сделка вторичка', 'Сделка с Первичным жильём'].sort());
  assert.deepEqual(build('II кв. 2026', overlays), source);
});
