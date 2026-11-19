import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {displayProductName} from '../../gravity-app/src/domain/report.js';

const root=new URL('../../',import.meta.url),dir=new URL('.',import.meta.url);
const read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'));
const input=await read('outputs/ddi-q3-survey-export-2026-11-11/responses.json');
for(const file of input.files)assert.equal(createHash('sha256').update(await fs.readFile(new URL(file.file,root))).digest('hex'),file.sha256,file.file);
assert.equal(input.errors.length,0);
const responses=input.responses.filter(r=>r.year==='2026'&&r.quarter==='3'&&!r.excludedByConfirmedUserInstruction);
assert.equal(responses.length,79);
const rosterData=await read('outputs/ddi-q3-survey-export-2026-11-11/data.json');
const roster=new Set(rosterData.audit.map(a=>a.teamId));
const defs=[
  ['marts','Вывод витрин','Трудоемкий процесс вывода витрин'],
  ['resources','Аналитические ресурсы','Нехватка аналитических ресурсов (DA/DS/DE)'],
  ['bi','Ограничения BI','Технические ограничения BI-платформы'],
  ['alerts','Алерты и мониторинг','Отсутствие алертов, нет авто-мониторинга'],
  ['automation','Автоматизация отчётности','Низкая автоматизация отчетности, долгие сроки'],
  ['ab','Платформа A/B','Инструментарий платформы A/B'],
  ['quality','Качество данных','Низкое качество данных'],
  ['selfservice','Self-Service BI','Отсутствие Self-Service BI'],
];
const labelToId=new Map(defs.map(([id,,label])=>[label,id]));
const groups=new Map();
for(const response of responses){
  const team=response.canonicalTeam;assert.ok(team&&roster.has(team.id),response.recordId);
  assert.ok(Array.isArray(response.answers.support)&&response.answers.support.length);
  const rows=groups.get(team.id)||[];rows.push(response);groups.set(team.id,rows);
}
assert.equal(groups.size,76);assert.equal(roster.size,76);
const manualComments={
  'ОСАГО':{status:'pain',theme:'Логирование UI',interpretation:'Нужно логирование всех UI-элементов СБОЛ, включая чипсы и тоглы.'},
  'СберПрайм':{status:'pain',theme:'Свежесть и поставка данных',interpretation:'Редкое обновление и недостаточный мониторинг поставок от ДЗО.'},
  'Сделка вторичка':{status:'okay',theme:'Инструментов достаточно',interpretation:'Команда прямо сообщает об отсутствии действующих критичных проблем.'},
  'SberPay NFC':{status:'pain',theme:'Применимость витрин',interpretation:'Витрины сложно использовать для передачи клиентских выборок в маркетинг.'},
  'ПДС':{status:'pain',theme:'Возможности A/B и ресурсы',interpretation:'Нет нужных видов сегментного A/B-тестирования и выделенного аналитика.'},
  'Личная защита Плюс':{status:'pain',theme:'Пилоты и A/B',interpretation:'Долгие согласования пилотов и нет подключения СберБизнес к A/B в SberWorks.'},
  'Страхование жизни':{status:'unclear',theme:'Ответ без расшифровки',interpretation:'Выбрано «Другое», комментарий «-» не раскрывает потребность.'},
  'СБОЛ':{status:'pain',theme:'Мощности кластеров',interpretation:'Не хватает производительности вычислительных кластеров.'},
  'СберKids':{status:'pain',theme:'Доступ из инструментов разработки',interpretation:'Нужен MCP/API для доступа к данным Навигатора из GigaCode CLI.'},
  'СберИнвестор':{status:'pain',theme:'Инфраструктура и поиск данных',interpretation:'Нестабильно работает инфраструктура аналитиков, сложно искать данные.'},
};
const teamRows=[],quoteRows=[];
for(const [id,rs]of groups){
  const team=rs[0].canonicalTeam;assert.ok(rs.every(r=>r.canonicalTeam.unit===team.unit));
  const selected=[...new Set(rs.flatMap(r=>r.answers.support))];
  assert.ok(selected.every(label=>labelToId.has(label)||label==='Другое'));
  const painIds=defs.filter(([, ,label])=>selected.includes(label)).map(([key])=>key);
  const comments=rs.filter(r=>String(r.answers.supportOther||'').trim()).map(r=>({text:r.answers.supportOther.trim(),record:r.recordId,cohort:r.cohort||null}));
  const coded=comments.map(c=>{const m=manualComments[team.name];assert.ok(m,team.name);return {...c,...m};});
  const status=painIds.length||coded.some(c=>c.status==='pain')?'pain':coded.some(c=>c.status==='okay')?'okay':'unclear';
  teamRows.push({teamId:id,unit:team.unit,team:displayProductName(team.name),canonicalTeam:team.name,status,
    painIds,painLabels:defs.filter(([key])=>painIds.includes(key)).map(([,short])=>short),
    selectedOptions:selected,otherSelected:selected.includes('Другое'),comments:coded.map(c=>c.text),
    otherInterpretations:coded.map(c=>c.interpretation),responseCount:rs.length,painCount:painIds.length,
    records:rs.map(r=>({record:r.recordId,file:r.file,row:r.csvRow,date:r.completedAt,cohort:r.cohort||null,
      selected:r.answers.support,comment:r.answers.supportOther||''}))});
  quoteRows.push(...coded.map(c=>({teamId:id,unit:team.unit,team:displayProductName(team.name),
    text:c.text,status:c.status,theme:c.theme,interpretation:c.interpretation,record:c.record})));
}
const unitOrder=['DB','CBP','УБ','CX','Data','DP','PC','ДомКлик'];
teamRows.sort((a,b)=>unitOrder.indexOf(a.unit)-unitOrder.indexOf(b.unit)||a.team.localeCompare(b.team,'ru'));
const totals=defs.map(([id,label,fullLabel])=>({id,label,fullLabel,teams:teamRows.filter(r=>r.painIds.includes(id)).length,
  total:teamRows.length,share:teamRows.filter(r=>r.painIds.includes(id)).length/teamRows.length*100})).sort((a,b)=>b.teams-a.teams);
