import fs from 'node:fs';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {excludeRemovedTeams} from '../../gravity-app/src/domain/report.js';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const source=excludeRemovedTeams(read('gravity-app/public/report-data.json')).products;
const app=fs.readFileSync(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read(`gravity-app/src/data/${imports.get(k.trim())}`));
const products=buildDdiPeriodProducts(source,'III кв. 2026',overlays,read('gravity-app/src/data/salary-products-q3-2026.json'),read('gravity-app/src/data/reporting-regularity-missing-q3-2026.json'),read('gravity-app/src/data/funnel-action-missing-q3-2026.json'));
const table=fs.readFileSync(new URL('user-tribe-scores.tsv',import.meta.url),'utf8').trim().split('\n').slice(1).map(line=>{const[unit,tribe,...scores]=line.split('\t');return{unit,tribe,scores:scores.map(Number)};});
const units={CBP:'Core Banking',DB:'Daily Banking B2C',DP:'Digital Channels',PC:'Phygital Channels','ДомКлик':'Домклик'};
const tribeAliases={'Массовый высокодоходный сегмент':'МВС'};
const confirmedAliases={'Зрелость':'Почтенный возраст','Много денег (НКПЗН)':'Вторичка','Сделка вторичка':'Вторичка','Сделка ИЖС':'ИЖС','Сделка с Первичным жильём':'Первичка'};
const direct={'SberID':'Sber ID','Единый личный кабинет (ЕЛК)':'Sber ID','Почта, Диск, Календарь':'Sber ID','Персональная рекомендация':'SberCampaigning','Колл-центр':'Развитие сервисных технологий в каналах','Телемаркетинг':'Развитие сервисных технологий в каналах'};
const zeroDenominators = new Map([
  ['Daily Banking B2C/Кредитные карты',[1]],['Daily Banking B2C/Социальные и зарплатные решения',[1]],
  ['Data/CDO B2C',[1]],['Data/CDS B2C',[1,2]],['Data/SberCampaigning',[1,2]],['Data/SberNBA',[1]],['Data/SberProfile',[1]],
  ['Digital Channels/Digital Platform',[1,2]],['Digital Channels/Уведомления',[1]],['Digital Channels/Цифровой ассистент',[1]],
  ['Phygital Channels/AI',[1]],['Phygital Channels/Клиентские документы',[1]],['Phygital Channels/Платформа Phygital',[1]],
  ['Phygital Channels/Продажи',[1]],['Phygital Channels/Развитие сервисных технологий в каналах',[1]],['Phygital Channels/СберМобайл',[1]],
  ['Phygital Channels/Сервисные технологии',[0,1,2]],['Phygital Channels/Управление каналами ЕСЗК',[1]],
  ['УБ/AI эффективность',[2]],['УБ/ИЦ (Инвестиционный центр)',[0,1,2]]
]);
for(const row of table) for(const i of zeroDenominators.get(row.unit+'/'+row.tribe)||[])row.scores[i]=null;
const codes=['goals.monitored','goals.forecast','goals.factor_analysis_l1_l2'];
const results=[];
for(const p of products){const baseline=source.find(t=>t.id===p.id.split('::empty::')[0]&&t.name===p.name&&t.unit===p.unit);const tribe=baseline?.tribe;const mapping=confirmedAliases[p.name]||direct[p.name]?'confirmedAlias':'catalogTribe';const mappedTribe=confirmedAliases[p.name]||direct[p.name]||tribeAliases[tribe]||tribe;const target=table.find(t=>t.unit===(units[p.unit]||p.unit)&&t.tribe===mappedTribe);const metrics=p.metrics.flatMap(b=>b.metrics);const values=codes.map(code=>{const m=metrics.find(m=>m.code===code);return Number.isFinite(m?.value)&&m.max_value>0&&m.is_applicabble_flg!==false?m.value/m.max_value:null;});const mismatches=target?codes.flatMap((code,i)=>(target.scores[i]===null ? metrics.find(m=>m.code===code)?.is_applicabble_flg!==false && Number(metrics.find(m=>m.code===code)?.max_value)>0 : values[i]!==target.scores[i])?[{code,actual:values[i],expected:target.scores[i],source:metrics.find(m=>m.code===code)?.source}]:[]):[];results.push({team:p.name,unit:p.unit,tribe,mappedTribe,mapping,status:!target?'unresolved':mismatches.length?'different':'same',actual:values,expected:target?.scores,mismatches});}
const summary={period:'III кв. 2026',rule:'Use supplied score columns; zero denominators are not applicable per latest user correction; no app data changed. Triples are monitoring/forecast/factor analysis. Unit and LU totals are not used as tribe rows.',teams:results.length,counts:Object.fromEntries(['same','different','provisional','unresolved'].map(s=>[s,results.filter(r=>r.status===s).length])),results};
fs.writeFileSync(new URL('comparison.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({teams:summary.teams,counts:summary.counts},null,2));
for(const r of results.filter(r=>r.status!=='same'))console.log(JSON.stringify({team:r.team,tribe:r.tribe,mappedTribe:r.mappedTribe,status:r.status,actual:r.actual,expected:r.expected}));
