import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {isDdIndexMetric} from '../../gravity-app/src/domain/report.js';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const app = read('gravity-app/src/app/App.jsx');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], `gravity-app/src/data/${m[2]}`]));
const overlayNames = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(s => s.trim());
const configNames = ['salaryProductsQ32026', 'reportingMissingQ32026', 'funnelActionMissingQ32026'];
const paths = [...overlayNames, ...configNames].map(n => {assert.ok(imports.has(n));return imports.get(n);});
const sourcePaths = ['gravity-app/src/app/App.jsx', 'gravity-app/public/report-data.json', 'gravity-app/public/backlog-data.json', ...paths];
const hash = p => createHash('sha256').update(read(p)).digest('hex');
const before = Object.fromEntries(sourcePaths.map(p => [p, hash(p)]));
const products = buildDdiPeriodProducts(json('gravity-app/public/report-data.json').products, 'III кв. 2026',
  overlayNames.map(n => json(imports.get(n))), ...configNames.map(n => json(imports.get(n))), json('gravity-app/public/backlog-data.json'));
const codes = ['attract.campaign_launches', 'attract.nalichie_self_service', 'attract.nalichie_uspeshnyh_biznes_zapuskov'];
const rows = products.flatMap(p => codes.map(code => {
  const m = p.metrics.flatMap(b => b.metrics).find(m => m.code === code);
  return {id: p.id, sourceTeamId: p.sourceTeamId, team: p.name, unit: p.unit, type: p.type, period: p.period,
    metric: code, name: m?.name, value: m?.value ?? null, max: m?.max_value ?? null,
    applicable: m ? m.is_applicabble_flg !== false && m.max_value > 0 : false,
    included: m ? isDdIndexMetric(m) : false,
    score: m && Number.isFinite(m.value) && m.max_value > 0 && m.is_applicabble_flg !== false ? m.value / m.max_value : null,
    source: m?.source ?? null};
}));
assert.equal(rows.length, products.length * 3);
assert.deepEqual(Object.fromEntries(sourcePaths.map(p => [p, hash(p)])), before);
fs.writeFileSync(path.join(out, 'current-metrics.json'), JSON.stringify({period: 'III кв. 2026', successfulMonth: '2026-04', launchesMonth: '2026-09', selfServiceMonth: '2026-09', teams: products.length, rows, sourceHashes: before}, null, 2));
console.log(JSON.stringify({teams: products.length, metrics: rows.length, applicable: rows.filter(r => r.applicable).length,
  byMetric: codes.map(code => ({code, included: rows.filter(r => r.metric === code && r.included).length,
    applicable: rows.filter(r => r.metric === code && r.applicable).length,
    full: rows.filter(r => r.metric === code && r.score === 1).length,
    zero: rows.filter(r => r.metric === code && r.score === 0).length,
    unknown: rows.filter(r => r.metric === code && r.applicable && r.score === null).length}))}));