const units=unitOrder.map(unit=>{const rows=teamRows.filter(r=>r.unit===unit);const statusCounts=Object.fromEntries(['pain','okay','unclear'].map(s=>[s,rows.filter(r=>r.status===s).length]));
  const pains=totals.map(p=>({...p,unit,teams:rows.filter(r=>r.painIds.includes(p.id)).length,total:rows.length,
    share:rows.filter(r=>r.painIds.includes(p.id)).length/rows.length*100}));
  return {unit,teams:rows.length,responses:rows.reduce((s,r)=>s+r.responseCount,0),...statusCounts,pains,
    topPainIds:[...pains].sort((a,b)=>b.teams-a.teams).filter(p=>p.teams>0).slice(0,3).map(p=>p.id)};});
const closedMentions=teamRows.reduce((s,r)=>s+r.painCount,0);
const statusCounts=Object.fromEntries(['pain','okay','unclear'].map(s=>[s,teamRows.filter(r=>r.status===s).length]));
const unions=defs.slice(0,2).map(([id])=>id);
const keyPair={either:teamRows.filter(r=>unions.some(id=>r.painIds.includes(id))).length,both:teamRows.filter(r=>unions.every(id=>r.painIds.includes(id))).length};
const summary={teams:76,units:8,responses:79,...statusCounts,closedMentions,
  teamsWithClosedPains:teamRows.filter(r=>r.painIds.length).length,freeComments:quoteRows.length,
  painComments:quoteRows.filter(r=>r.status==='pain').length,
  earliestResponse:responses.reduce((a,r)=>a<r.completedAt?a:r.completedAt,responses[0].completedAt),
  latestResponse:responses.reduce((a,r)=>a>r.completedAt?a:r.completedAt,responses[0].completedAt),
  sharedTopPains:keyPair};
