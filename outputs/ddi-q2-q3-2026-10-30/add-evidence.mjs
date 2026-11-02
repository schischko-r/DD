import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
import {getSections as productSections} from '../../gravity-app/src/deposits-survey/questions.js';
import {getSections as otherSections} from '../../gravity-app/src/other-surveys/questions.js';
import {otherTeamProfiles} from '../../gravity-app/src/other-surveys/other-team-profiles.js';
import {displayProductName} from '../../gravity-app/src/domain/report.js';
const dir=new URL('.',import.meta.url).pathname;
const {raw,q3}=JSON.parse(await fs.readFile(dir+'source.json','utf8'));
const surveys=JSON.parse(await fs.readFile(dir+'surveys.json','utf8'));
const baseline=dir+'DDI_II_III_кварталы_2026.xlsx';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(baseline));
const sum=wb.worksheets.getItem('Общий'),det=wb.worksheets.getItem('По метрикам');
const originalSummary=sum.getRange('A7:G89').values;
const originalDetail=det.getRange('A7:N3285').values;
const originalSumFormulas=sum.getRange('A7:G89').formulas,originalDetFormulas=det.getRange('A7:N3285').formulas;
const flat=(obj,out=[])=>{if(!obj||typeof obj!=='object')return out;if(obj.id&&obj.title)out.push(obj);for(const [k,v]of Object.entries(obj))if(k!=='previousAnswers'&&v&&typeof v==='object'){if(Array.isArray(v))v.forEach(x=>flat(x,out));else flat(v,out);}return out;};
const staticMap={
 'general.obъem_celevogo_rynka_v_rossii':['marketRussia'],'general.obъem_celevogo_rynka_v_sbere':['marketSber'],
 'general.klienty_s_produktom':['clients'],'general.mau_produkta':['mau'],'general.dau_produkta':['dau'],'general.yau_produkta':['yau'],'general.dau_mau':['dauMau'],
 'general.znanie_produktov_sputnikov':['satellite'],'general.navigator_reporting_knowledge':['monitoring'],
 'goals.monitored':['goalsMonitoring','goalsDashboards'],'goals.forecast':['goalsForecast','goalsDashboards'],
 'goals.factor_analysis_l1_l2':['goalsFactorAnalysis','goalsDashboards'],
 'alerts.business_metrics':['alerts'],'alerts.system_failures':['systemAlerts'],'alerts.opovescheniya_po_problemam_svyazannym_s_ux_ui':['uxAlerts'],
 'alerts.nastroena_matrica_otkloneniy':['campaignDeviationMatrix'],'alerts.nastroeny_avtoalerty_po_otkloneniyam':['campaignAutomaticAlerts'],
 'dannye.kontrolь_kachestva_dannyh_kkd':['qualityTools'],'dannye.promyshlenye_dannye':['industrialData'],
 'hyp.discovery_40_backlog':['discovery','backlog'],'hyp.datadriven_rating_7_5':['lastResearch'],
 'mehaniki.cross_sell':['crossSellAfter','crossSellAfterProduct'],
 'attract.report_completeness':['attractIncludes','attractReport'],'attract.funnel_analysis':['attractAnalysis','attractReport'],
 'attract.nastroena_otchetnostь':['attractConfigured','attractReport'],'attract.regulyarnostь':['attractConfigured','attractReport'],
 'attract.benchmarks':['benchmarksAttract','benchmarkAttractProof'],'churn.benchmarks':['benchmarksChurn','benchmarkChurnProof'],
 'churn.nastroena_otchetnostь':['churnConfigured','churnReport'],'churn.regulyarnostь':['churnConfigured','churnReport'],
 'churn.report_completeness':['churnIncludes','churnReport'],'churn.funnel_analysis':['churnAnalysis','churnReport'],
 'churn.deviation_actions':['deviations','deviationExampleReport'],'attract.initiatives_list':['attractDeviations','attractDeviationExampleReport'],
 'analiz_effektivnostь.nastroena_otchetnostь':['campaignReporting','campaignReport'],
 'analiz_effektivnostь.regulyarnostь':['campaignReporting','campaignReport'],
 'analiz_effektivnostь.provedenie_kompleksnogo_analiza_po_metrikam':['campaignAnalysis','campaignReport'],
 'analiz_effektivnostь.meropriyatiya_po_rabote_s_otkloneniyami':['campaignDeviations','campaignDeviationReport'],
 'mehaniki.uderzhanie_klientov':['upsell','retentionMechanism','mechanics'],
 'mehaniki.vozvrat_klientov':['upsell','returnMechanism','mechanics'],'mehaniki.doprodazhi_up_sell':['upsell','mechanics'],
};
const unique=v=>[...new Set(v.filter(Boolean))];const text=v=>Array.isArray(v)?v.map(text).join('; '):v&&typeof v==='object'?JSON.stringify(v):String(v??'');
const links=v=>unique((text(v).match(/https?:\/\/[^\s<>"\\]+/g)||[]).map(x=>x.replace(/[;,.)]+$/,'')));
for(const survey of surveys){
 const d=survey.payload,a=d.answers||{};
 let sections=[];try{sections=otherTeamProfiles[a.product]?otherSections(a):productSections(a);}catch{}
 survey.questions=flat(sections);survey.qmap=new Map(survey.questions.map(q=>[q.id,q]));
 survey.ref=`${survey.file}, строка ${survey.row}`;
}
const key=p=>JSON.stringify([p.name,p.unit,p.type]);const two=new Map(raw.products.filter(p=>p.period==='II кв. 2026').map(p=>[key(p),p])),three=new Map(q3.map(p=>[key(p),p]));
const keys=unique([...two.keys(),...three.keys()]).sort((a,b)=>{const x=two.get(a)||three.get(a),y=two.get(b)||three.get(b);return `${x.unit} ${x.name} ${x.type}`.localeCompare(`${y.unit} ${y.name} ${y.type}`,'ru');});
const extras=[],sumExtras=[],records=[];
for(const k of keys){
 const p=three.get(k)||two.get(k);const id=String(p.id).replace(/::empty::.*/,'');
 const matched=surveys.filter(s=>s.payload.team?.id===id&&s.payload.team?.unit===p.unit);
 const teamrecords=[];
 const map=p=>new Map((p?.metrics||[]).flatMap(block=>(block.metrics||[]).map(m=>[m.code,m])));const a=map(two.get(k)),b=map(three.get(k));
 for(const code of unique([...a.keys(),...b.keys()])){
  const answerParts=[],commentParts=[],proofParts=[],questionParts=[],refs=[],names=[],dates=[];let answered=0;
  for(const s of matched){
   const d=s.payload,ans=d.answers||{};const sm=(d.result?.metrics||[]).find(m=>m.code===code);
   const ids=new Set([...(staticMap[code]||[]),sm?.questionId,...s.questions.filter(q=>q.metricCode===code).map(q=>q.id)] .filter(Boolean));
   const current=b.get(code)?.source?.questionId;if(current&&Object.hasOwn(ans,current))ids.add(current);
   if(code.startsWith('mehaniki.')&&!ids.size){for(const q of s.questions)if(q.scoreKind==='mechanics'&&q.optionMetricCodes&&Object.values(q.optionMetricCodes).includes(code))ids.add(q.id);}
   if(code.startsWith('voronka_ispolьzovaniya.')||code==='attract.provedenie_kompleksnogo_analiza_voronki_ispolьzovaniya'){
    if(code.includes('regulyarnost')||code.includes('nastroena'))ids.add('usageConfigured');else if(code.includes('polnota'))ids.add('usageIncludes');else if(code.includes('analiz'))ids.add('usageAnalysis');ids.add('usageReport');
   }
   const base=[...ids];for(const qid of base){const q=s.qmap.get(qid);for(const item of flat(q||{}))if(item.id)ids.add(item.id);for(const id of [q?.inlineProof?.id,q?.inlineEvidence?.id,q?.optionalCommentId,q?.commentId,q?.proof,q?.evidenceId])if(typeof id==='string')ids.add(id);}
   const related=Object.entries(ans).filter(([field])=>[...ids].some(qid=>field===qid||field.startsWith(qid+'Source')||field.startsWith(qid+'Comment')||field.startsWith(qid+'Proof')||field.startsWith(qid+'Evidence')||field.startsWith(qid+'Files')||field.startsWith(qid+'Format')));
   const meaningful=related.filter(([,v])=>text(v).trim()!==''&&v!==false);
   const priorProof = base.flatMap(id => links(d.previousFunnelReports?.[id] || d.previousAnswers?.reportLinks?.[id]));
   if(!meaningful.length&&!sm?.evidence&&!priorProof.length)continue;
   const who=d.respondent?.name||ans.name||'';const label=matched.length>1?`[${who}; ${s.date}] `:'';
   const main=meaningful.filter(([field])=>base.includes(field));
   if(main.length)answered++;
   answerParts.push(...main.map(([field,v])=>label+text(v)));
   commentParts.push(...meaningful.filter(([field])=>/Comment|Description|Reason/i.test(field)).map(([field,v])=>label+text(v)));
   const urls=unique([...meaningful.flatMap(([,v])=>links(v)),...links(sm?.evidence)]);
   proofParts.push(...urls);
   for (const id of base) {
     const priorLinks = d.previousFunnelReports?.[id] || d.previousAnswers?.reportLinks?.[id];
     if (priorLinks) proofParts.push(...links(priorLinks).map(url => 'Ранее приложенный отчёт (из анкеты): ' + url));
   }
   if(!urls.length&&meaningful.some(([field,v])=>/Files|File|Format/i.test(field)&&/excel|xlsx|xls|\.pdf/i.test(text(v))))proofParts.push(label+'В анкете указан файл/формат Excel; публичная ссылка отсутствует');
   questionParts.push(...base.map(qid=>s.qmap.get(qid)?.title).filter(Boolean));refs.push(s.ref);names.push(who);dates.push(s.date);
  }
  const ans=unique(answerParts).join('\n'),proof=unique(proofParts).join('\n');
  const status=!matched.length?'Нет анкеты команды':ans?proof?'Есть ответ и подтверждение':'Есть ответ; ссылка не приложена':proof?'Есть подтверждение без отдельного ответа':'В анкете нет ответа на метрику';
  const row=[unique(questionParts).join('\n'),ans,unique(commentParts).join('\n'),proof,unique(names).join('\n'),unique(dates).join('\n'),unique(refs).join('\n'),status];
  assert.ok(row.every(v=>v.length<32767),'Evidence cell exceeds Excel limit');extras.push(row);
  const rec={team:p.name,unit:p.unit,code,answer:ans,proof,status};records.push(rec);teamrecords.push(rec);
 }
 sumExtras.push([unique(matched.map(s=>s.payload.respondent?.name||s.payload.answers?.name)).join('\n'),unique(matched.map(s=>s.date)).join('\n'),unique(matched.map(s=>s.ref)).join('\n'),teamrecords.filter(r=>r.answer).length,teamrecords.filter(r=>r.proof).length]);
}
assert.equal(extras.length,originalDetail.length);assert.equal(sumExtras.length,originalSummary.length);
// Append columns, keeping original scores, formulas, rows and both worksheets.
sum.getRange('H6:M6').values=[['Респондент анкеты','Дата анкеты','Источник анкеты','Метрик с ответом','Метрик с подтверждением','Флаг']];
sum.getRange('H7:L89').values=sumExtras;
det.getRange('O6:W6').values=[['Вопрос анкеты III кв.','Ответ из анкеты III кв.','Комментарий из анкеты','Подтверждения из анкеты — ссылки','Респондент','Дата анкеты','Источник анкеты','Статус подтверждения','Флаг']];
det.getRange('O7:V3285').values=extras;
sum.getRange('M7:M89').formulas=originalSummary.map((_,i)=>{const r=i+7;return [`=IF(OR(AND(ISNUMBER(F${r}),ROUND(F${r},8)>20),AND(ISNUMBER(E${r}),E${r}>70%)),"Пристально смотрим","")`];});
det.getRange('W7:W3285').formulas=originalDetail.map((_,i)=>{const r=i+7;return [`=IF(OR(AND(ISNUMBER(H${r}),ROUND(H${r},8)>20),AND(ISNUMBER(G${r}),G${r}>70%)),"Пристально смотрим","")`];});
for(const [s,last,end,tableName,flag,ddi,uplift]of [[sum,89,'M','DdiTeams','M','E','F'],[det,3285,'W','DdiMetrics','W','G','H']]){
 for(const table of [...s.tables.items])table.delete();const table=s.tables.add(`A6:${end}${last}`,true,tableName);table.style='TableStyleLight1';table.showBandedRows=false;
 s.getRange(`A1:${end}${last}`).format.fill='#FFFFFF';s.getRange(`A1:${end}${last}`).format.font.color='#30343B';
 s.getRange(`A6:${end}6`).format={fill:'#E7E8EA',font:{name:'Arial',size:10,bold:true,color:'#30343B'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',rowHeight:36};
 s.getRange('A2').format.font={name:'Arial',size:15,bold:true,color:'#30343B'};s.getRange(`A3:${end}3`).format.borders={bottom:{style:'thin',color:'#C4C7CC'}};s.tabColor='#70757D';
 s.getRange(`A7:${end}${last}`).conditionalFormats.clear();
 s.getRange(`${flag}7:${flag}${last}`).conditionalFormats.addCustom(`$${flag}7="Пристально смотрим"`,{fill:'#F5E8CF',font:{color:'#725119',bold:true}});
 s.getRange(`${ddi}7:${ddi}${last}`).conditionalFormats.addCustom(`AND(ISNUMBER(${ddi}7),${ddi}7>70%)`,{fill:'#F8EEDD',font:{color:'#725119'}});
 s.getRange(`${uplift}7:${uplift}${last}`).conditionalFormats.addCustom(`AND(ISNUMBER(${uplift}7),ROUND(${uplift}7,8)>20)`,{fill:'#F8EEDD',font:{color:'#725119'}});
 s.getRange(`${flag}6:${flag}${last}`).format.columnWidth=25;
}
sum.getRange('H7:J89').format.wrapText=true;sum.getRange('H6:J89').format.columnWidth=34;sum.getRange('K6:L89').format.columnWidth=23;
det.getRange('O6:R3285').format.columnWidth=65;det.getRange('S6:S3285').format.columnWidth=30;det.getRange('T6:T3285').format.columnWidth=22;det.getRange('U6:V3285').format.columnWidth=40;
det.getRange('O7:V3285').format.wrapText=true;det.getRange('O7:V3285').format.verticalAlignment='top';
sum.getRange('H5').values=[['Флаг: аплифт >20 п.п. или DDI III кв. >70%.']];
det.getRange('O5').values=[['Флаг применяется к показателям метрики. Ответ анкеты не означает проверку достоверности ссылки.']];
// Keep original row heights; evidence text remains fully available in cells and formula bar.
wb.recalculate();
const comparable = rows => rows.map(row => row.map(value => value === null ? '' : value));
assert.deepEqual(comparable(sum.getRange('A7:G89').values),comparable(originalSummary));assert.deepEqual(comparable(det.getRange('A7:N3285').values),comparable(originalDetail));
assert.deepEqual(sum.getRange('A7:G89').formulas,originalSumFormulas);assert.deepEqual(det.getRange('A7:N3285').formulas,originalDetFormulas);
const errorScan=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:10}});
for(const [s,range,name]of [[sum,'A1:G14','evidence-summary.png'],[det,'O5:W10','evidence-detail.png']]){const blob=await wb.render({sheetName:s.name,range,scale:1.2,format:'png'});await fs.writeFile(dir+name,new Uint8Array(await blob.arrayBuffer()));}
const output=dir+'DDI_II_III_кварталы_2026_с_подтверждениями.xlsx';await(await SpreadsheetFile.exportXlsx(wb)).save(output);
const report={output,surveyRows:surveys.length,metricRows:records.length,withAnswer:records.filter(r=>r.answer).length,withProof:records.filter(r=>r.proof).length,summaryFlags:sum.getRange('M7:M89').values.flat().filter(Boolean).length,metricFlags:det.getRange('W7:W3285').values.flat().filter(Boolean).length,scorePreservation:true,errors:errorScan.ndjson};
await fs.writeFile(dir+'evidence-validation.json',JSON.stringify(report,null,2));await fs.writeFile(dir+'evidence-mapping.json',JSON.stringify(records,null,2));console.log(JSON.stringify(report));
