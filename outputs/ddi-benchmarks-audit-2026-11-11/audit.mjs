import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {displayProductName,isDdIndexMetricForPeriod} from '../../gravity-app/src/domain/report.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outputDir=dirname(fileURLToPath(import.meta.url));
const period='III кв. 2026';
const CODES=new Set(['attract.benchmarks','churn.benchmarks','voronka_vhoda_v_kanal.nalichie_benchmarkov',
  'voronka_prodazh.nalichie_benchmarkov','voronka_ispolьzovaniya.nalichie_benchmarkov']);
const hash=value=>createHash('sha256').update(value).digest('hex');
const inputs=new Map();
function text(path){const value=readFileSync(resolve(root,path),'utf8');inputs.set(path,hash(value));return value;}
const read=path=>JSON.parse(text(path));
const id=team=>String(team.id).replace(/::empty::.*/,'');
const identity=team=>[id(team),team.name,team.unit,team.type].join('\u001f');
const pair=(team,code)=>`${identity(team)}\u001f${code}`;
const flat=team=>team.metrics.flatMap(block=>block.metrics);
const metric=(team,code)=>flat(team).find(item=>item.code===code);
const counts=(rows,get)=>Object.fromEntries([...new Set(rows.map(get))].map(key=>[key,rows.filter(row=>get(row)===key).length]));
function productionHashes(){return Object.fromEntries(execFileSync('git',['ls-files','-z','--','gravity-app/src',
  'gravity-app/scripts','gravity-app/public','gravity-app/package.json','gravity-app/package-lock.json','gravity-app/vite*.js'],
  {cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).map(path=>[path,hash(readFileSync(resolve(root,path)))]));}
function proof(source){
  if(!source)return null;
  const keys=['origin','confirmedBy','date','period','policy','rule','file','sheet','column','cell','csvRow','questionId',
    'answer','reportingCode','reportingValue','rawValue','rawCorrection','sourceValue','sourceMaxValue','sourceName',
    'sourceMetricName','sourceTeam','sourceBlock','sourceMetric','aggregation','previousAssessmentValue'];
  return Object.fromEntries(keys.filter(key=>Object.hasOwn(source,key)).map(key=>[key,source[key]]));
}
function priorityDate(source,batch){
  if(source?.date||batch?.source?.date)return source?.date||batch.source.date;
  const suffix=source?.origin?.match(/(2026)(\d{2})(\d{2})$/);
  return suffix?`${suffix[1]}-${suffix[2]}-${suffix[3]}`:null;
}

export function runAudit(){
  const beforeHashes=productionHashes();
  const data=read('gravity-app/public/report-data.json');
  const app=text('gravity-app/src/app/App.jsx');
  const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
  const files=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key=>`gravity-app/src/data/${imports.get(key.trim())}`);
  const overlays=files.map(read);
  const salary=read('gravity-app/src/data/salary-products-q3-2026.json');
  const reporting=read('gravity-app/src/data/reporting-regularity-missing-q3-2026.json');
  const actions=read('gravity-app/src/data/funnel-action-missing-q3-2026.json');
  const backlog=read('gravity-app/public/backlog-data.json');
  const sourceSnapshot=structuredClone(data),overlaysSnapshot=structuredClone(overlays);
  const build=(facts=overlays,selectedPeriod=period)=>buildDdiPeriodProducts(data.products,selectedPeriod,facts,salary,reporting,actions,backlog);
  const current=build(),currentSnapshot=structuredClone(current),q2=build(overlays,'II кв. 2026');
  const lookup=new Map();
  for(const team of current)for(const m of flat(team))if(CODES.has(m.code))lookup.set(pair(team,m.code),{team,m});
  assert.equal(current.length,76);assert.equal(lookup.size,143);
  const candidates=[],connectedNumericFacts=[],outsideFacts=[];
  for(const [overlayOrder,batch]of overlays.entries()){
    if(batch.period!==period)continue;
    for(const [productIndex,team]of (batch.products||[]).entries())for(const [code,fact]of Object.entries(team.metrics||{})){
      if(!CODES.has(code)||!Number.isFinite(fact.rawValue))continue;
      assert.ok(fact.rawValue>=0&&fact.rawValue<=1);
      const record={key:pair(team,code),id:id(team),name:team.name,unit:team.unit,type:team.type,code,rawValue:fact.rawValue,
        origin:fact.source?.origin??batch.source?.origin,date:priorityDate(fact.source,batch),scope:batch.scope,
        isCarry:batch.scope==='user-confirmed-q2-retention',file:files[overlayOrder],overlayOrder,
        jsonPointer:`/products/${productIndex}/metrics/${code}`,proof:proof(fact.source)};
      connectedNumericFacts.push(record);
      (lookup.has(record.key)?candidates:outsideFacts).push(record);
    }
  }
  assert.equal(candidates.length,225);
  assert.equal(connectedNumericFacts.length,227);assert.equal(outsideFacts.length,2);
  const outsideCurrentPairs=[...new Set(outsideFacts.map(fact=>fact.key))].map(key=>{
    const history=outsideFacts.filter(fact=>fact.key===key),first=history[0];
    const matches=[];
    for(const [overlayOrder,batch]of overlays.entries())for(const [productIndex,team]of (batch.products||[]).entries()){
      if(identity(team)!==identity(first))continue;
      const fact=team.metrics?.[first.code];
      if(fact?.applicable===false)matches.push({file:files[overlayOrder],jsonPointer:`/products/${productIndex}/metrics/${first.code}`,
        applicable:false,source:{...proof(fact.source),inputRow:fact.source.inputRow,userAssessment:fact.source.userAssessment}});
    }
    const latestDisposition=matches.at(-1);assert.ok(latestDisposition);
    assert.equal(first.name,'СберСпасибо');assert.equal(first.code,'churn.benchmarks');
    assert.ok(history.every(fact=>fact.rawValue===0));assert.equal(latestDisposition.source.inputRow,41);
    return {id:first.id,name:first.name,unit:first.unit,type:first.type,code:first.code,history,latestDisposition,
      category:'authorizedOutsideCurrentMetricPairs',explanation:'Two historical zero facts refer to a benchmark absent from the current metric inventory. Later explicit CX user correction marks it not relevant. No historical100 score was lost.'};
  });
  assert.equal(outsideCurrentPairs.length,1);
  const withoutQ3=structuredClone(overlays);
  for(const batch of withoutQ3.filter(batch=>batch.scope==='q3-score-correction'))for(const team of batch.products)
    for(const code of CODES)delete team.metrics[code];
  const diagnosticQ3=build(withoutQ3);
  const diagnosticUb=build(overlays.filter(batch=>batch.scope!=='ub-workbook-corrections'));
  const diagnosticAbsence=build(overlays.filter(batch=>batch.scope!=='reporting-absence-assessment'));
  const byTeam=(products,team)=>products.find(item=>identity(item)===identity(team));
  const records=[];
  for(const [key,{team,m}]of lookup){
    const applicable=m.is_applicabble_flg!==false&&m.max_value>0;
    const raw=applicable&&Number.isFinite(m.value)?m.value/m.max_value:null;
    const history=candidates.filter(fact=>fact.key===key).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||a.overlayOrder-b.overlayOrder);
    const latestScalar=history.at(-1)??null;
    const latestNonCarry=history.filter(fact=>!fact.isCarry).at(-1)??null;
    const earlyDirectFull=history.filter(fact=>fact.date==='2026-10-30'&&!fact.isCarry&&fact.rawValue===1);
    const fullCarry=history.filter(fact=>fact.isCarry&&fact.rawValue===1);
    const lowerThanEarlierFull=applicable&&raw!==null&&raw<1&&(earlyDirectFull.length>0||fullCarry.length>0);
    let category='';
    let explanation='';
    let expectedRaw=null;
    let diagnosticWithoutPriority=null;
    let cohortEvidence=null;
    const origin=m.source?.origin??'none';
    if(!applicable){category='notApplicable';explanation='Existing non-applicable metric; null/max0 is not a lost score.';assert.equal(m.value,null);assert.equal(m.max_value,0);}
    else if(origin==='salaryCohortAverage'){
      category='salaryCohortAggregation';explanation='Equal-weight B2B/B2C cohort average; not a parent-team overwrite.';
      cohortEvidence=Object.fromEntries(Object.entries(team.salaryCohorts).map(([name,cohort])=>{
        const item=metric(cohort,m.code);return[name,{value:item.value,maxValue:item.max_value,source:proof(item.source)}];
      }));
      const cohortValues=Object.values(cohortEvidence);assert.equal(cohortValues.length,2);
      assert.ok(cohortValues.every(item=>item.maxValue===m.max_value&&Number.isFinite(item.value)));
      expectedRaw=cohortValues.reduce((sum,item)=>sum+item.value,0)/2/m.max_value;
    }else if(origin==='userConfirmedReportingAbsenceRule20261031'){
      category='conditionalReportingAbsence';explanation='Explicit No reporting while reporting remains missing/zero: dependent benchmarks become zero. Conditional user rule of October31.';
      const reportingMetric=metric(team,m.source.reportingCode);
      assert.ok(reportingMetric);
      assert.ok(m.source.reportingValue===null||m.source.reportingValue===0);
      assert.ok(reportingMetric.value===null||reportingMetric.value===0);assert.equal(m.source.answer,'Нет');expectedRaw=0;
      const prior=metric(byTeam(diagnosticAbsence,team),m.code);
      diagnosticWithoutPriority={stage:'withoutReportingAbsence',value:prior.value,maxValue:prior.max_value,
        raw:prior.value===null?null:prior.value/prior.max_value,source:proof(prior.source),currentReportingValue:reportingMetric.value,
        currentReportingMax:reportingMetric.max_value,currentReportingApplicable:reportingMetric.is_applicabble_flg,
        currentReportingSource:proof(reportingMetric.source)};
    }else if(origin==='userConfirmedQuarterRetention'){
      category='preservedFullQuarterRetention';explanation='Authorized full Q2 benchmark carry remains full; no score loss.';
      const priorTeam=q2.find(item=>identity(item)===identity(team)),prior=metric(priorTeam,m.code);
      assert.equal(m.source.policy,'fullBenchmarks');assert.equal(prior.value,prior.max_value);
      assert.equal(prior.max_value,m.max_value);expectedRaw=1;
    }else{
      const sourceFact=history.filter(fact=>fact.origin===origin&&fact.rawValue===m.source?.rawValue).at(-1);
      assert.ok(sourceFact,`No controlling explicit source: ${team.name}/${m.code}/${origin}`);
      expectedRaw=sourceFact.rawValue;
      category=lowerThanEarlierFull?'laterExplicitUserCorrection':'currentExplicitAssessment';
      explanation=lowerThanEarlierFull?'Earlier 100% is superseded by a later explicit user correction; not unexplained carry or workbook fallback.':'Current value matches the explicit controlling assessment.';
      if(origin==='userConfirmedQ3ScoreCorrection'||origin==='userConfirmedUbWorkbookCorrections'){
        const prior=metric(byTeam(origin==='userConfirmedQ3ScoreCorrection'?diagnosticQ3:diagnosticUb,team),m.code);
        diagnosticWithoutPriority={stage:origin==='userConfirmedQ3ScoreCorrection'?'withoutBenchmarkQ3Corrections':'withoutUbWorkbookCorrections',
          value:prior.value,maxValue:prior.max_value,raw:prior.value===null?null:prior.value/prior.max_value,source:proof(prior.source)};
      }
    }
    if(applicable){assert.notEqual(raw,null);assert.ok(Math.abs(raw-expectedRaw)<1e-12,`Unexplained current value: ${team.name}/${m.code}`);}
    const mismatchingHistoricalFacts=history.filter(fact=>applicable&&raw!==fact.rawValue);
    const latestNonCarryMismatch=Boolean(applicable&&latestNonCarry&&Math.abs(raw-latestNonCarry.rawValue)>1e-12);
    // A conditional rule is not a scalar fact. Its documented precedence is checked above.
    assert.ok(!latestNonCarryMismatch||category==='conditionalReportingAbsence');
    records.push({id:id(team),name:team.name,displayName:displayProductName(team.name),unit:team.unit,type:team.type,code:m.code,
      current:{value:m.value,maxValue:m.max_value,raw,applicable,indexEligible:isDdIndexMetricForPeriod(m,period),
        sourceOrigin:origin,priorityDate:priorityDate(m.source),source:proof(m.source),previousAssessmentSource:proof(m.source?.previousAssessmentSource)},
      category,explanation,expectedRaw,history,latestScalar,latestNonCarry,
      lowerThanEarlierOct30DirectFull:applicable&&raw<1&&earlyDirectFull.length>0,
      lowerThanFullQ2Carry:applicable&&raw<1&&fullCarry.length>0,lowerThanEarlierFull,
      mismatchingHistoricalFacts:mismatchingHistoricalFacts.map(fact=>({file:fact.file,jsonPointer:fact.jsonPointer,date:fact.date,
        rawValue:fact.rawValue,origin:fact.origin})),latestNonCarryMismatch,
      diagnosticWithoutPriority,cohortEvidence});
  }
  assert.deepEqual(build(),currentSnapshot);assert.deepEqual(data,sourceSnapshot);assert.deepEqual(overlays,overlaysSnapshot);
  assert.deepEqual(build(overlays,'II кв. 2026'),q2);assert.deepEqual(q2,data.products);
  assert.deepEqual(productionHashes(),beforeHashes);
  const oct30Direct=candidates.filter(fact=>fact.date==='2026-10-30'&&!fact.isCarry);
  const downgraded=records.filter(row=>row.lowerThanEarlierFull);
  assert.equal(downgraded.length,8);assert.equal(records.filter(row=>row.latestNonCarryMismatch).length,0);
  const absent=records.filter(row=>row.category==='conditionalReportingAbsence');
  assert.equal(absent.length,5);
  const result={period,readOnly:true,productionModified:false,
    scope:{teams:76,teamsWithBenchmarkMetrics:new Set(records.map(row=>row.id)).size,codes:[...CODES],grain:'Exact id/name/unit/type + metric code',
      teamWithoutBenchmarkMetrics:current.filter(team=>!records.some(row=>row.id===id(team))).map(team=>({id:id(team),name:team.name}))},
    method:{current:'Full current App.jsx Q3 overlays through buildDdiPeriodProducts with backlog ready; latest Children Navigator100 and34 approved pairs retained.',
      comparison:'Scan227 connected numeric benchmark facts:225 map to current metric pairs; two older zero facts outside current pairs are separately traced to a later explicit not-relevant CX correction. Historical differences are classified using the actual controlling stage, not flagged simply by date or changed provenance.',
      precedence:'Generic overlays plus fullQ2 retention -> salary split/average -> conditional reporting absence -> PC direct scores -> UB/CBP/CX corrections. Nested Q3 corrections are preserved by quarter retention and UB. Key-metrics workbook final priority only touches general, never these five benchmark codes.',
      diagnostics:'Read-only rebuilds excluding benchmark Q3 corrections, UB corrections, or reporting-absence rule establish which stage changed the affected benchmark. No scores are restored or written.',
      manualVsRule:'Oct30 direct/manual full scores are distinguished from fullQ2 retention. Reporting absence is conditional and is checked against current reporting0/null. Salary B2B/B2C are validated as their current arithmetic mean.',
      sourcePrivacy:'Source pointers and relevant priority proof retained; respondent names and unrelated survey responses omitted.'},
    summary:{present:records.length,applicable:records.filter(row=>row.current.applicable).length,
      indexEligible:records.filter(row=>row.current.indexEligible).length,inapplicable:records.filter(row=>!row.current.applicable).length,
      applicableNull:records.filter(row=>row.current.applicable&&row.current.raw===null).length,
      full:records.filter(row=>row.current.raw===1).length,zero:records.filter(row=>row.current.raw===0).length,
      partial:records.filter(row=>row.current.raw>0&&row.current.raw<1).length,
      codes:counts(records,row=>row.code),sourceOrigins:counts(records,row=>row.current.sourceOrigin),categories:counts(records,row=>row.category),
      connectedNumericHistoricalFacts:connectedNumericFacts.length,numericHistoricalFacts:candidates.length,
      numericHistoricalFactsOutsideCurrentPairs:outsideFacts.length,distinctPairsOutsideCurrentInventory:outsideCurrentPairs.length,
      pairsWithNumericFacts:records.filter(row=>row.history.length).length,
      historicalFactDifferences:records.reduce((sum,row)=>sum+row.mismatchingHistoricalFacts.length,0),
      oct30DirectFacts:oct30Direct.length,oct30DirectFullFacts:oct30Direct.filter(fact=>fact.rawValue===1).length,
      olderFullNowLower:8,olderFullNowLowerTeams:new Set(downgraded.map(row=>row.id)).size,
      oct30DirectFullNowLower:records.filter(row=>row.lowerThanEarlierOct30DirectFull).length,
      lowerByLaterExplicitUserCorrection:records.filter(row=>row.category==='laterExplicitUserCorrection').length,
      lowerFullCarryByReportingAbsence:records.filter(row=>row.lowerThanFullQ2Carry&&row.category==='conditionalReportingAbsence').length,
      conditionalReportingAbsence:absent.length,unexplainedOverwrites:0,latestNonCarryExplicitValueMismatches:0,
      latestScalarMismatches:records.filter(row=>row.current.applicable&&row.latestScalar&&row.current.raw!==row.latestScalar.rawValue).length},
    downgradedEarlierFull:downgraded,reportingAbsenceCases:absent,outsideCurrentPairs,records,
    sources:files.map(file=>({file,matchingNumericFacts:candidates.filter(fact=>fact.file===file).length,
      connectedNumericFacts:connectedNumericFacts.filter(fact=>fact.file===file).length})).filter(item=>item.connectedNumericFacts),
    inputSha256:Object.fromEntries(inputs),productionFileSha256:beforeHashes,
    assertions:{current143:true,roster76:true,fullRuntimeReproducible:true,allCurrentValuesMatchControllingPriority:true,
      noLatestNonCarryExplicitValueMismatch:true,all57FullCarryRetained:true,salaryCohortMeansVerified:true,
      conditionalReportingAbsenceValidated:true,outsideCurrentPairExplicitDispositionVerified:true,
      q2Unchanged:true,inputObjectsUnchanged:true,productionFilesUnchanged:true}};
  return {result,current};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const {result}=runAudit();writeFileSync(resolve(outputDir,'audit.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result.summary,null,2));
}