assert.deepEqual(statusCounts,{pain:74,okay:1,unclear:1});
assert.deepEqual(totals.map(p=>p.teams),[46,41,31,24,22,19,12,11]);
assert.equal(quoteRows.length,10);assert.equal(summary.painComments,8);
assert.equal(units.reduce((s,u)=>s+u.teams,0),76);
assert.equal(units.reduce((s,u)=>s+u.responses,0),79);
assert.equal(totals.reduce((s,p)=>s+p.teams,0),closedMentions);
const source={name:'Опрос DDI, III квартал 2026',type:'local-files',files:input.files.map(f=>({name:f.file,sha256:f.sha256})),
  asOf:'2026-10-28',period:'III квартал 2026',
  evidenceFlow:[{title:'Исходные анкеты',detail:'Записи CSV за 2026 год / III квартал. Идентичные JSON-ответы в повторных выгрузках объединены по SHA256 полного payload.'},
    {title:'Исключения',detail:'Две ранее указанные пользователем тестовые анкеты исключены; 79 валидных анкет.'},
    {title:'Единица анализа',detail:'76 канонических команд. У зарплатного продукта объединены B2B/B2C, у ОМС и Слитков — по две анкеты. Для закрытого пункта одна команда учитывается один раз, если его отметил хотя бы один респондент.'},
    {title:'Свободные ответы',detail:'10 комментариев проверены вручную: 8 описывают проблемы, 1 прямо говорит об отсутствии критичных проблем, 1 содержит только «-». «Другое» без расшифровки не считается отсутствием проблем. Свободные темы не прибавляются к частотам закрытых опций.'}],
  caveats:['Множественный выбор: доли по проблемам не суммируются в 100%.','Частота упоминания не измеряет тяжесть проблемы.','Выбор «Другое» сам по себе не означает жалобу.','«Всё ок» — явная самооценка одной команды, а не вывод по уровню DDI.','Вопрос о поддержке был обязательным и не содержал отдельного варианта «всё устраивает». 74/1/1 — классификация ответов, а не измерение доли удовлетворённых команд.'],
};
const query=(rows,definition)=>({rows,source:{...source,metricDefinitions:[{label:'Определение',definition}]},methods:[{language:'JavaScript',code:'См. сохранённый analyze.mjs: фильтр периода → исключение тестов → объединение по canonicalTeam.id → множество выбранных закрытых опций → подсчёт команд и долей.'}]});
const snapshot={surface:'report',title:'Что мешает командам B2C работать с данными',status:'reviewed',generatedAt:new Date().toISOString(),
  report:{title:'Боли команд B2C',subtitle:'Опрос DDI · III квартал 2026',asOf:'2026-10-28'},filters:[],
  exportPreferences:{selected:null,destinations:[]},
  queries:{team_pains:query(teamRows,'Одна строка — одна каноническая команда; боли объединены по всем её валидным анкетам.'),
    pain_totals:query(totals,'Команды, выбравшие закрытую опцию, / 76 команд. Повторные ответы одной команды не увеличивают число.'),
    unit_totals:query(units.map(({pains,...u})=>u),'Число команд и статусы по юниту.'),
    unit_pains:query(units.flatMap(u=>u.pains),'Команды юнита, выбравшие боль, / число ответивших команд этого юнита.'),
    survey_comments:query(quoteRows,'Дословные комментарии из поля supportOther с ручной смысловой классификацией.'),
    survey_summary:query([summary],'79 валидных анкет 76 команд; доля каждого статуса считается от 76 команд.')},
  analysis:{summary,painDefinitions:defs.map(([id,label,fullLabel])=>({id,label,fullLabel})),units,teamRows,quoteRows},
};
await fs.writeFile(new URL('reviewed.json',dir),JSON.stringify(snapshot,null,2));
await fs.writeFile(new URL('validation.json',dir),JSON.stringify({summary,totals,units:units.map(({pains,...u})=>u),sourceFiles:source.files},null,2));
console.log(JSON.stringify({summary,totals:totals.map(p=>({label:p.label,teams:p.teams,share:p.share})),unitStatus:units.map(({pains,...u})=>u)},null,2));
