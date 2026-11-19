import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {completeProductPercent, completeBlockPercent, isDdIndexMetricForPeriod, maturityLevelName} from '../../gravity-app/src/domain/report.js';
import {buildSummaryPeriodData} from '../../gravity-app/src/domain/summaryPeriod.js';
import {buildSummaryRadarData} from '../../gravity-app/src/domain/summaryRadar.js';

// This is a separate counterfactual. It never writes source data or app files.
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = dirname(fileURLToPath(import.meta.url));
const period = 'III кв. 2026';
const cutoff = '2026-10-30';
const files = new Map();
function text(path) {
  const content = readFileSync(resolve(root, path), 'utf8');
  files.set(path, createHash('sha256').update(content).digest('hex'));
  return content;
}
const read = path => JSON.parse(text(path));
const flatten = product => product.metrics.flatMap(block => block.metrics);
const originalId = product => product.id.replace(/::empty::.*/, '');
const teamKey = product => [originalId(product), product.name, product.unit, product.type].join('\u001f');
const pairKey = (product, code) => `${teamKey(product)}\u001f${code}`;
const mean = values => values.length ? values.reduce((a,b) => a+b, 0) / values.length : null;
const historicalSources = [
  'segment-user-assessments-q3-2026.json',
  'knowledge-user-assessments-q3-2026.json',
  'pb-nonfinancial-knowledge-q3-2026.json',
  'pb-navigator-knowledge-q3-2026.json',
  'working-age-fot-knowledge-q3-2026.json',
  'navigator-market-knowledge-q3-2026.json',
  'navigator-mau-knowledge-q3-2026.json',
];

