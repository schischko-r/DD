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
const USER_SELECTION = [
  {id:'16a909e6-2a89-532d-b1df-1f749aff70c8¦ОСАГО',name:'ОСАГО',unit:'УБ',type:'Продукт'},
  {id:'11a243e6-5b73-56ad-8ac7-203e0d744062¦Оплата улыбкой',name:'Оплата улыбкой',unit:'DB',type:'Продукт'},
  {id:'9721f391-d1a5-57d5-beb1-e0eaccbf0ed1¦Трансграничные переводы',name:'Трансграничные переводы',unit:'DB',type:'Продукт'},
  {id:'723125c3-303d-5d2e-adc3-18460f242f63¦СберПрайм',name:'СберПрайм',unit:'CX',type:'Продукт'},
  {id:'5b3c81af-8ad4-5fcd-84c0-729f3f44093f¦СберЧаевые',name:'СберЧаевые',unit:'DB',type:'Продукт'},
  {id:'8cba2f54-2829-5599-9ee7-d1f288bb1f03¦ВЗР',name:'ВЗР',unit:'УБ',type:'Продукт'},
  {id:'aa80593f-3f07-5935-96b3-2e367d6a78f4¦Платежи',name:'Платежи',unit:'DB',type:'Продукт'},
  {id:'afe119a5-a944-5e11-90f9-e3facbd32e5c¦Кредитные карты',name:'Кредитные карты',unit:'DB',type:'Продукт'},
  {id:'75028b72-7f89-55c1-a309-8c5b4193250a¦Трансграничный эквайринг',name:'Трансграничный эквайринг',unit:'DB',type:'Продукт'},
  {id:'4bf2be31-ba6b-5ee2-b60d-bf62932ea0ce¦Переводы по РФ',name:'Переводы по РФ',unit:'DB',type:'Продукт'},
  {id:'89b13e92-db89-516e-823f-1d102242bdc9¦КАСКО',name:'КАСКО',unit:'УБ',type:'Продукт'},
  {id:'715a3090-94df-5954-b638-bb36c1ae24ae¦Личная защита Плюс',name:'Личная защита Плюс',unit:'УБ',type:'Продукт'},
];
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
  const fullHistory = new Map(historical.products.map(product=>[identity(product),product]));
  assert.equal(fullHistory.size,54);
  assert.equal(USER_SELECTION.length,12);
  const selectedKeys = new Set(USER_SELECTION.map(identity));
  assert.equal(selectedKeys.size,12);

  for(const team of USER_SELECTION) {
    assert.ok(fullHistory.has(identity(team)), 'Selected identity must have historical evidence: '+team.name);
    assert.equal(current.filter(product=>identity(product)===identity(team)).length,1);
  }
  const history = new Map([...fullHistory].filter(([key])=>selectedKeys.has(key)));
  assert.equal(history.size,12);
  const facts = [], excluded = [];
  const satelliteOnly = current.map(product=>{
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
  assert.equal(current.length,76); assert.equal(facts.length,12); assert.equal(excluded.length,0);
  const definitionFile='gravity-app/src/domain/navigatorKnowledge.js';
  const definition=text(definitionFile);
  const constant=name=>definition.match(new RegExp("const "+name+" = '([^']+)';"))[1];
  const navCode=constant('TARGET');
  assert.equal(navCode,'general.navigator_reporting_knowledge');
  const mau=JSON.parse(definition.match(/const MAU = (\[[^\n]+\]);/)[1].replaceAll("'",'"'));
  assert.ok(definition.includes('const KEY_METRICS = [...MAU, MARKET, MARKET_SBER, CLIENTS, SATELLITES, MAJOR];'));
  const prerequisites=[...mau,...['MARKET','MARKET_SBER','CLIENTS','SATELLITES','MAJOR'].map(constant)];
  const navigatorAssessments=[];
  const scenario=satelliteOnly.map(product=>{
    if(!selectedKeys.has(identity(product)))return product;
    const before=current.find(team=>identity(team)===identity(product));
    const oldSat=flatten(before).find(metric=>metric.code===code);
    const oldNav=flatten(before).find(metric=>metric.code===navCode);
    const inputs=flatten(product).filter(metric=>prerequisites.includes(metric.code)&&metric.is_applicabble_flg!==false&&metric.max_value>0)
      .map(metric=>({code:metric.code,value:metric.value,maxValue:metric.max_value,
        rawValue:Number.isFinite(metric.value)?metric.value/metric.max_value:null}));
    const blockers=inputs.filter(metric=>!Number.isFinite(metric.value)||metric.value!==metric.maxValue);
    const satelliteRestored=Number.isFinite(oldSat.value)&&oldSat.value<oldSat.max_value;
    const eligible=oldNav?.is_applicabble_flg!==false&&oldNav?.max_value>0;
    const uplift=satelliteRestored&&inputs.length>0&&blockers.length===0&&eligible
      &&Number.isFinite(oldNav.value)&&oldNav.value<oldNav.max_value;
    navigatorAssessments.push({id:product.id,name:product.name,displayName:displayProductName(product.name),unit:product.unit,type:product.type,
      satelliteRestored,allApplicablePrerequisitesKnown:blockers.length===0,inputs,blockers,
      navigatorBefore:oldNav.value,navigatorMax:oldNav.max_value,navigatorAfter:uplift?oldNav.max_value:oldNav.value,uplift,
      reason:uplift?'Selected satellite restoration removed the final key-metric blocker.'
        :!satelliteRestored?'Satellite was already full; no restoration-caused Navigator event.'
        :blockers.length?'Other applicable key-metric blockers remain; standing Navigator assessment preserved.'
        :'Navigator already full or not eligible; standing assessment preserved.'});
    if(!uplift)return product;
    return {...product,metrics:product.metrics.map(block=>block.code!=='general'?block:{...block,
      metrics:block.metrics.map(metric=>metric.code!==navCode?metric:{...metric,value:metric.max_value,
        source:{origin:'scenarioSelectedSatelliteNavigatorUplift',scenarioOnly:true,period,definitionFile,
          rule:'Only an upward Navigator event caused by restoring the selected satellite metric when all applicable KEY_METRICS become fully known.',
          inputs,previousValue:metric.value,previousSource:metric.source},
        ...(metric.recommendation_items?{recommendation_items:metric.recommendation_items.map(item=>({...item,
          value:metric.max_value,max_value:metric.max_value,gap:0}))}:{})})})};
  });
  assert.deepEqual(navigatorAssessments.filter(row=>row.uplift).map(row=>row.name).sort(),['КАСКО','Личная защита Плюс','ОСАГО'].sort());
  assert.deepEqual(current,currentSnapshot); assert.deepEqual(source,sourceSnapshot); assert.deepEqual(overlays,overlaySnapshot);
  let changedMetricCount=0,satelliteChanges=0,navigatorChanges=0;
  for(let i=0;i<current.length;i++) {
    const {metrics:oldBlocks,...oldIdentity}=current[i],{metrics:newBlocks,...newIdentity}=scenario[i];
    assert.deepEqual(newIdentity,oldIdentity);
    for(let b=0;b<oldBlocks.length;b++) {
      const {metrics:oldMetrics,...oldBlock}=oldBlocks[b],{metrics:newMetrics,...newBlock}=newBlocks[b];
      assert.deepEqual(newBlock,oldBlock);assert.equal(oldMetrics.length,newMetrics.length);
      for(let m=0;m<oldMetrics.length;m++) {
        const before=oldMetrics[m],after=newMetrics[m];
        if(before.value===after.value) {assert.deepEqual(after,before);continue;}
        assert.ok(before.code===code||before.code===navCode);assert.ok(history.has(identity(current[i])));changedMetricCount++;
        if(before.code===code)satelliteChanges++;else navigatorChanges++;
        const {value:v1,source:s1,recommendation_items:r1,...rubric1}=before;
        const {value:v2,source:s2,recommendation_items:r2,...rubric2}=after;
        assert.deepEqual(rubric2,rubric1);assert.equal(after.value,after.max_value);
      }
    }
  }
  assert.equal(satelliteChanges,facts.filter(f=>f.valueChanged).length);
  assert.equal(satelliteChanges,10);assert.equal(navigatorChanges,3);assert.equal(changedMetricCount,13);
  const osagoIndex=current.findIndex(product=>product.name==='ОСАГО');
  const osagoInitiatives=product=>flatten(product).find(metric=>metric.code==='hyp.extra_initiatives');
  assert.deepEqual(osagoInitiatives(scenario[osagoIndex]),osagoInitiatives(current[osagoIndex]));
  assert.equal(osagoInitiatives(scenario[osagoIndex]).value,null);
  assert.equal(osagoInitiatives(scenario[osagoIndex]).max_value,0);
  assert.equal(osagoInitiatives(scenario[osagoIndex]).is_applicabble_flg,false);
  assert.deepEqual(build('II кв. 2026'),q2);assert.deepEqual(q2,source.products);
  function score(product) {
    const metrics=flatten(product).filter(metric=>isDdIndexMetricForPeriod(metric,period));
    const missing=metrics.filter(metric=>!Number.isFinite(metric.value)).map(metric=>metric.code);
    const rounded=completeProductPercent(product),points=metrics.reduce((sum,metric)=>sum+(metric.value??0),0),maximum=metrics.reduce((sum,metric)=>sum+metric.max_value,0);
    return {rounded,raw:rounded===null?null:points/maximum*100,points,maxPoints:maximum,missingMetrics:missing,
      level:rounded===null?'Нет данных':maturityLevelName(rounded)};
  }
  const teams=current.map((product,index)=>({id:product.id,name:product.name,displayName:displayProductName(product.name),unit:product.unit,type:product.type,
    metric:facts.find(f=>identity(f)===identity(product))??null,current:score(product),satelliteOnly:score(satelliteOnly[index]),scenario:score(scenario[index])}));
  for(const [key,products]of [['current',current],['satelliteOnly',satelliteOnly],['scenario',scenario]]) {
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
    const stages={};for(const key of ['current','satelliteOnly','scenario']) {
      const rounded=subset.map(t=>t[key].rounded).filter(Number.isFinite),raw=subset.map(t=>t[key].raw).filter(Number.isFinite);
      const levels=Object.fromEntries([...new Set(subset.map(t=>t[key].level))].map(level=>[level,subset.filter(t=>t[key].level===level).length]));
      stages[key]={scored:rounded.length,unscored:subset.length-rounded.length,meanOfRounded:average(rounded),dashboardRounded:Math.round(average(rounded)),
        meanOfRaw:average(raw),levels};
    }
    return {population:subset.length,...stages,meanOfRoundedDelta:stages.scenario.meanOfRounded-stages.current.meanOfRounded,
      dashboardRoundedDelta:stages.scenario.dashboardRounded-stages.current.dashboardRounded,
      satelliteOnlyMeanOfRoundedDelta:stages.satelliteOnly.meanOfRounded-stages.current.meanOfRounded,
      additionalNavigatorMeanOfRoundedDelta:stages.scenario.meanOfRounded-stages.satelliteOnly.meanOfRounded,
      pairedCohortMeanOfRoundedDelta:average(subset.filter(t=>Number.isFinite(t.current.rounded)&&Number.isFinite(t.scenario.rounded)).map(t=>t.scenario.rounded-t.current.rounded))};
  }
  const counts=Object.fromEntries(['alreadyFull','zero','partial','unavailable'].map(key=>[key,facts.filter(f=>f.classification===key).length]));
  const origins=Object.fromEntries([...new Set(facts.map(f=>f.currentSource?.origin??'none'))].map(origin=>[origin,
    {total:facts.filter(f=>(f.currentSource?.origin??'none')===origin).length,
      valueChanged:facts.filter(f=>(f.currentSource?.origin??'none')===origin&&f.valueChanged).length}]));
  assert.deepEqual(productionHashes(),productionBefore);
  const result={period,metricCode:code,scenarioOnly:true,productionModified:false,
    selectedIdentities:USER_SELECTION,navigatorAssessments,navigatorPrerequisiteCodes:prerequisites,
    method:{baseline:'Full current App.jsx Q3_OVERLAYS -> buildDdiPeriodProducts, backlog ready, latest Children Navigator and 34 approved facts retained.',
      scope:'ONLY twelve exact selected identities (the prior eleven plus OSAGO). Restore their satellite metric, then upward Navigator events ONLY when that restoration clears the final applicable KEY_METRICS blocker. All other standing Navigator assessments are preserved. OSAGO initiatives remain non-applicable. No blanket Navigator resets.',
      teamScore:'Existing completeProductPercent. Any missing applicable index answer -> null; otherwise points/max*100 rounded to integer. Raw score included separately.',
      aggregate:'Existing dashboard: mean of rounded team DDI among scored teams, then integer rounding. Separate meanOfRaw is supplementary. Coverage/paired-cohort movement is explicit.',
      ranking:'Competition rank = 1 + number of teams with strictly higher ROUNDED DDI. Ordinal = score descending, then existing en collator with sensitivity base/numeric true. Separate universes: all76 B2C and60 products; unscored teams unranked.',
      maturity:'Existing maturityLevelName on rounded DDI: <40 attention; 40–60 developing; 61–80 mature; >80 leader.'},
    summary:{sourceHistoricalFacts:fullHistory.size,userSelectedTeams:USER_SELECTION.length,eligibleFacts:facts.length,excludedHistoricalFacts:excluded.length,
      currentCounts:counts,metricValueChanges:changedMetricCount,satelliteValueChanges:satelliteChanges,additionalNavigatorValueChanges:navigatorChanges,teamsWithRoundedScoreChanges:teams.filter(t=>t.scoreChanged).length,
      teamsWithRawScoreChanges:teams.filter(t=>(t.rawScoreDelta??0)!==0).length,
      teamsWithMaturityChanges:teams.filter(t=>t.levelChanged).length,
      teamsWithAnyUniverseOrRankingMethodChanges:teams.filter(t=>t.anyUniverseOrRankingMethodChanged).length,
      unchangedScoreTeamsWithAnyUniverseOrRankingMethodChanges:teams.filter(t=>!t.scoreChanged&&t.anyUniverseOrRankingMethodChanged).length,
      unchangedMetricTeamsWithAnyUniverseOrRankingMethodChanges:teams.filter(t=>!t.metric?.valueChanged&&t.anyUniverseOrRankingMethodChanged).length,
      overall:aggregate(teams),products:aggregate(teams.filter(t=>t.type==='Продукт')),sourceOrigins:origins,rankingMovements},
    facts,excluded,unmatchedSelectedTeams:USER_SELECTION.filter(p=>!current.some(team=>identity(team)===identity(p))).map(p=>({id:p.id,name:p.name,unit:p.unit,type:p.type})),
    teams,changedTeams:teams.filter(t=>t.metric?.valueChanged),unchangedScoreRankMovements:teams.filter(t=>!t.scoreChanged&&t.anyUniverseOrRankingMethodChanged),
    unchangedMetricRankMovements:teams.filter(t=>!t.metric?.valueChanged&&t.anyUniverseOrRankingMethodChanged),
    inputSha256:Object.fromEntries(inputs),productionFileSha256:productionBefore,
    assertions:{eligibleSelected12:true,osagoInitiativesUnchanged:true,exact10SatellitePlus3NavigatorChanges:true,roster76:true,onlySelectedMetricValuesChanged:true,weightsApplicabilityAndOtherFieldsUnchanged:true,
      onlyThreeRestorationCausedNavigatorUplifts:true,allOtherMetricsAndTheirSourcesUnchanged:true,currentSourceOverlaysImmutable:true,q2Unchanged:true,productionFilesUnchanged:true}};
  return {result,current,satelliteOnly,scenario};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const {result}=runScenario();
  writeFileSync(resolve(outputDir,'scenario.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result.summary,null,2));
  console.log(JSON.stringify(result.changedTeams.map(t=>({name:t.name,metric:t.metric.classification,current:t.current,scenario:t.scenario})),null,2));
}
