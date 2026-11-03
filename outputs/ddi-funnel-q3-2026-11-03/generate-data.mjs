import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {blockPercent} from '../../gravity-app/src/domain/report.js';
import {summarizeRows} from '../../gravity-app/src/funnel-report/report-model.js';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../..');
const period = 'III кв. 2026';
const blocks = ['attract', 'churn'];
const read = p => fs.readFileSync(path.resolve(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const write = (p, data) => fs.writeFileSync(path.join(out, p), JSON.stringify(data, null, 2) + '\n');
const hash = text => createHash('sha256').update(text).digest('hex');
const sourceId = p => String(p.sourceTeamId || p.id).replace(/::empty::.*/, '');
const identity = p => ({id: p.id, sourceTeamId: sourceId(p), team: p.team || p.name, unit: p.unit, type: p.type, period: p.period});
const level = pct => pct < 40 ? 'Плохо' : pct > 80 ? 'Хорошо' : 'Посередине';
const valid = m => m.is_applicabble_flg !== false && Number.isFinite(m.max_value) && m.max_value > 0 && Number.isFinite(m.value);
const baselinePath = 'gravity-app/src/funnel-report/report-data.json';
const detailPath = 'gravity-app/src/funnel-report/detail-data.json';
const baseline = json(baselinePath), baselineDetail = json(detailPath);
assert.deepEqual(baseline.blocks, json('outputs/ddi-funnel-analysis-2026-10-20/analysis.json').blocks, 'Q2 block calculations must equal original analysis');
fs.writeFileSync(path.join(out, 'baseline-report-data.json'), read(baselinePath));
fs.writeFileSync(path.join(out, 'baseline-detail-data.json'), read(detailPath));
const appPath = 'gravity-app/src/app/App.jsx', app = read(appPath);
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], `gravity-app/src/data/${m[2]}`]));
const overlayNames = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(s => s.trim());
const resolveImport = name => {assert.ok(imports.has(name), `Unresolved App import: ${name}`); return imports.get(name);};
const overlayPaths = overlayNames.map(resolveImport);
const configNames = ['salaryProductsQ32026', 'reportingMissingQ32026', 'funnelActionMissingQ32026'];
const configPaths = configNames.map(resolveImport);
assert.match(app, /buildDdiPeriodProducts\(data\?\.products \|\| \[\], summaryFilters.period, Q3_OVERLAYS, salaryProductsQ32026, reportingMissingQ32026, funnelActionMissingQ32026,\s*backlog.status === 'ready' \? backlog.data : null\)/);
const rawPath = 'gravity-app/public/report-data.json', backlogPath = 'gravity-app/public/backlog-data.json';
const raw = json(rawPath);
const products = buildDdiPeriodProducts(raw.products, period, overlayPaths.map(json), ...configPaths.map(json), json(backlogPath));
assert.ok(products.every(p => p.period === period));
assert.equal(new Set(products.map(sourceId)).size, products.length, 'Stable source IDs must be one-to-one after salary merge');
write('current-snapshot.json', {period, products});
const snapshotHash = hash(fs.readFileSync(path.join(out, 'current-snapshot.json')));
const oldProducts = json('outputs/ddi-funnel-analysis-2026-10-20/standalone-data.json').products;
const oldIds = new Set(oldProducts.map(sourceId)), currentIds = new Set(products.map(sourceId));
const cohort = {
  baselineTotal: oldProducts.length, currentTotal: products.length,
  matched: products.filter(p => oldIds.has(sourceId(p))).map(p => ({...identity(p), baselineId: oldProducts.find(b => sourceId(b) === sourceId(p)).id})),
  removedTeams: oldProducts.filter(p => !currentIds.has(sourceId(p))).map(identity),
  newTeams: products.filter(p => !oldIds.has(sourceId(p))).map(identity),
};
const report = {source: 'current-snapshot.json', sha256: snapshotHash, teams: products.map(p => ({...identity(p), name: p.name})), period, periods: [period], totalTeams: products.length,
  thresholds: baseline.thresholds, deduplication: baseline.deduplication,
  cohortNote: 'Текущие эффективные профили приложения III квартала; исходная база II квартала сохранена отдельно. Парная динамика только по стабильным sourceTeamId и доступным оценкам обоих периодов.', blocks: {}};