export function runScenario() {
  const data = read('gravity-app/public/report-data.json');
  const app = text('gravity-app/src/app/App.jsx');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1],m[2]]));
  const overlayFiles = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => `gravity-app/src/data/${imports.get(key.trim())}`);
  const overlays = overlayFiles.map(read);
  const args = ['salary-products-q3-2026.json','reporting-regularity-missing-q3-2026.json','funnel-action-missing-q3-2026.json'].map(file => read(`gravity-app/src/data/${file}`));
  const backlog = read('gravity-app/public/backlog-data.json');
  const sourceSnapshot = structuredClone(data);
  const overlaySnapshot = structuredClone(overlays);
  const current = buildDdiPeriodProducts(data.products, period, overlays, ...args, backlog);
  const historic = [];
  for (const file of historicalSources) {
    const batch = read(`gravity-app/src/data/${file}`);
    for (const product of batch.products || []) {
      if (!['Канал','Сегмент'].includes(product.type)) continue;
      for (const [code,fact] of Object.entries(product.metrics)) {
        if (!code.startsWith('general.')) continue;
        const date = fact.source?.date || batch.source?.date;
        assert.equal(date, cutoff, `${product.name}/${code}: explicit cutoff date`);
        assert.ok([0,0.5,1].includes(fact.rawValue));
        historic.push({id:product.id,name:product.name,unit:product.unit,type:product.type,code,rawValue:fact.rawValue,date,
          sourceFile:`gravity-app/src/data/${file}`,source:fact.source,
          evidenceKind: ['navigator-market-knowledge-q3-2026.json','navigator-mau-knowledge-q3-2026.json'].includes(file)
            ? 'materializedUserConfirmedRule' : 'directUserAssessment'});
      }
    }
  }
  assert.equal(historic.length,28);
  const pairs = new Map(historic.map(fact => [pairKey(fact,fact.code),fact]));
  assert.equal(pairs.size,28);
  // October 29 contains exactly the same 21 segment facts, all superseded by
  // October 30 confirmation; it contributes no extra pair to the cutoff state.
  const earlier = read('gravity-app/src/data/user-metric-assessments-q3-2026.json');
  let duplicates = 0;
  for (const product of earlier.products) if (['Канал','Сегмент'].includes(product.type)) {
    for (const [code,fact] of Object.entries(product.metrics)) if (code.startsWith('general.')) {
      assert.equal(pairs.get(pairKey(product,code))?.rawValue,fact.rawValue);
      duplicates++;
    }
  }
  assert.equal(duplicates,21);
  const applied = [];
  const scenario = current.map(product => ({...product,metrics:product.metrics.map(block => ({...block,
    metrics:block.metrics.map(metric => {
      const fact = block.code === 'general' ? pairs.get(pairKey(product,metric.code)) : null;
      if (!fact) return metric;
      assert.ok(metric.is_applicabble_flg !== false && metric.max_value > 0, `${product.name}/${metric.code}: applicable`);
      const value = fact.rawValue * metric.max_value;
      applied.push({...fact,metricName:metric.name ?? metric.title ?? null,currentValue:metric.value,
        restoredValue:value,maxValue:metric.max_value,currentRawValue:metric.value === null ? null : metric.value/metric.max_value,
        valueChanged:metric.value !== value,currentSource:metric.source});
      return {...metric,value,source:{...fact.source,scenarioOnly:true,sourceFile:fact.sourceFile,restoredAsOf:cutoff},
        ...(metric.recommendation_items ? {recommendation_items:metric.recommendation_items.map(item => ({...item,value,
          max_value:metric.max_value,gap:metric.max_value-value}))} : {})};
    })}))}));
  assert.equal(applied.length,28);
  // Assert identity, roster, weights, applicability, all other scores and metadata.
  for (let i=0;i<current.length;i++) {
    const {metrics:before,...identityBefore}=current[i], {metrics:after,...identityAfter}=scenario[i];
    assert.deepEqual(identityAfter,identityBefore);
    for(let b=0;b<before.length;b++) for(let m=0;m<before[b].metrics.length;m++) {
      const old=before[b].metrics[m],next=after[b].metrics[m];
      if(!pairs.has(pairKey(current[i],old.code))) assert.deepEqual(next,old);
      else {
        const {value:v1,source:s1,recommendation_items:r1,...rest1}=old;
        const {value:v2,source:s2,recommendation_items:r2,...rest2}=next;
        assert.deepEqual(rest2,rest1);
      }
    }
  }
  assert.deepEqual(data,sourceSnapshot); assert.deepEqual(overlays,overlaySnapshot);
  assert.deepEqual(buildDdiPeriodProducts(data.products,'II кв. 2026',overlays,...args,backlog),data.products);
  const elk = scenario.find(p => p.name === 'Единый личный кабинет (ЕЛК)');
  assert.equal(flatten(elk).find(m=>m.code==='general.mau_u_vashego_kanala').source.date,'2026-11-11');
  assert.equal(flatten(elk).find(m=>m.code==='general.mau_u_vashego_kanala').value,0.2);

  function score(product) {
    const metrics=flatten(product).filter(m=>isDdIndexMetricForPeriod(m,period));
    const sum=metrics.reduce((s,m)=>s+(m.value??0),0),max=metrics.reduce((s,m)=>s+m.max_value,0);
    const rounded=completeProductPercent(product);
    const general=product.metrics.find(b=>b.code==='general');
    return {points:sum,maxPoints:max,raw:rounded===null?null:sum/max*100,rounded,
      level:rounded===null?'Нет данных':maturityLevelName(rounded),general:completeBlockPercent(general,period)};
  }
  const currentRows=buildSummaryPeriodData(data.products,data.title.rows,current,period).rows;
  const scenarioRows=buildSummaryPeriodData(data.products,data.title.rows,scenario,period).rows;
  const teams=current.map((product,index)=>{
    const before=score(product),after=score(scenario[index]);
    assert.equal(currentRows[index].score,before.rounded); assert.equal(scenarioRows[index].score,after.rounded);
    const facts=applied.filter(f=>teamKey(f)===teamKey(product));
    return {id:originalId(product),name:product.name,unit:product.unit,type:product.type,
      factsRestored:facts.length,metricsChanged:facts.filter(f=>f.valueChanged).length,current:before,scenario:after,
      rawDelta:before.raw===null||after.raw===null?null:after.raw-before.raw,
      roundedDelta:before.rounded===null||after.rounded===null?null:after.rounded-before.rounded,
      levelChanged:before.level!==after.level};
  });
  function aggregate(scope) {
    const selected=teams.filter(scope),first=selected.map(t=>t.current.rounded).filter(Number.isFinite),second=selected.map(t=>t.scenario.rounded).filter(Number.isFinite);
    const before=mean(first),after=mean(second);
    const levels = key => Object.fromEntries([...new Set(selected.map(team=>team[key].level))]
      .map(level=>[level,selected.filter(team=>team[key].level===level).length]));
    return {teams:selected.length,scoredCurrent:first.length,scoredScenario:second.length,
      current:{meanOfRounded:before,dashboardRounded:before===null?null:Math.round(before),meanOfRaw:mean(selected.map(t=>t.current.raw).filter(Number.isFinite)),levels:levels('current')},
      scenario:{meanOfRounded:after,dashboardRounded:after===null?null:Math.round(after),meanOfRaw:mean(selected.map(t=>t.scenario.raw).filter(Number.isFinite)),levels:levels('scenario')},
      meanOfRoundedDelta:after-before,dashboardRoundedDelta:Math.round(after)-Math.round(before)};
  }
  const currentGeneral=buildSummaryRadarData(current,period,'',[{code:'general',name:'Знание ключевых метрик'}]).points[0].b2c;
  const scenarioGeneral=buildSummaryRadarData(scenario,period,'',[{code:'general',name:'Знание ключевых метрик'}]).points[0].b2c;
  const result={scenario:'Restore 28 explicit/materialized October 30 general assessments for channels and segments only',
    period,cutoff,productionModified:false,method:{baseline:'Current App.jsx Q3_OVERLAYS through buildDdiPeriodProducts with backlog-data ready; includes ELK MAU Nov11.',
      counterfactual:'Apply only 28 historical general facts to the final runtime result. Preserve all other current rules and scores; no full historical app rollback, no recomputation of unrelated derived values.',
      teamDdi:'Existing completeProductPercent: applicable scored index metric points / applicable maxima, rounded to integer. Null/incomplete teams excluded from dashboard averages.',
      overallDdi:'DashboardPage: arithmetic mean of rounded team DDI for scored teams, then rounded to integer. meanOfRounded exposes the sub-point movement; meanOfRaw is supplementary.',
      levels:'Existing maturityLevelName of rounded score: <40 attention, 40–60 developing, 61–80 mature, >80 leader.',
      earlierDuplicates:duplicates,materializedRuleFacts:3,
      exclusions:['Product teams','General values without an explicit selected Oct30 fact','Workbook October28 Q2 carry facts','October31 channel overrides','Later assessments as historical sources'],
      caveat:'Three channel Navigator values are materialized user-confirmed rules (ELK market, SBOL/Notifications MAU), rather than direct answer rows. Included as original October30 assessments. Latest ELK MAU November11 remains 100%.'},
    summary:{factsRestored:applied.length,factsValueChanged:applied.filter(f=>f.valueChanged).length,
      teamsWithFacts:teams.filter(t=>t.factsRestored).length,teamsWithMetricChanges:teams.filter(t=>t.metricsChanged).length,
      teamsWithRoundedDdiChanges:teams.filter(t=>t.roundedDelta).length,teamsWithRawDdiChanges:teams.filter(t=>Math.abs(t.rawDelta??0)>1e-10).length,
      teamsWithLevelChanges:teams.filter(t=>t.levelChanged).length,
      overall:aggregate(()=>true),segments:aggregate(t=>t.type==='Сегмент'),channels:aggregate(t=>t.type==='Канал'),
      selectedTeams:aggregate(t=>t.factsRestored>0),generalRadar:{current:currentGeneral,scenario:scenarioGeneral,delta:scenarioGeneral-currentGeneral}},
    sourceFiles:historicalSources.map(file=>({file:`gravity-app/src/data/${file}`,facts:historic.filter(f=>f.sourceFile.endsWith(file)).length})),
    facts:applied,teams,inputSha256:Object.fromEntries(files),
    assertions:{factCount28:true,earlier21SameValuedDuplicates:true,sourceAndOverlaysImmutable:true,
      currentRosterIdentityWeightsApplicabilityPreserved:true,nonselectedMetricsUnchanged:true,q2Unchanged:true,latestElkMau100Preserved:true}};
  return {result,current,scenario};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const {result}=runScenario();
  writeFileSync(resolve(out,'scenario.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result.summary,null,2));
  console.log(JSON.stringify(result.teams.filter(t=>t.metricsChanged),null,2));
}
