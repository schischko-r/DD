import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildDdiPeriodProducts} from '../src/domain/quarterProfiles.js';
import {blockPercent} from '../src/domain/report.js';
import {summarizeRows} from '../src/funnel-report/report-model.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '../..');
const directory = path.resolve(scriptDirectory, '../src/funnel-report');
const read = file => fs.readFileSync(path.resolve(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const hash = content => createHash('sha256').update(content).digest('hex');
const period = 'III кв. 2026';
const baselinePath = 'gravity-app/src/funnel-report/report-data.json';
const baselineDetailPath = 'gravity-app/src/funnel-report/detail-data.json';
const baseline = json(baselinePath), baselineDetail = json(baselineDetailPath);
const baselineProductsPath = 'tests/fixtures/ddi/ddi-funnel-analysis-2026-10-20/standalone-data.json';
const baselineProducts = json(baselineProductsPath).products;
assert.deepEqual(baseline.blocks, json('tests/fixtures/ddi/ddi-funnel-analysis-2026-10-20/analysis.json').blocks);
assert.deepEqual(baseline.thresholds, {poor:'<40%',middle:'40–80% inclusive',good:'>80%'});

const appPath = 'gravity-app/src/app/App.jsx', app = read(appPath);
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], `gravity-app/src/data/${m[2]}`]));
const resolveImport = name => {assert.ok(imports.has(name), `Missing App import ${name}`); return imports.get(name);};
const overlayPaths = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(name => resolveImport(name.trim()));
const configPaths = ['salaryProductsQ32026','reportingMissingQ32026','funnelActionMissingQ32026'].map(resolveImport);
const rawPath = 'gravity-app/public/report-data.json', backlogPath = 'gravity-app/public/backlog-data.json';
const products = buildDdiPeriodProducts(json(rawPath).products, period, overlayPaths.map(json), ...configPaths.map(json), json(backlogPath));
const sourceId = row => String(row.sourceTeamId || row.id).replace(/::empty::.*/, '');
assert.equal(new Set(products.map(sourceId)).size, products.length);
const identity = product => ({id:product.id,sourceTeamId:sourceId(product),team:product.name,unit:product.unit,type:product.type,period:product.period});
const validMetric = metric => metric.is_applicabble_flg !== false && Number.isFinite(metric.max_value) && metric.max_value > 0 && Number.isFinite(metric.value);
const singleMetricCodes = {
  analysis:{attract:'attract.funnel_analysis',churn:'churn.funnel_analysis'},
  actions:{attract:'attract.initiatives_list',churn:'churn.deviation_actions'},
  benchmarks:{attract:'attract.benchmarks',churn:'churn.benchmarks'},
};
const metricSubgroups = {reporting:'Отчетность',campaigning:'Кампейнинг'};
const compact = rows => {
  const {n,levels} = summarizeRows(rows);
  assert.equal(new Set(rows.map(sourceId)).size,n);
  assert.equal(levels.reduce((sum,level)=>sum+level.count,0),n);
  if (n) assert.ok(Math.abs(levels.reduce((sum,level)=>sum+level.share,0)-100)<1e-9);
  return {n,levels,rows};
};
const result = {
  periods:{baseline:'II кв. 2026',current:period},
  asOf:'2026-11-19',
  thresholds:{poorBelow:40,goodAbove:80},
  cohorts:{baseline:baseline.totalTeams,current:products.length},
  definitions:{
    thresholds:'Плохо: оценка <40%; посередине: 40–80% включительно; хорошо: >80%. Пороги исходного отчёта II квартала сохранены.',
    score:'Оценка команды округлена до целого процента до применения порогов, как в исходном отчёте II квартала.',
    delta:'Доля категории III квартала минус доля той же категории II квартала, в процентных пунктах. Знаменатель — все применимые команды отдельного квартала и среза; состав может отличаться.',
    total:'Сумма Number(value || 0) / сумма Number(max_value || 0) по всему блоку, как исходный blockPercent II квартала. Полностью неприменимый блок исключается.',
    completeness:'Только attract.report_completeness либо churn.report_completeness; без настройки и регулярности.',
    reporting:'Все заполненные применимые метрики подгруппы Отчетность; dd_calculation_flg не фильтруется, как в исходном отчёте II квартала.',
    analysis:'Только attract.funnel_analysis либо churn.funnel_analysis — проведение комплексного анализа соответствующей воронки.',
    actions:'Привлечение: attract.initiatives_list — составлен перечень инициатив; отток: churn.deviation_actions — мероприятия по работе с отклонениями.',
    benchmarks:'Только attract.benchmarks либо churn.benchmarks — наличие бенчмарков соответствующей воронки.',
    campaigning:'Все заполненные применимые метрики подгруппы Кампейнинг в блоке привлечения: сумма баллов / сумма максимумов, с округлением до целого процента.',
  },
  scopes:{},
};
const currentBlocks = {};
for (const code of ['attract','churn']) {
  const rows = [], excluded = [];
  for (const product of products) {
    const base = identity(product), block = product.metrics.find(item=>item.code===code);
    if (!block) {excluded.push({...base,reason:'Блок отсутствует'}); continue;}
    const max = block.metrics.reduce((sum,metric)=>sum+Number(metric.max_value||0),0);
    if (max <= 0 || !block.metrics.some(metric=>metric.is_applicabble_flg!==false)) {
      excluded.push({...base,reason:'Блок неприменим, максимум 0'}); continue;
    }
    const missing = block.metrics.filter(metric=>metric.is_applicabble_flg!==false&&metric.max_value>0&&!Number.isFinite(metric.value));
    assert.equal(missing.length,0,`Missing applicable total metrics: ${product.name}/${code}`);
    const earned = block.metrics.reduce((sum,metric)=>sum+Number(metric.value||0),0);
    const pct = blockPercent(block);
    assert.ok(Number.isFinite(pct)&&pct>=0&&pct<=100);
    rows.push({...base,earned,max,rawPct:100*earned/max,pct});
  }
  currentBlocks[code] = {rows,excluded};
}
function baselineMetric(code,scope) {
  const included = new Set(baseline.blocks[code].rows.map(row=>row.id));
  const rows = [], excluded = [];
  for (const product of baselineProducts) {
    const base = identity(product);
    if (!included.has(product.id)) {excluded.push({...base,reason:'Вне применимой выборки блока'}); continue;}
    const candidates = product.metrics.find(block=>block.code===code)?.metrics.filter(metric=>metricSubgroups[scope]
      ? metric.metric_subgroup===metricSubgroups[scope] : metric.code===singleMetricCodes[scope][code]) || [];
    if (singleMetricCodes[scope]) assert.ok(candidates.length<=1,`Duplicate baseline metric: ${product.name}/${scope}/${code}`);
    const metrics = candidates.filter(validMetric);
    if (!metrics.length) {excluded.push({...base,reason:'Нет применимой заполненной метрики'}); continue;}
    const earned = metrics.reduce((sum,metric)=>sum+metric.value,0), max = metrics.reduce((sum,metric)=>sum+metric.max_value,0);
    const rawPct = 100*earned/max;
    const pct = Math.max(0,Math.min(100,Math.round(rawPct)));
    rows.push({...base,earned,max,rawPct,pct,metricCodes:metrics.map(metric=>metric.code)});
  }
  return {rows,excluded};
}
for (const [scope,title] of [['total','Воронка целиком'],['completeness','Полнота'],['reporting','Отчётность'],['analysis','Анализ воронки'],['actions','Инициативы и мероприятия'],['benchmarks','Наличие бенчмарков'],['campaigning','Кампейнинг']]) {
  result.scopes[scope] = {title,blocks:{}};
  for (const code of scope==='campaigning'?['attract']:['attract','churn']) {
    let rows = currentBlocks[code].rows, excluded = currentBlocks[code].excluded;
    if (scope !== 'total') {
      const included = new Set(currentBlocks[code].rows.map(row=>row.id));
      rows = []; excluded = [];
      for (const product of products) {
        const base = identity(product);
        if (!included.has(product.id)) {excluded.push({...base,reason:'Вне применимой выборки блока'}); continue;}
        const candidates = product.metrics.find(block=>block.code===code).metrics.filter(metric=>metricSubgroups[scope]
          ? metric.metric_subgroup===metricSubgroups[scope] : metric.code===(singleMetricCodes[scope]?.[code]||`${code}.report_completeness`));
        if (singleMetricCodes[scope]) assert.ok(candidates.length<=1,`Duplicate current metric: ${product.name}/${scope}/${code}`);
        const metrics = candidates.filter(validMetric);
        if (!metrics.length) {excluded.push({...base,reason:'Нет применимых заполненных метрик'}); continue;}
        const missing = candidates.filter(metric=>metric.is_applicabble_flg!==false&&metric.max_value>0&&!Number.isFinite(metric.value));
        assert.equal(missing.length,0,`Missing applicable detail metrics: ${product.name}/${scope}/${code}`);
        const earned = metrics.reduce((sum,metric)=>sum+metric.value,0), max = metrics.reduce((sum,metric)=>sum+metric.max_value,0);
        const rawPct = 100*earned/max, pct = Math.max(0,Math.min(100,Math.round(rawPct)));
        rows.push({...base,earned,max,rawPct,pct,metricCodes:metrics.map(metric=>metric.code)});
      }
    }
    const old = scope==='total' ? baseline.blocks[code] : singleMetricCodes[scope] || scope==='campaigning' ? baselineMetric(code,scope) : baselineDetail.scopes[scope].blocks[code];
    const before = compact(old.rows), after = compact(rows);
    assert.equal(after.n+excluded.length,products.length);
    assert.equal(before.n+old.excluded.length,baseline.totalTeams);
    result.scopes[scope].blocks[code] = {baseline:before,current:after,
      deltas:after.levels.map((level,index)=>({label:level.label,deltaPp:level.share-before.levels[index].share})),
      excluded:{baseline:old.excluded,current:excluded}};
  }
}
const output = JSON.stringify(result,null,2)+'\n';
fs.writeFileSync(path.join(directory,'current-data.json'),output);
const inputs = new Set([baselinePath,baselineDetailPath,baselineProductsPath,appPath,rawPath,backlogPath,...overlayPaths,...configPaths]);
function collect(file) {
  if (inputs.has(file)) return;
  inputs.add(file);
  for (const match of read(file).matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));
    if (/\.(js|mjs|json)$/.test(dependency)) collect(dependency);
  }
}
collect('gravity-app/src/domain/quarterProfiles.js');
collect('gravity-app/src/domain/report.js');
collect('gravity-app/src/funnel-report/report-model.js');
fs.writeFileSync(path.join(directory,'current-provenance.json'),JSON.stringify({asOf:result.asOf,overlayPaths,configPaths,
  command:'node gravity-app/scripts/generate-funnel-levels.mjs',
  inputs:[...inputs].sort().map(file=>({file,sha256:hash(read(file))})),output:{file:'current-data.json',sha256:hash(output)}},null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.scopes).map(([scope,data])=>[scope,Object.fromEntries(Object.entries(data.blocks).map(([code,values])=>[code,{baseline:values.baseline.n,current:values.current.n,levels:values.current.levels,deltas:values.deltas}]))])),null,2));
