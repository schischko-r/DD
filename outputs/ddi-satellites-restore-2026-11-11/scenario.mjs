import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {completeProductPercent, displayProductName, isDdIndexMetricForPeriod, maturityLevelName} from '../../gravity-app/src/domain/report.js';
import {buildSummaryPeriodData} from '../../gravity-app/src/domain/summaryPeriod.js';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = dirname(fileURLToPath(import.meta.url));
const period = 'III кв. 2026';
const code = 'general.znanie_produktov_sputnikov';
const collator = new Intl.Collator('en', {sensitivity: 'base', numeric: true});
const digest = value => createHash('sha256').update(value).digest('hex');
const inputs = new Map();
function text(path) {
  const value = readFileSync(resolve(root,path),'utf8');
  inputs.set(path,digest(value));
  return value;
}
const read = path => JSON.parse(text(path));
const flatten = product => product.metrics.flatMap(block=>block.metrics);
const identity = product => [String(product.id).replace(/::empty::.*/,''),product.name,product.unit,product.type].join('\u001f');
const average = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
function productionHashes() {
  const files = execFileSync('git',['ls-files','-z','--','gravity-app/src','gravity-app/scripts',
    'gravity-app/public','gravity-app/package.json','gravity-app/package-lock.json','gravity-app/vite*.js'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
  return Object.fromEntries(files.map(file=>[file,digest(readFileSync(resolve(root,file)))]));
}

export function runScenario() {
  const productionBefore = productionHashes();
  const source = read('gravity-app/public/report-data.json');
  const app = text('gravity-app/src/app/App.jsx');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
    .map(key=>read(`gravity-app/src/data/${imports.get(key.trim())}`));
  const args = ['salary-products-q3-2026.json','reporting-regularity-missing-q3-2026.json','funnel-action-missing-q3-2026.json']
    .map(file=>read(`gravity-app/src/data/${file}`));
  const backlog = read('gravity-app/public/backlog-data.json');
  const sourceSnapshot = structuredClone(source), overlaySnapshot = structuredClone(overlays);
  const build = (selectedPeriod=period) => buildDdiPeriodProducts(source.products,selectedPeriod,overlays,...args,backlog);
  const current = build();
  const currentSnapshot = structuredClone(current);
  const q2 = build('II кв. 2026');
  const historicalFile = 'gravity-app/src/data/all-satellites-knowledge-q3-2026.json';
  const historical = read(historicalFile);
  assert.equal(historical.source.date,'2026-10-30');
  assert.equal(historical.products.length,54);
  const history = new Map(historical.products.map(product=>[identity(product),product]));
  assert.equal(history.size,54);
  const facts = [], excluded = [];
  const scenario = current.map(product=>{
    const historicalTeam = history.get(identity(product));
    if (!historicalTeam) return product;
    const fact = historicalTeam.metrics[code];
    assert.equal(fact.rawValue,1);
    const target = product.metrics.find(block=>block.code==='general')?.metrics.find(metric=>metric.code===code);
    if (!target || target.is_applicabble_flg===false || !(target.max_value>0)) {
      excluded.push({id:product.id,name:product.name,unit:product.unit,type:product.type,
        reason:!target?'metricMissing':'metricNotApplicable'});
      return product;
    }
    const classification = target.value===null ? 'unavailable' : target.value===target.max_value ? 'alreadyFull'
      : target.value===0 ? 'zero' : target.value>0&&target.value<target.max_value ? 'partial' : 'invalid';
    assert.notEqual(classification,'invalid');
    facts.push({id:product.id,name:product.name,unit:product.unit,type:product.type,code,
      classification,currentValue:target.value,maxValue:target.max_value,
      currentRaw:target.value===null?null:target.value/target.max_value,scenarioValue:target.max_value,
      valueChanged:target.value!==target.max_value,currentSource:target.source,
      historicalFile,historicalRaw:fact.rawValue,historicalSource:fact.source});
    if(target.value===target.max_value) return product;
    return {...product,metrics:product.metrics.map(block=>block.code!=='general'?block:{...block,
      metrics:block.metrics.map(metric=>metric.code!==code?metric:{...metric,value:metric.max_value,
        source:{...fact.source,scenarioOnly:true,historicalFile,scenarioDate:'2026-11-11'},
        ...(metric.recommendation_items?{recommendation_items:metric.recommendation_items.map(item=>({...item,
          value:metric.max_value,max_value:metric.max_value,gap:0}))}:{})})})};
  });
  assert.equal(current.length,76); assert.equal(facts.length,54); assert.equal(excluded.length,0);
  assert.deepEqual(current,currentSnapshot); assert.deepEqual(source,sourceSnapshot); assert.deepEqual(overlays,overlaySnapshot);
  let changedMetricCount=0;
  for(let i=0;i<current.length;i++) {
    const {metrics:oldBlocks,...oldIdentity}=current[i],{metrics:newBlocks,...newIdentity}=scenario[i];
    assert.deepEqual(newIdentity,oldIdentity);
    for(let b=0;b<oldBlocks.length;b++) {
      const {metrics:oldMetrics,...oldBlock}=oldBlocks[b],{metrics:newMetrics,...newBlock}=newBlocks[b];
      assert.deepEqual(newBlock,oldBlock);assert.equal(oldMetrics.length,newMetrics.length);
      for(let m=0;m<oldMetrics.length;m++) {
        const before=oldMetrics[m],after=newMetrics[m];
        if(before.value===after.value) {assert.deepEqual(after,before);continue;}
        assert.equal(before.code,code);assert.ok(history.has(identity(current[i])));changedMetricCount++;
        const {value:v1,source:s1,recommendation_items:r1,...rubric1}=before;
        const {value:v2,source:s2,recommendation_items:r2,...rubric2}=after;
        assert.deepEqual(rubric2,rubric1);assert.equal(after.value,after.max_value);
      }
    }
  }
  assert.equal(changedMetricCount,facts.filter(f=>f.valueChanged).length);
  assert.deepEqual(build('II кв. 2026'),q2);assert.deepEqual(q2,source.products);
  function score(product) {
    const metrics=flatten(product).filter(metric=>isDdIndexMetricForPeriod(metric,period));
    const missing=metrics.filter(metric=>!Number.isFinite(metric.value)).map(metric=>metric.code);
    const rounded=completeProductPercent(product),points=metrics.reduce((sum,metric)=>sum+(metric.value??0),0),maximum=metrics.reduce((sum,metric)=>sum+metric.max_value,0);
    return {rounded,raw:rounded===null?null:points/maximum*100,points,maxPoints:maximum,missingMetrics:missing,
      level:rounded===null?'Нет данных':maturityLevelName(rounded)};
  }
  const teams=current.map((product,index)=>({id:product.id,name:product.name,displayName:displayProductName(product.name),unit:product.unit,type:product.type,
    metric:facts.find(f=>identity(f)===identity(product))??null,current:score(product),scenario:score(scenario[index])}));
  for(const [key,products]of [['current',current],['scenario',scenario]]) {
    const rows=buildSummaryPeriodData(source.products,source.title.rows,products,period).rows;
    for(let i=0;i<teams.length;i++) assert.equal(rows[i].score,teams[i][key].rounded);
    for(const [rankKey,subset]of [['allB2C',teams],['products',teams.filter(t=>t.type==='Продукт')]]) {
      const ranked=subset.filter(t=>Number.isFinite(t[key].rounded)).sort((a,b)=>(b[key].rounded-a[key].rounded)||collator.compare(a.name,b.name));
      for(const [index,team]of ranked.entries()) {
        team[key].ranks??={};team[key].ranks[rankKey]={competition:1+ranked.filter(other=>other[key].rounded>team[key].rounded).length,
          ordinal:index+1,population:ranked.length};
      }
    }
  }
  for(const team of teams) {
    team.scoreChanged=team.current.rounded!==team.scenario.rounded;
    team.rawScoreDelta=team.current.raw===null||team.scenario.raw===null?null:team.scenario.raw-team.current.raw;
    team.roundedScoreDelta=team.current.rounded===null||team.scenario.rounded===null?null:team.scenario.rounded-team.current.rounded;
    team.levelChanged=team.current.level!==team.scenario.level;
    team.anyUniverseOrRankingMethodChanged=JSON.stringify(team.current.ranks)!==JSON.stringify(team.scenario.ranks);
  }
  const rankingMovements = Object.fromEntries(['allB2C','products'].map(universe=>[universe,
    Object.fromEntries(['competition','ordinal'].map(kind=>{
      const moved=teams.filter(team=>team.current.ranks?.[universe]
        && team.current.ranks[universe][kind]!==team.scenario.ranks[universe][kind]);
      return [kind,{total:moved.length,metricChanged:moved.filter(team=>team.metric?.valueChanged).length,
        metricUnchanged:moved.filter(team=>!team.metric?.valueChanged).length,
        teams:moved.map(team=>({id:team.id,name:team.name,displayName:team.displayName,
          metricValueChanged:team.metric?.valueChanged??false,current:team.current.ranks[universe][kind],scenario:team.scenario.ranks[universe][kind]}))}];
    }))]));
  function aggregate(subset) {
    const stages={};for(const key of ['current','scenario']) {
      const rounded=subset.map(t=>t[key].rounded).filter(Number.isFinite),raw=subset.map(t=>t[key].raw).filter(Number.isFinite);
      const levels=Object.fromEntries([...new Set(subset.map(t=>t[key].level))].map(level=>[level,subset.filter(t=>t[key].level===level).length]));
      stages[key]={scored:rounded.length,unscored:subset.length-rounded.length,meanOfRounded:average(rounded),dashboardRounded:Math.round(average(rounded)),
        meanOfRaw:average(raw),levels};
    }
    return {population:subset.length,...stages,meanOfRoundedDelta:stages.scenario.meanOfRounded-stages.current.meanOfRounded,
      dashboardRoundedDelta:stages.scenario.dashboardRounded-stages.current.dashboardRounded,
      pairedCohortMeanOfRoundedDelta:average(subset.filter(t=>Number.isFinite(t.current.rounded)&&Number.isFinite(t.scenario.rounded)).map(t=>t.scenario.rounded-t.current.rounded))};
  }
  const counts=Object.fromEntries(['alreadyFull','zero','partial','unavailable'].map(key=>[key,facts.filter(f=>f.classification===key).length]));
  const origins=Object.fromEntries([...new Set(facts.map(f=>f.currentSource?.origin??'none'))].map(origin=>[origin,
    {total:facts.filter(f=>(f.currentSource?.origin??'none')===origin).length,
      valueChanged:facts.filter(f=>(f.currentSource?.origin??'none')===origin&&f.valueChanged).length}]));
  assert.deepEqual(productionHashes(),productionBefore);
  const result={period,metricCode:code,scenarioOnly:true,productionModified:false,
    method:{baseline:'Full current App.jsx Q3_OVERLAYS -> buildDdiPeriodProducts, backlog ready, latest Children Navigator and 34 approved facts retained.',
      scope:'Only matching historical all-satellites October30 raw1 facts with an existing applicable positive-weight metric. Set that single metric to its existing maximum on cloned runtime results. No Navigator or other dependent recalculation.',
      teamScore:'Existing completeProductPercent. Any missing applicable index answer -> null; otherwise points/max*100 rounded to integer. Raw score included separately.',
      aggregate:'Existing dashboard: mean of rounded team DDI among scored teams, then integer rounding. Separate meanOfRaw is supplementary. Coverage/paired-cohort movement is explicit.',
      ranking:'Competition rank = 1 + number of teams with strictly higher ROUNDED DDI. Ordinal = score descending, then existing en collator with sensitivity base/numeric true. Separate universes: all76 B2C and60 products; unscored teams unranked.',
      maturity:'Existing maturityLevelName on rounded DDI: <40 attention; 40–60 developing; 61–80 mature; >80 leader.'},
    summary:{historicalFacts:history.size,eligibleFacts:facts.length,excludedHistoricalFacts:excluded.length,
      currentCounts:counts,metricValueChanges:changedMetricCount,teamsWithRoundedScoreChanges:teams.filter(t=>t.scoreChanged).length,
      teamsWithRawScoreChanges:teams.filter(t=>(t.rawScoreDelta??0)!==0).length,
      teamsWithMaturityChanges:teams.filter(t=>t.levelChanged).length,
      teamsWithAnyUniverseOrRankingMethodChanges:teams.filter(t=>t.anyUniverseOrRankingMethodChanged).length,
      unchangedScoreTeamsWithAnyUniverseOrRankingMethodChanges:teams.filter(t=>!t.scoreChanged&&t.anyUniverseOrRankingMethodChanged).length,
      unchangedMetricTeamsWithAnyUniverseOrRankingMethodChanges:teams.filter(t=>!t.metric?.valueChanged&&t.anyUniverseOrRankingMethodChanged).length,
      overall:aggregate(teams),products:aggregate(teams.filter(t=>t.type==='Продукт')),sourceOrigins:origins,rankingMovements},
    facts,excluded,unmatchedHistoricalTeams:historical.products.filter(p=>!current.some(team=>identity(team)===identity(p))).map(p=>({id:p.id,name:p.name,unit:p.unit,type:p.type})),
    teams,changedTeams:teams.filter(t=>t.metric?.valueChanged),unchangedScoreRankMovements:teams.filter(t=>!t.scoreChanged&&t.anyUniverseOrRankingMethodChanged),
    unchangedMetricRankMovements:teams.filter(t=>!t.metric?.valueChanged&&t.anyUniverseOrRankingMethodChanged),
    inputSha256:Object.fromEntries(inputs),productionFileSha256:productionBefore,
    assertions:{eligible54:true,roster76:true,onlySelectedMetricValuesChanged:true,weightsApplicabilityAndOtherFieldsUnchanged:true,
      noDependentMetricRecalculation:true,allOtherMetricsAndTheirSourcesUnchanged:true,currentSourceOverlaysImmutable:true,q2Unchanged:true,productionFilesUnchanged:true}};
  return {result,current,scenario};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const {result}=runScenario();
  writeFileSync(resolve(outputDir,'scenario.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result.summary,null,2));
  console.log(JSON.stringify(result.changedTeams.map(t=>({name:t.name,metric:t.metric.classification,current:t.current,scenario:t.scenario})),null,2));
}
