import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {displayProductName, isDdIndexMetric} from '../../gravity-app/src/domain/report.js';
import {displayMetricPercent, metricFutureLabel} from '../../gravity-app/src/domain/metricPresentation.js';
import {GOALS_FINAL_COUNTERPARTS} from '../../gravity-app/src/domain/goalsFinalScores.js';
import {getSections as productSections, sections as rawSections} from '../../gravity-app/src/deposits-survey/questions.js';
import {getSections as otherSections} from '../../gravity-app/src/other-surveys/questions.js';
import {otherTeamProfiles} from '../../gravity-app/src/other-surveys/other-team-profiles.js';
import {otherTeamSections} from '../../gravity-app/src/other-surveys/other-team-questions.js';
import {callCenterSections, callCenterScoreRules} from '../../gravity-app/src/deposits-survey/call-center.js';

const root = new URL('../../', import.meta.url), dir = new URL('.', import.meta.url);
const read = async p => JSON.parse(await fs.readFile(new URL(p, root), 'utf8'));
const report = await read('gravity-app/public/report-data.json');
const app = await fs.readFile(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlayNames = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(s=>imports.get(s.trim()));
assert.ok(overlayNames.every(Boolean));
const overlays = await Promise.all(overlayNames.map(name=>read('gravity-app/src/data/'+name)));
const args = await Promise.all(['salary-products','reporting-regularity-missing','funnel-action-missing'].map(name=>read(`gravity-app/src/data/${name}-q3-2026.json`)));
const products = buildDdiPeriodProducts(report.products,'III кв. 2026',overlays,...args,await read('gravity-app/public/backlog-data.json'));
const rawResponses = JSON.parse(await fs.readFile(new URL('responses.json',dir),'utf8'));
assert.equal(rawResponses.errors.length,0);
const responses = rawResponses.responses.filter(r=>r.year==='2026' && r.quarter==='3' && !r.excludedByConfirmedUserInstruction);
assert.ok(responses.every(r=>r.canonicalTeam));
const unique = items=>[...new Set(items.filter(v=>v!==null && v!==undefined && v!==''))];
const text = v=>Array.isArray(v)?v.map(text).join('; '):v && typeof v==='object'?JSON.stringify(v):String(v??'');
const links = v=>unique((text(v).match(/https?:\/\/[^\s<>"'\\]+/gi)||[]).map(x=>x.replace(/[;,.)\]}]+$/,'')));
const flatten = (obj,out=[])=>{
  if (!obj || typeof obj!=='object') return out;
  if (obj.id && obj.title) out.push(obj);
  if (Array.isArray(obj)) obj.forEach(x=>flatten(x,out));
  else for (const key of ['questions','inlineQuestions','inlineProof','inlineEvidence','action','benchmark']) flatten(obj[key],out);
  return out;
};
const staticMap = {
 'general.obъem_celevogo_rynka_v_rossii':['marketRussia'], 'general.obъem_celevogo_rynka_v_sbere':['marketSber'],
 'general.klienty_s_produktom':['clients'], 'general.mau_produkta':['mau'], 'general.dau_produkta':['dau'],
 'general.yau_produkta':['yau'], 'general.dau_mau':['dauMau'], 'general.znanie_produktov_sputnikov':['satellite'],
 'general.navigator_reporting_knowledge':['monitoring'],
 'goals.po_monitoring':['goalsMonitoring'], 'goals.po_forecast':['goalsForecast'], 'goals.po_factor_analysis':['goalsFactorAnalysis'],
 'alerts.business_metrics':['alerts'], 'alerts.system_failures':['systemAlerts'], 'alerts.opovescheniya_po_problemam_svyazannym_s_ux_ui':['uxAlerts'],
 'alerts.nastroena_matrica_otkloneniy':['campaignDeviationMatrix'], 'alerts.nastroeny_avtoalerty_po_otkloneniyam':['campaignAutomaticAlerts'],
 'dannye.kontrolь_kachestva_dannyh_kkd':['qualityTools'], 'dannye.promyshlenye_dannye':['industrialData'],
 'hyp.discovery_40_backlog':['discovery'], 'hyp.datadriven_rating_7_5':['lastResearch'],
 'mehaniki.cross_sell':['crossSellAfter'],
 'attract.report_completeness':['attractIncludes'], 'attract.funnel_analysis':['attractAnalysis'],
 'attract.nastroena_otchetnostь':['attractConfigured'], 'attract.regulyarnostь':['attractConfigured'],
 'attract.benchmarks':['benchmarksAttract'], 'churn.benchmarks':['benchmarksChurn'],
 'churn.nastroena_otchetnostь':['churnConfigured'], 'churn.regulyarnostь':['churnConfigured'],
 'churn.report_completeness':['churnIncludes'], 'churn.funnel_analysis':['churnAnalysis'],
 'churn.deviation_actions':['deviations'], 'attract.initiatives_list':['attractDeviations'],
 'analiz_effektivnostь.nastroena_otchetnostь':['campaignConfigured','campaignReporting'],
 'analiz_effektivnostь.regulyarnostь':['campaignConfigured','campaignReporting'],
 'analiz_effektivnostь.provedenie_kompleksnogo_analiza_po_metrikam':['campaignAnalysis'],
 'analiz_effektivnostь.meropriyatiya_po_rabote_s_otkloneniyami':['campaignDeviations'],
 'mehaniki.uderzhanie_klientov':['upsell','retentionMechanism'],
 'mehaniki.vozvrat_klientov':['upsell','returnMechanism'], 'mehaniki.doprodazhi_up_sell':['upsell'],
};
const reportProofs = {attract:'attractReport',churn:'churnReport',usage:'usageReport',entry:'entryReport',sales:'salesReport',onboarding:'onboardingReport',campaign:'campaignReport'};
const commonTemplates = flatten([...rawSections,...productSections({}),...callCenterSections]);
const commonMap = new Map(commonTemplates.map(q=>[q.id,q]));
const genericProduct = flatten(productSections({product:'full-otello¦Отелло'}));
for(const q of genericProduct) if(!commonMap.has(q.id)) commonMap.set(q.id,q);

function catalogs(teamId, answers) {
  const isOther = Boolean(otherTeamProfiles[teamId]);
  const actual = flatten(isOther?otherSections({...answers,product:teamId}):productSections({...answers,product:teamId}));
  let templates;
  if(isOther) {
    const profile = otherTeamProfiles[teamId];
    templates = flatten(otherTeamSections({...profile,metrics:profile.metrics.map(m=>({...m,value:0}))},
      {discovery:rawSections.find(s=>s.id==='research').questions.find(q=>q.id==='discovery')}));
    // The PO goals and cross-sell questions are shared with products.
    templates.push(...genericProduct.filter(q=>['goalsMonitoring','goalsForecast','goalsFactorAnalysis','crossSellAfter'].includes(q.id)));
  } else templates = commonTemplates;
  return {actual, all:new Map([...templates,...actual].map(q=>[q.id,q])),isOther};
}
function questionIds(code,metric,catalog,response,kind) {
  // LЮ/ЛТ is sourced separately from the owner's questionnaire.
  if(Object.hasOwn(GOALS_FINAL_COUNTERPARTS,code)) return [];
  const scored = (response?.metrics||[]).find(m=>m.code===code);
  let ids = catalog.actual.filter(q=>q.metricCode===code || Object.values(q.optionMetricCodes||{}).includes(code)).map(q=>q.id);
  if(scored?.questionId) ids.push(scored.questionId);
  if(metric.source?.questionId) ids.push(metric.source.questionId);
  if(!ids.length) ids = [...(staticMap[code]||[])];
  if(!ids.length) ids = [...catalog.all.values()].filter(q=>q.metricCode===code || Object.values(q.optionMetricCodes||{}).includes(code)).map(q=>q.id);
  if(kind==='callCenter') ids.push(...callCenterScoreRules.filter(r=>r.code===code).map(r=>r.questionId));
  if(!ids.length) {
    for(const [prefix,qprefix] of [['voronka_ispolьzovaniya','usage'],['voronka_vhoda_v_kanal','entry'],['voronka_prodazh','sales'],['voronka_onbordinga','onboarding']]) {
      if(code.startsWith(prefix+'.')) {
        if(/nastroena|regulyarnost/.test(code)) ids.push(qprefix+'Configured');
        if(/polnota/.test(code)) ids.push(qprefix+'Includes');
        if(/analiz/.test(code)) ids.push(qprefix+'Analysis');
      }
    }
    if(code==='attract.provedenie_kompleksnogo_analiza_voronki_ispolьzovaniya') ids.push('usageAnalysis');
  }
  if(catalog.isOther) {
    // Never substitute a product mechanic question for a channel or segment.
    ids=ids.filter(id=>catalog.all.has(id) || id===scored?.questionId && response?.answers[id]!==undefined && commonMap.has(id));
  }
  return unique(ids).filter(id=>catalog.all.has(id) || commonMap.has(id));
}
function relatedIds(q,code) {
  const ids=flatten(q).map(x=>x.id);
  for(const obj of flatten(q)) for(const prop of ['optionalCommentId','commentId','reasonId','proof','evidenceId','formatId']) if(typeof obj[prop]==='string') ids.push(obj[prop]);
  if(q.id.startsWith('goals')) ids.push('goalsDashboards');
  if(q.id==='discovery') ids.push('backlog');
  if(q.id==='upsell') ids.push('mechanics');
  if(q.id==='crossSellAfter') ids.push('crossSellAfterProduct');
  for(const [prefix,proof] of Object.entries(reportProofs)) if(q.id.startsWith(prefix)) ids.push(proof);
  if(code==='churn.deviation_actions') ids.push('deviationExampleReport');
  if(code==='attract.initiatives_list') ids.push('attractDeviationExampleReport');
  return unique(ids);
}
function sourceText(source) {
  if(!source) return '';
  const parts=[];
  if(source.origin==='priorQuarterCarryForward'||source.fromPeriod==='II кв. 2026') parts.push('Оценка перенесена из II квартала');
  if(source.rule || source.reason || source.mappingRule) parts.push(text(source.reason||source.rule||source.mappingRule));
  if(source.file && !/^(gravity-app|outputs|scripts)\//.test(source.file)) parts.push('Источник оценки: '+source.file.split('/').pop());
  if(source.sheet) parts.push('Лист: '+source.sheet);
  if(source.cell) parts.push('Ячейка: '+source.cell);
  const decompositions=[source,...Object.values(source.cohorts||{}).map(cohort=>cohort.source)]
    .filter(item=>item?.teamKey && item.quarterKey==='2026-Q3');
  for(const item of decompositions) {
    parts.push(`Декомпозиция бэклога${item.cohort?' ('+item.cohort+')':''}: ${item.discoveryCount} из ${item.createdCount} задач — исследования.`);
    if(item.dataThrough && item.isComplete===false) parts.push('Данные по '+item.dataThrough.split('-').reverse().join('.')+'; III квартал неполный.');
  }
  return unique(parts).join('\n');
}
function sourceUrls(source) {
  if(!source || typeof source!=='object') return links(source);
  const out=[];
  for(const [k,v] of Object.entries(source)) if(!/previous|prior|history|baseline/i.test(k)) out.push(...(typeof v==='object'?sourceUrls(v):links(v)));
  return unique(out);
}
const rows=[], audit=[];
for(const product of products.sort((a,b)=>`${a.unit} ${a.name}`.localeCompare(`${b.unit} ${b.name}`,'ru'))) {
  const id=product.id.replace(/::empty::.*/,''), matched=responses.filter(r=>r.canonicalTeam.id===id);
  const baseCatalog = catalogs(id,{});
  const kind=product.name==='Колл-центр'?'callCenter':'';
  for(const block of product.metrics) {
    const metrics=[...block.metrics.map(m=>({metric:m,po:false})),...(block.goalsPoLevelMetrics||[]).map(m=>({metric:m,po:true}))];
    for(const {metric,po} of metrics) {
      const future=metricFutureLabel(product,metric), applicable=metric.is_applicabble_flg!==false && metric.max_value>0;
      const score=future || (!applicable?'Не применимо':!Number.isFinite(metric.value)?'Нет данных':displayMetricPercent(product,metric)/100);
      const questions=[], optionParts=[], comments=[], urls=[...sourceUrls(metric.source),...links(metric.button),...links(metric.buttons)], questionRefs=[], answerRefs=[];
      const qEntries=new Map();
      const sources=matched.length?matched:[null];
      for(const response of sources) {
        const cat=response?catalogs(id,response.answers):baseCatalog;
        const qids=questionIds(metric.code,metric,cat,response,kind);
        for(const qid of qids) {
          const q=cat.all.get(qid)||commonMap.get(qid);
          qEntries.set(qid,q);
          questionRefs.push({id:qid,row:q.row,sheet:q.sheet,templateOnly:!cat.actual.some(x=>x.id===qid) && (!response || response.answers[qid]===undefined)});
          if(!response) continue;
          const answer=response.answers[qid];
          const who=[response.cohort?response.cohort:null,response.respondent,response.completedAt?.slice(0,10)].filter(Boolean).join(', ');
          const ids=relatedIds(q,metric.code);
          const values=Object.entries(response.answers).filter(([key])=>ids.some(related=>key===related || key.startsWith(related) && /^(Source|Comment|Format|Other|Reason|Description|Correction|Unknown|Link)/.test(key.slice(related.length))));
          const notes=[];
          if(answer!==undefined && answer!==null && text(answer)!=='') {
            notes.push(`Ответ на «${q.title}»: ${text(answer)}`);
            answerRefs.push({recordId:response.recordId,questionId:qid,answer});
          }
          for(const [key,value] of values) {
            if(key===qid || value===null || text(value)==='') continue;
            urls.push(...links(value));
            if(/Format$|Unknown$/.test(key)) {
              if(value==='excel') notes.push('Подтверждение: отчёт в Excel');
              if(value==='unavailable') notes.push('Подтверждение: ссылка недоступна');
              if(value==='unknown' || value===true) notes.push('Нет подтверждения / затрудняюсь ответить');
              continue;
            }
            if(!links(value).length || /Comment|Correction|Reason|Other|Description/.test(key)) {
              const label=/Comment|Correction|Reason/.test(key)?'Комментарий':key.includes('Source')?'Источник ответа':(cat.all.get(key)?.title || commonMap.get(key)?.title || 'Подтверждение');
              notes.push(`${label}: ${text(value)}`);
            }
          }
          urls.push(...links(answer));
          const scored=response.metrics.find(m=>m.code===metric.code);
          if(scored?.evidence) {urls.push(...links(scored.evidence));if(!links(scored.evidence).length) notes.push('Подтверждение: '+text(scored.evidence));}
          for(const related of ids) urls.push(...links(response.payload.previousFunnelReports?.[related]));
          if(notes.length) comments.push(`${who}\n${unique(notes).join('\n')}`);
        }
      }
      for(const [qid,q] of qEntries) {
        questions.push(q.title);
        const options=unique([...(q.knownOptions||[]),...(q.previousOptions||[]),...(q.options||[])]);
        optionParts.push((qEntries.size>1?q.title+'\n':'')+(options.length?options.join('\n'):q.type==='numeric'?'Числовой ввод (без вариантов)':q.type==='links'?'Ссылка или указание формата отчёта':'Свободный ввод (без вариантов)'));
      }
      if(!questions.length) questions.push('Отдельный вопрос в анкете отсутствует');
      if(qEntries.size && !answerRefs.length) comments.push('Ответ на связанный вопрос в анкетах III квартала отсутствует.');
      if(questionRefs.length && questionRefs.every(q=>q.templateOnly)) comments.push('Приведён шаблон вопроса; в маршруте анкеты III квартала он не задавался.');
      const rule=sourceText(metric.source);if(rule)comments.push(rule);
      if(!isDdIndexMetric(metric) && applicable) comments.push('Информационная метрика, не входит в индекс.');
      if(!applicable) comments.push('Метрика не применима в III квартале.');
      const level=block.code==='goals'?(po?' — уровень PO (информационная)':Object.hasOwn(GOALS_FINAL_COUNTERPARTS,metric.code)?' — уровень ЛЮ/ЛТ (информационная)':Object.values(GOALS_FINAL_COUNTERPARTS).includes(metric.code)?' — итоговая оценка':''):'';
      rows.push([product.unit,displayProductName(product.name),block.name,metric.name+level,score,unique(questions).join('\n\n'),unique(optionParts).join('\n\n'),unique(comments).join('\n\n'),unique(urls).join('\n')]);
      audit.push({teamId:id,team:product.name,unit:product.unit,block:block.code,code:metric.code,po,raw:metric.value,max:metric.max_value,applicable,score,questions:questionRefs,answers:answerRefs,source:metric.source});
    }
  }
}
assert.equal(new Set(audit.map(r=>JSON.stringify([r.teamId,r.block,r.code,r.po]))).size,rows.length);
assert.ok(rows.every(r=>r.length===9));
assert.ok(rows.every(r=>typeof r[4]!=='number'||r[4]>=0&&r[4]<=1));
assert.ok(rows.every(r=>r.every(c=>typeof c!=='string'||c.length<=32767)));
const validation={teams:products.length,rows:rows.length,numericScores:rows.filter(r=>typeof r[4]==='number').length,
  questionRows:audit.filter(r=>r.questions.length).length,answerRows:audit.filter(r=>r.answers.length).length,linkRows:rows.filter(r=>r[8]).length,
  overlays:overlayNames.length,responses:responses.length,excluded:rawResponses.responses.length-responses.length,
  sourceHashes:Object.fromEntries(await Promise.all(['gravity-app/public/report-data.json','gravity-app/src/app/App.jsx',...overlayNames.map(n=>'gravity-app/src/data/'+n)].map(async p=>[p,createHash('sha256').update(await fs.readFile(new URL(p,root))).digest('hex')])))};
await fs.writeFile(new URL('data.json',dir),JSON.stringify({rows,audit,overlayNames,validation},null,2));
console.log(JSON.stringify({...validation,sourceHashes:undefined}));