for (const code of blocks) {
  const rows = [], excluded = [];
  for (const p of products) {
    const b = p.metrics.find(b => b.code === code), base = identity(p);
    if (!b) {excluded.push({...base, reason: 'Блок отсутствует'}); continue;}
    assert.equal(new Set(b.metrics.map(m => m.code)).size, b.metrics.length, `Duplicate metric code: ${p.id}/${code}`);
    const earned = b.metrics.reduce((s, m) => s + Number(m.value || 0), 0);
    const max = b.metrics.reduce((s, m) => s + Number(m.max_value || 0), 0);
    if (max <= 0 || !b.metrics.some(m => m.is_applicabble_flg !== false)) {excluded.push({...base, reason: 'Блок неприменим, максимум 0'}); continue;}
    const pct = blockPercent(b);
    assert.ok(Number.isFinite(pct) && pct >= 0 && pct <= 100);
    assert.ok(Number.isFinite(earned) && Number.isFinite(max) && earned >= 0 && earned <= max);
    rows.push({...base, earned, max, rawPct: 100 * earned / max, pct, status: level(pct),
      missingMetricCodes: b.metrics.filter(m => m.is_applicabble_flg !== false && m.max_value > 0 && !Number.isFinite(m.value)).map(m => m.code)});
  }
  const summary = summarizeRows(rows);
  report.blocks[code] = {...summary, excluded, zeroCount: rows.filter(r => r.pct === 0).length, fullCount: rows.filter(r => r.pct === 100).length,
    uniquePercentValues: summary.frequencies.length, types: [...new Set(rows.map(r => r.type))].map(type => ({type, n: rows.filter(r => r.type === type).length}))};
  assert.equal(rows.length + excluded.length, products.length);
}
const detail = {source: {file: 'current-snapshot.json', sha256: snapshotHash, cohort: 'report-data.json'}, definitions: {...baselineDetail.definitions,
  cohort: 'Только команды текущей применимой выборки соответствующей воронки. Нет применимых заполненных метрик — исключение, а не нулевая оценка.',
  total: 'Исходный blockPercent: сумма Number(value || 0) / сумма Number(max_value || 0), округление до целого и ограничение 0–100. Это сознательно сохраняет семантику общего блока; пропуски раскрыты в missingMetricCodes.',
  partial: 'В деталях знаменатель содержит только применимые метрики с конечным числовым значением и положительным максимумом; частично заполненные строки сохраняются с missingMetricCodes. dd_calculation_flg не фильтрует подгруппу Отчетность.'}, scopes: {}};
for (const scope of ['reporting', 'completeness']) {
  detail.scopes[scope] = {title: baselineDetail.scopes[scope].title, description: baselineDetail.scopes[scope].description, blocks: {}};
  for (const code of blocks) {
    const includedIds = new Set(report.blocks[code].rows.map(r => r.id));
    const rows = [], excluded = [];
    for (const p of products) {
      const base = identity(p);
      if (!includedIds.has(p.id)) {excluded.push({...base, reason: 'Вне применимой выборки блока'}); continue;}
      const candidates = (p.metrics.find(b => b.code === code)?.metrics || []).filter(m => scope === 'reporting' ? m.metric_subgroup === 'Отчетность' : m.code === `${code}.report_completeness`);
      const metrics = candidates.filter(valid);
      const missingMetricCodes = candidates.filter(m => m.is_applicabble_flg !== false && m.max_value > 0 && !Number.isFinite(m.value)).map(m => m.code);
      if (!metrics.length) {excluded.push({...base, missingMetricCodes, reason: !candidates.length ? 'Метрика или подгруппа отсутствует' : 'Нет применимых метрик с заполненным значением и положительным максимумом'}); continue;}
      const earned = metrics.reduce((s, m) => s + m.value, 0), max = metrics.reduce((s, m) => s + m.max_value, 0), rawPct = 100 * earned / max;
      const pct = Math.max(0, Math.min(100, Math.round(rawPct)));
      assert.ok(Number.isFinite(rawPct) && rawPct >= 0 && rawPct <= 100);
      rows.push({...base, earned, max, rawPct, pct, status: level(pct), validMetricCodes: metrics.map(m => m.code), missingMetricCodes});
    }
    detail.scopes[scope].blocks[code] = {rows, excluded};
    assert.equal(rows.length + excluded.length, products.length);
  }
}
const compactSummary = rows => {const s = summarizeRows(rows); return {n: s.n, mean: s.mean, median: s.percentiles.P50, levels: s.levels};};
const change = (a, b) => a === null || b === null ? null : b - a;
const comparison = {schemaVersion: 1, periods: {baseline: 'II кв. 2026', current: period}, cohort,
  definitions: {...detail.definitions, deltaPp: 'current.pct - baseline.pct; процентные пункты по округлённым командным оценкам',
    relativePct: '100 * (current.pct - baseline.pct) / baseline.pct; null при baseline.pct === 0',
    aggregate: 'Все средние и медианы невзвешенные по командам; matched — одинаковые команды со значением в обоих периодах. meanChangePp/medianChangePp относятся к парной выборке, overallMeanChangePp/overallMedianChangePp — к полным разным выборкам.',
    caveat: 'Состав команд и применимость/заполненность метрик меняются; парность команд не гарантирует неизменный знаменатель метрик. Слияние зарплатных B2B/B2C повторяет текущий профиль приложения, а не даёт две команды.'}, scopes: {}};
