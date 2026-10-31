import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {completeProductPercent,isDdIndexMetric} from '../../gravity-app/src/domain/report.js';
import {getSections} from '../../gravity-app/src/deposits-survey/questions.js';

const root=new URL('../../',import.meta.url), read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const report=read('gravity-app/public/report-data.json'), source=report.products;
const app=readFileSync(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlayNames=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(s=>imports.get(s.trim()));
const overlays=overlayNames.map(name=>read(`gravity-app/src/data/${name}`));
const salary=read('gravity-app/src/data/salary-products-q3-2026.json');
const reporting=read('gravity-app/src/data/reporting-regularity-missing-q3-2026.json');
const actions=read('gravity-app/src/data/funnel-action-missing-q3-2026.json');
const q2=buildDdiPeriodProducts(source,'II кв. 2026',overlays,salary,reporting,actions);
const q3=buildDdiPeriodProducts(source,'III кв. 2026',overlays,salary,reporting,actions);
const identity=p=>`${String(p.id||'').replace(/::empty::.*/,'')}¦${p.name}¦${p.unit}¦${p.type}`;
const map=new Map();
for(const p of [...q2,...q3]){const key=identity(p);let pair=map.get(key);if(!pair)map.set(key,pair={id:String(p.id).replace(/::empty::.*/,''),name:p.name,unit:p.unit,type:p.type,q2:null,q3:null});pair[p.period==='II кв. 2026'?'q2':'q3']=p;if(p.period==='III кв. 2026'){pair.name=p.name;pair.unit=p.unit;pair.type=p.type;}}
const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU');
const metricMap=p=>new Map((p?.metrics||[]).flatMap(b=>(b.metrics||[]).map(m=>[m.code,{...m,blockCode:b.code,blockName:b.name}])));
const responses=(await fs.readFile(new URL('./responses.json',import.meta.url),'utf8')).trim()?JSON.parse(await fs.readFile(new URL('./responses.json',import.meta.url),'utf8')):[];
for(let i=responses.length-1;i>=0;i--)if(norm(responses[i].respondent).includes('чикин'))responses.splice(i,1);
const responsesById=new Map();for(const r of responses){if(!r.team.id)continue;let list=responsesById.get(r.team.id);if(!list)responsesById.set(r.team.id,list=[]);list.push(r);}
const questionCache=new Map();
const explicitQuestionIds={'goals.po_monitoring':'goalsMonitoring','goals.po_forecast':'goalsForecast','goals.po_factor_analysis':'goalsFactorAnalysis'};
function questionIndex(teamId){if(questionCache.has(teamId))return questionCache.get(teamId);let q=new Map();for(const section of getSections({product:teamId}))for(const question of section.questions||[]){q.set(question.id,question);for(const child of [...(question.inlineQuestions||[]),...(question.inlineEvidence?[question.inlineEvidence]:[]),...(question.inlineProof?[question.inlineProof]:[])])q.set(child.id,child);}questionCache.set(teamId,q);return q;}
const metricLines=[];const summaryLines=[];let mappedQuestions=0, questionnaireAnswers=0;
for(const pair of [...map.values()].sort((a,b)=>norm(a.name).localeCompare(norm(b.name),'ru')||norm(a.unit).localeCompare(norm(b.unit),'ru'))){
 const m2=metricMap(pair.q2),m3=metricMap(pair.q3);const codes=[...new Set([...m2.keys(),...m3.keys()])];
 const productScore=p=>{if(!p)return null;const value=completeProductPercent(p);return Number.isFinite(value)?value/100:null;};
 const score2=productScore(pair.q2),score3=productScore(pair.q3);const uplift=score2!==null&&score3!==null?score3-score2:null;
 const attention=score3===null?'Неполный индекс III квартала':score2===null?'Нет полного индекса II квартала':uplift<-.000001?'Снижение':uplift>.000001?'Рост':'Без изменения';
 summaryLines.push({team:pair.name,metric:'Общий индекс продукта',question:'',answer:'',options:'',confirmation:'Расчёт: взвешенная доля выполненных применимых метрик, включённых в индекс; общий процент показывается только при заполнении всех индексных метрик. Аплифт = III кв. минус II кв. в процентных пунктах.',link:'',score2,score3,uplift,attention});
 const rs=responsesById.get(pair.id)||[];const qs=questionIndex(pair.id);
 for(const code of codes){const a=m2.get(code),b=m3.get(code);const meta=b||a;const qEntries=[];
  for(const response of rs){for(const scored of response.metrics){if(scored.code===code&&scored.questionId){const q=qs.get(scored.questionId);if(q)qEntries.push({response,scored,q});}}const qid=explicitQuestionIds[code];if(qid&&response.answers[qid]!==undefined){const q=qs.get(qid);if(q)qEntries.push({response,scored:{code,questionId:qid},q});}}
  const dedupe=new Map(qEntries.map(e=>[`${e.response.respondent}|${e.scored.questionId}`,e]));
  const entries=[...dedupe.values()];const titles=[...new Set(entries.map(e=>e.q.title).filter(Boolean))];
  const question=titles.join('\n');const optionSets=[...new Set(entries.flatMap(e=>e.q.options||[]))];const options=optionSets.join('\n');
  const answers=[];const confirms=[];const links=[];
  for(const e of entries){const {response,scored,q}=e;const cohort=response.team.name?.startsWith('Зарплатный продукт')?response.respondent.toLocaleLowerCase('ru').includes('сауткин')?'B2B':'B2C':'';
   const val=response.answers[scored.questionId];if(val!==undefined&&val!==null&&val!==''){answers.push(`${cohort?`[${cohort}] `:''}${Array.isArray(val)?val.join('; '):String(val)}`);questionnaireAnswers++;}
   const src=response.answers[`${scored.questionId}Source`];const fmt=response.answers[`${scored.questionId}Format`];const comment=response.answers[`${scored.questionId}Comment`];const proofId=q.inlineEvidence?.id||q.inlineProof?.id;const proof=proofId?response.answers[proofId]:'';const proofFormat=proofId?response.answers[`${proofId}Format`]:'';const srcLink=response.answers[`${scored.questionId}SourceLink`];const proofLink=proofId?response.answers[`${proofId}Link`]:'';
   const who=[response.respondent,response.completedAt?response.completedAt.slice(0,10):'',src,fmt?`формат: ${fmt}`:'',proofFormat?`подтверждение: ${proofFormat}`:'',comment].filter(Boolean).join('; ');if(who)confirms.push(who);
   const evidence=String(scored.evidence||'');const found=[srcLink,proofLink,proof,...(evidence.match(/https?:\/\/[^\s)\]}>,]+/g)||[])];for(const link of found)if(/^https?:\/\//i.test(String(link).trim()))links.push(String(link).trim());
  }
  const val2=a&&a.is_applicabble_flg!==false&&Number(a.max_value)>0&&Number.isFinite(a.value)?a.value/a.max_value:null;
  const val3=b&&b.is_applicabble_flg!==false&&Number(b.max_value)>0&&Number.isFinite(b.value)?b.value/b.max_value:null;
  const delta=val2!==null&&val3!==null?val3-val2:null;
  const metricAttention=!b||b.is_applicabble_flg===false||!(Number(b.max_value)>0)?'Не применимо':Number(b.dd_calculation_flg)===0||b.excluded_from_index?'Информационная':val3===null?'Пусто в III квартале':val2===null?'Нет оценки II квартала':delta<-.000001?'Снижение':delta>.000001?'Рост':'Без изменения';
  const source3=b?.source||null;
  const sourceLabel=source3?.file?'Цифровые следы':source3?.origin==='priorQuarterCarryForward'?'Перенос из II квартала':source3?'Подтверждённая оценка / правило DDI':'Сохранённая оценка модели DDI';
  const sourceDetails=[];
  if(source3?.file)sourceDetails.push(`файл: ${source3.file}`);
  if(source3?.sheet)sourceDetails.push(`лист: ${source3.sheet}`);
  if(source3?.cell)sourceDetails.push(`ячейка: ${source3.cell}`);
  if(source3?.sourceRows?.length&&!source3.cell)sourceDetails.push(`строки источника: ${source3.sourceRows.map(r=>typeof r==='object'?r.sourceRow??r.csvRow:r).filter(Boolean).join(', ')}`);
  if(source3?.fromPeriod)sourceDetails.push(`период источника: ${source3.fromPeriod}`);
  const rule=source3?.rule||source3?.reason||source3?.mappingRule;
  if(rule)sourceDetails.push(`правило: ${rule}`);
  if(code==='general.navigator_reporting_knowledge'&&!question&&!source3?.rule){sourceDetails.push('правило: не знают MAU или рынок России — 0; знают MAU и рынок, но не спутники — 0,5; знают все три — 1. Пропуск ответа не равен незнанию.');}
  if(!question)confirms.push([sourceLabel,...sourceDetails].filter(Boolean).join('; '));
  metricLines.push({team:pair.name,metric:meta.name,question,answer:[...new Set(answers)].join('\n'),options,confirmation:[...new Set(confirms)].join('\n'),link:[...new Set(links)].join('\n'),score2:val2,score3:val3,uplift:delta,attention:metricAttention,block:meta.blockName,blockCode:meta.blockCode,code,unit:pair.unit,type:pair.type,max2:a?.max_value??null,max3:b?.max_value??null,index2:isDdIndexMetric(a),index3:isDdIndexMetric(b),applicable3:!!b&&b.is_applicabble_flg!==false&&Number(b.max_value)>0,source3});
  if(question)mappedQuestions++;
 }
}
const data={periods:['II кв. 2026','III кв. 2026'],products:summaryLines,metrics:metricLines,counts:{products:summaryLines.length,metrics:metricLines.length,questionnaireRows:metricLines.filter(r=>r.question).length,mappedQuestions,questionnaireAnswers,responses:responses.length,unansweredMetrics:metricLines.filter(r=>r.attention==='Пусто в III квартале').length,attention:metricLines.filter(r=>r.attention==='Снижение').length}};
await fs.writeFile(new URL('./workbook-data.json',import.meta.url),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data.counts));
