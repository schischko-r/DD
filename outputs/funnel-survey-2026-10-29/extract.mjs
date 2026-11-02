import fs from 'node:fs';
import assert from 'node:assert/strict';
import {getSections as products} from '../../gravity-app/src/deposits-survey/questions.js';
import {getSections as others} from '../../gravity-app/src/other-surveys/questions.js';
import {displayProductName} from '../../gravity-app/src/domain/report.js';

const root=new URL('./',import.meta.url);
const records=JSON.parse(fs.readFileSync(new URL('records.json',root)));
const text=v=>Array.isArray(v)?v.join('; '):v==null?'':typeof v==='object'?JSON.stringify(v):String(v);
const direction=k=>/^usage|^benchmarkUsage/i.test(k)?'Использование':/^churn|^deviation|^benchmarkChurn/i.test(k)?'Отток':/^attract|^benchmarkAttract/i.test(k)?'Привлечение':null;
const formats={link:'Ссылка',jira:'Ссылка на задачу в Jira/ST',confluence:'Ссылка на Confluence',other:'Другое',excel:'Excel',unavailable:'Нет возможности приложить',unknown:'Затрудняюсь ответить',keep:'Прежняя ссылка сохранена',replace:'Ссылка заменена'};
const generalIds={'general.obъem_celevogo_rynka_v_rossii':'marketRussia','general.obъem_celevogo_rynka_v_sbere':'marketSber','general.klienty_s_produktom':'clients','general.mau_produkta':'mau','general.dau_produkta':'dau','general.yau_produkta':'yau','general.dau_mau':'dauMau','general.znanie_produktov_sputnikov':'satellite','general.navigator_reporting_knowledge':'monitoring','goals.monitored':'goalsMonitoring','goals.forecast':'goalsForecast','goals.factor_analysis_l1_l2':'goalsFactorAnalysis','alerts.business_metrics':'alerts','alerts.system_failures':'systemAlerts','alerts.opovescheniya_po_problemam_svyazannym_s_ux_ui':'uxAlerts','hyp.discovery_40_backlog':'discovery','mehaniki.monitoring_mehanik':'mechanicsMonitoring'};
const mechanicOptions={'mehaniki.vozvrat_klientov':'Возврат клиентов','mehaniki.uderzhanie_klientov':'Удержание клиентов','mehaniki.doprodazhi_up_sell':'Допродажи (upsell)'};
const blockNames={general:'Ключевые метрики',goals:'Цели',alerts:'Оповещения',hyp:'Гипотезы и исследования',mehaniki:'Продуктовые механики',cx:'Клиентский опыт',dannye:'Данные',modeli_i_ai_proniknovenie:'Модели и AI',rezulьtativnostь:'Результативность',analiz_effektivnostь:'Анализ эффективности',voronka_onbordinga:'Онбординг',voronka_vhoda_v_kanal:'Вход в канал',voronka_prodazh:'Продажи'};
const fallback={attractConfigured:'Настроена ли регулярная отчётность по воронке привлечения?',churnConfigured:'Настроена ли регулярная отчётность по воронке оттока?',usageConfigured:'Настроена ли регулярная отчётность по воронке использования?',attractIncludes:'Какие метрики включает отчёт по воронке привлечения?',churnIncludes:'Какие метрики включает отчёт по воронке оттока?',usageIncludes:'Какие метрики включает отчёт по воронке использования?',attractAnalysis:'Проводился ли за последний квартал анализ воронки привлечения?',churnAnalysis:'Проводился ли за последний квартал анализ воронки оттока?',usageAnalysis:'Проводился ли за последний квартал анализ воронки использования?',attractDeviations:'Есть ли задачи/мероприятия по работе с отклонениями по воронке привлечения?',deviations:'Есть ли задачи/мероприятия по работе с отклонениями по воронке оттока?',churnDeviations:'Есть ли задачи/мероприятия по работе с отклонениями по воронке оттока?',usageDeviations:'Есть ли задачи/мероприятия по работе с отклонениями по воронке использования?',benchmarksAttract:'Есть ли бенчмарки по воронке привлечения?',benchmarksChurn:'Есть ли бенчмарки по воронке оттока?',churnModel:'Есть ли у вас модель оттока?'};
const output=[],raw=[],coverage=[];
for(const rec of records){
 const d=rec.data,a=d.answers,meta={product:displayProductName(d.team.name),fio:d.respondent?.name||a.name,unit:d.team.unit,type:d.team.type||'Продукт',date:d.completedAt,file:rec.file,csvRow:rec.csvRow,login:rec.login,teamId:d.team.id};
 const catalog=(d.team.type?others:products)(a);
 const questions=new Map();
 function add(q){questions.set(q.id,q);for(const x of [...(q.inlineQuestions||[]),q.action,q.benchmark].filter(Boolean))add(x);}
 catalog.forEach(s=>s.questions.forEach(add));
 const relevant=Object.keys(a);
 const consumed=new Set();
 function bundle(keys){return keys.filter(k=>Object.hasOwn(a,k)).map(k=>{consumed.add(k);return `${k}: ${formats[a[k]]||text(a[k])}`;}).join('\n');}
 function qtitle(id){return questions.get(id)?.title||fallback[id]||id;}
 const metrics=d.result?.metrics||[];
 const chosen=metrics;
 const usedQuestion=new Set();
 for(const m of chosen){
  const block=m.code.split('.')[0];
  const funnelBlock=['attract','churn','voronka_ispolьzovaniya','voronka_onbordinga','voronka_vhoda_v_kanal','voronka_prodazh'].includes(block);
  let dir=m.code.startsWith('churn.')?'Отток':block==='voronka_ispolьzovaniya'||/использован|ispolьzovaniya/.test(m.code+' '+m.name)?'Использование':block==='attract'?'Привлечение':blockNames[block]||block;
  const prefix=dir==='Отток'?'churn':dir==='Использование'?'usage':dir==='Онбординг'?'onboarding':dir==='Вход в канал'?'entry':dir==='Продажи'?'sales':'attract';
  let id=m.questionId;
  if(!id){
   const q=[...questions.values()].find(q=>q.metricCode===m.code||Object.values(q.optionMetricCodes||{}).includes(m.code));id=q?.id||generalIds[m.code]||(mechanicOptions[m.code]?'upsell':undefined);
   if(!id&&['attract','churn','voronka_ispolьzovaniya','voronka_onbordinga','voronka_vhoda_v_kanal','voronka_prodazh'].includes(block)){
    if(/nastroena_otchetnost/.test(m.code))id=prefix+'Configured';
    else if(/report_completeness|polnota_otcheta/.test(m.code))id=prefix+'Includes';
    else if(/funnel_analysis|provedenie.*analiza/.test(m.code))id=prefix+'Analysis';
    else if(/initiatives_list|deviation_actions|meropriyatiya_po_rabote/.test(m.code))id=prefix==='churn'?(Object.hasOwn(a,'churnDeviations')?'churnDeviations':'deviations'):prefix+'Deviations';
    else if(/benchmarks|nalichie_benchmarkov/.test(m.code))id='benchmarks'+prefix[0].toUpperCase()+prefix.slice(1);
   }
  }
  // A benchmark-only Includes is a different question, not evidence of report completeness.
  if(id?.endsWith('Includes')&&(questions.get(id)?.benchmarkOnly||typeof a[id]==='string'&&['Да','Нет'].includes(a[id]))){id=undefined;}
  const q=questions.get(id);
  const answerPresent=id&&Object.hasOwn(a,id);
  if(answerPresent){consumed.add(id);usedQuestion.add(id);}
  const comments=answerPresent?[`Ответ: ${text(a[id])}`]:[];
  if(id)for(const key of [...new Set([id+'Comment',id+'Other',id+'Reason',q?.commentId,q?.optionalCommentId,q?.reasonId].filter(Boolean))])if(Object.hasOwn(a,key)){comments.push(`${key}: ${text(a[key])}`);consumed.add(key);}
  const evidence=[];
  if(m.evidence)evidence.push(`Подтверждение из результата: ${m.evidence}`);
  let reportIds=[];
  if(funnelBlock){
   if(/benchmarks|nalichie_benchmarkov/.test(m.code))reportIds=['benchmark'+prefix[0].toUpperCase()+prefix.slice(1)+'Proof'];
   else if(/initiatives_list|deviation_actions|meropriyatiya_po_rabote/.test(m.code))reportIds=[prefix==='churn'&&Object.hasOwn(a,'deviationExampleReportFormat')?'deviationExampleReport':prefix+'DeviationExampleReport'];
   else if(/analysis|analiza/.test(m.code))reportIds=[prefix+'Report',prefix==='churn'&&Object.hasOwn(a,'deviationExampleReportFormat')?'deviationExampleReport':prefix+'DeviationExampleReport'];
   else if(/otchetnost|completeness|polnota|regulyar/.test(m.code))reportIds=[prefix+'Report'];
  }
  if(q?.inlineEvidence?.id)reportIds.push(q.inlineEvidence.id);
  if(q?.inlineProof?.id)reportIds.push(q.inlineProof.id);
  if(id)for(const candidate of [id+'Source',id+'SourceLink',id+'SourceOther'])if(Object.hasOwn(a,candidate))reportIds.push(candidate);
  if(id==='goalsMonitoring'||id==='goalsForecast'||id==='goalsFactorAnalysis')reportIds.push('goalsDashboards');
  if(id==='upsell')reportIds.push('mechanics');
  if(id==='discovery')reportIds.push('backlog','discoveryBacklogComment','discoveryBacklogType');
  const proofComments=[];
  for(const reportId of new Set(reportIds)){
   const pack=bundle([reportId+'Format',reportId]);if(pack)evidence.push(pack);
   const comment=bundle([reportId+'Comment',reportId+'Correction']);if(comment)proofComments.push(comment);
   const previous=d.previousFunnelReports?.[reportId];if(previous)proofComments.push(`Прежний отчёт (${reportId}): ${text(previous)}`);
  }
  if(!answerPresent)comments.push('В анкете нет отдельного ответа; баллы сохранены в результате анкеты.');
  const sourceBefore=Number.isFinite(m.baselineValue)?m.baselineValue:null,sourceAfter=Number.isFinite(m.value)?m.value:null;
  const applicable=Number(m.maxValue)>0;
  const before=applicable&&sourceBefore!==null?sourceBefore/m.maxValue:null;
  let ratio=applicable&&sourceAfter!==null?sourceAfter/m.maxValue:0;
  if(answerPresent&&applicable){
   const answer=a[id];
   if(q?.scoreKind==='presence'||id.startsWith('benchmarks'))ratio=answer==='Да'?1:0;
   else if(Array.isArray(answer)&&q?.options&&!mechanicOptions[m.code]&&!['mechanics','upsell','otherMechanics'].includes(q.scoreKind)&&!['upsell','otherMechanics','monitoring'].includes(id)){
    const negative=option=>/^(Не проводился|Затрудняюсь|Нет$|Не настроены|Не релевантно|Все перечисленное выше|Что-то ещ|Другое$)/i.test(option)||option===q.actionOption||option==='Бенчмарки';
    const positives=q.options.filter(option=>!negative(option));
    const selected=new Set([...answer,...(q.previousOptions||[])]);
    ratio=answer.includes('Все перечисленное выше')?1:positives.length?positives.filter(option=>selected.has(option)).length/positives.length:ratio;
   }else if(typeof answer==='string'&&/^Нет$|^Не проводился$|^Затрудняюсь ответить$/.test(answer))ratio=0;
   else if(typeof answer==='string'&&/^Частично|^Да, по запросу/.test(answer))ratio=0.5;
   else if(typeof answer==='string'&&/^Да$|^Да \(включены все цели\)$|^Да, >90%$|^Да, автоматическая/.test(answer))ratio=1;
  }
  const after=applicable?(ratio<=0?0:ratio>=1-0.00011?1:0.5):null;
  const scoreRule=!applicable?'Не применимо: максимальный балл в анкете равен 0':answerPresent?'По ответу и ранее подтверждённым пунктам: нет — 0; часть — 0,5; все — 1':'Отдельный ответ не запрашивался: сохранённая оценка переведена в шкалу 0 / 0,5 / 1';
  proofComments.push(scoreRule);
  output.push({...meta,direction:dir,metric:m.name,question:id&&(questions.has(id)||fallback[id])?qtitle(id):'Отдельный вопрос в ответах отсутствует',before,after,sourceBefore,sourceAfter,comment:comments.join('\n'),evidence:[...new Set(evidence)].join('\n'),units:applicable?'баллы (0–1)':'не применимо',proofComment:proofComments.join('\n'),code:m.code,questionId:id||'',max:m.maxValue,included:m.includedInIndex,scoreSource:m.source,rule:m.rule});
 }
 // Questions without a scored metric (for example, the churn model) are retained as separate rows.
 for(const id of relevant.filter(k=>fallback[k]&&!usedQuestion.has(k))){
  const q=questions.get(id),dir=direction(id),prefix=dir==='Отток'?'churn':dir==='Использование'?'usage':'attract';
  const proof=q?.inlineEvidence?.id||q?.inlineProof?.id||(id==='churnModel'?'churnModelReport':id.endsWith('Includes')&&typeof a[id]==='string'?'benchmark'+prefix[0].toUpperCase()+prefix.slice(1)+'Proof':null);
  consumed.add(id);
  output.push({...meta,direction:dir,metric:id==='churnModel'?'Модель оттока':q?.benchmarkOnly?'Наличие бенчмарков':'Дополнительный вопрос по воронке',question:qtitle(id),before:null,after:null,comment:`Ответ: ${text(a[id])}`,evidence:proof?bundle([proof+'Format',proof]):'',units:'не оценивается отдельно',proofComment:proof?bundle([proof+'Comment',proof+'Correction']):'',code:'',questionId:id,max:null,included:false,scoreSource:'Нет отдельного балла в сохранённом результате',rule:''});
 }
 for(const id of relevant){
  raw.push({...meta,direction:direction(id)||'Прочие поля',key:id,question:qtitle(id),value:a[id],source:JSON.stringify(d.questionSources?.[id]||{}),covered:true});
  consumed.add(id);
 }
 assert.ok(relevant.every(k=>consumed.has(k)));
 coverage.push({...meta,answerFields:relevant.length,coveredFields:relevant.filter(k=>consumed.has(k)).length});
}
output.sort((a,b)=>a.product.localeCompare(b.product,'ru')||a.date.localeCompare(b.date)||a.direction.localeCompare(b.direction,'ru')||a.code.localeCompare(b.code));
const osago=output.find(r=>r.product==='ОСАГО'&&r.questionId==='attractAnalysis');
assert.ok(osago.evidence.includes('Протоколы CX/UX'));
assert.ok(osago.comment.includes('Все перечисленное выше'));
for(const name of ['Монеты','ПДС'])assert.ok(output.some(r=>r.product===name&&r.metric==='Наличие бенчмарков'&&r.question.includes('бенчмарк')));
const result={rows:output,raw,coverage,summary:{records:records.length,teams:new Set(records.map(r=>r.data.team.id)).size,metricRows:output.filter(r=>r.code).length,totalRows:output.length,rawFields:raw.length,unclassifiedRows:output.filter(r=>r.metric==='Дополнительное поле анкеты').length},note:'II → III квартал 2026. Баллы — из сохранённого предварительного результата анкеты, не из текущего DDI. Повторные прохождения сохранены отдельно. Аплифт = балл после − балл до. Ответы и подтверждения сохранены дословно; формулировки вопросов сопоставлены с опросником конкретной команды.'};
fs.writeFileSync(new URL('extracted.json',root),JSON.stringify(result,null,2));
console.log(result.summary);