for (const scope of ['total', 'reporting', 'completeness']) {
  comparison.scopes[scope] = {blocks: {}};
  for (const code of blocks) {
    const before = scope === 'total' ? baseline.blocks[code] : baselineDetail.scopes[scope].blocks[code];
    const after = scope === 'total' ? report.blocks[code] : detail.scopes[scope].blocks[code];
    const left = new Map(before.rows.map(r => [sourceId(r), {...r, sourceTeamId: sourceId(r)}]));
    const right = new Map(after.rows.map(r => [sourceId(r), r]));
    assert.equal(left.size, before.rows.length); assert.equal(right.size, after.rows.length);
    const pairs = [...left].filter(([id]) => right.has(id)).map(([id, baseline]) => {
      const current = right.get(id), deltaPp = current.pct - baseline.pct;
      return {sourceTeamId: id, baseline, current, deltaPp, relativePct: baseline.pct === 0 ? null : 100 * deltaPp / baseline.pct,
        denominatorChanged: baseline.max !== current.max};
    });
    const baselineOnly = [...left].filter(([id]) => !right.has(id)).map(([, r]) => r);
    const currentOnly = [...right].filter(([id]) => !left.has(id)).map(([, r]) => r);
    const b = compactSummary(before.rows), c = compactSummary(after.rows);
    const mb = compactSummary(pairs.map(p => p.baseline)), mc = compactSummary(pairs.map(p => p.current));
    const deltas = pairs.map(p => p.deltaPp).sort((a, b) => a - b), n = deltas.length;
    const meanPairChangePp = n ? deltas.reduce((a, b) => a + b, 0) / n : null;
    const medianPairChangePp = n ? (deltas[Math.floor((n - 1) / 2)] + deltas[Math.ceil((n - 1) / 2)]) / 2 : null;
    const shares = (x, y) => x.levels.map((l, i) => ({label: l.label, baselineCount: l.count, currentCount: y.levels[i].count, baselineShare: l.share, currentShare: y.levels[i].share, deltaPp: y.levels[i].share - l.share}));
    comparison.scopes[scope].blocks[code] = {counts: {baseline: b.n, current: c.n, matched: n, baselineOnly: baselineOnly.length, currentOnly: currentOnly.length, baselineExcluded: before.excluded.length, currentExcluded: after.excluded.length},
      baseline: b, current: c, matchedBaseline: mb, matchedCurrent: mc,
      meanChangePp: change(mb.mean, mc.mean), medianChangePp: change(mb.median, mc.median), meanPairChangePp, medianPairChangePp,
      overallMeanChangePp: change(b.mean, c.mean), overallMedianChangePp: change(b.median, c.median),
      levelShareChanges: shares(mb, mc), overallLevelShareChanges: shares(b, c), pairs, baselineOnly, currentOnly};
    assert.equal(n + baselineOnly.length, b.n); assert.equal(n + currentOnly.length, c.n);
  }
}
comparison.quality = Object.fromEntries(blocks.map(code => {
  const rows = report.blocks[code].rows;
  const rubricChanges = products.filter(p => oldIds.has(sourceId(p))).map(p => {
    const old = oldProducts.find(b => sourceId(b) === sourceId(p));
    const prior = new Map((old.metrics.find(b => b.code === code)?.metrics || []).map(m => [m.code, m]));
    const current = new Map((p.metrics.find(b => b.code === code)?.metrics || []).map(m => [m.code, m]));
    const changedMetrics = [...new Set([...prior.keys(), ...current.keys()])].flatMap(key => {
      const a = prior.get(key), b = current.get(key);
      return !a || !b || a.max_value !== b.max_value || a.is_applicabble_flg !== b.is_applicabble_flg
        ? [{code: key, baselineMax: a?.max_value ?? null, currentMax: b?.max_value ?? null,
          baselineApplicable: a ? a.is_applicabble_flg !== false : null, currentApplicable: b ? b.is_applicabble_flg !== false : null}] : [];
    });
    return {...identity(p), changedMetrics};
  }).filter(p => p.changedMetrics.length);
  return [code, {totalRowsWithMissing: rows.filter(r => r.missingMetricCodes.length).length,
    totalMissingMetrics: rows.reduce((s, r) => s + r.missingMetricCodes.length, 0), rubricChangedTeamCount: rubricChanges.length, rubricChanges,
    detailMissingness: Object.fromEntries(Object.entries(detail.scopes).map(([scope, s]) => [scope, {
      rowsWithMissing: s.blocks[code].rows.filter(r => r.missingMetricCodes.length).length,
      excludedWithMissing: s.blocks[code].excluded.filter(r => r.missingMetricCodes?.length).length,
    }]))}];
}));
write('report-data.json', report); write('detail-data.json', detail); write('comparison-data.json', comparison);
const dependencies = new Set([appPath, rawPath, backlogPath, baselinePath, detailPath, 'outputs/ddi-funnel-analysis-2026-10-20/analysis.json', 'outputs/ddi-funnel-analysis-2026-10-20/standalone-data.json', ...overlayPaths, ...configPaths]);
function collect(p) {
  if (dependencies.has(p)) return;
  dependencies.add(p);
  const text = read(p);
  for (const m of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const dep = path.posix.normalize(path.posix.join(path.posix.dirname(p), m[1]));
    if (/\.(js|mjs|json)$/.test(dep)) collect(dep);
  }
}
collect('gravity-app/src/domain/quarterProfiles.js'); collect('gravity-app/src/domain/report.js'); collect('gravity-app/src/funnel-report/report-model.js');
const generatedFiles = ['baseline-report-data.json', 'baseline-detail-data.json', 'current-snapshot.json', 'report-data.json', 'detail-data.json', 'comparison-data.json'];
write('provenance.json', {schemaVersion: 1, snapshotDate: '2026-11-03', command: 'node outputs/ddi-funnel-q3-2026-11-03/generate-data.mjs', node: process.version,
  rawSource: rawPath, app: appPath, overlayPaths, configPaths, backlog: {file: backlogPath, state: 'ready'},
  baselineSourceSnapshotHash: baseline.sha256, inputs: [...dependencies].sort().map(file => ({file, sha256: hash(read(file))})),
  generator: {file: path.relative(root, fileURLToPath(import.meta.url)), sha256: hash(fs.readFileSync(fileURLToPath(import.meta.url)))},
  outputs: generatedFiles.map(file => ({file, sha256: hash(fs.readFileSync(path.join(out, file)))}))});
console.log(JSON.stringify({cohort, comparisons: Object.fromEntries(Object.entries(comparison.scopes).map(([scope, s]) => [scope, Object.fromEntries(Object.entries(s.blocks).map(([code, b]) => [code, {counts: b.counts, baseline: b.baseline.mean, current: b.current.mean, matchedDeltaPp: b.meanChangePp}]))]))}, null, 2));
