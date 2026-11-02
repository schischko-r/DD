import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
import {enabledTeams as products} from '../../gravity-app/src/deposits-survey/teams.js';
import {enabledTeams as others} from '../../gravity-app/src/other-surveys/teams.js';

const out=fileURLToPath(new URL('./',import.meta.url));
const ddi=JSON.parse(await fs.readFile(new URL('../../gravity-app/public/report-data.json',import.meta.url),'utf8'));
const salary=products.find(t=>t.name==='Зарплатный продукт');assert.ok(salary);
const all=[...products,...others].filter(t=>t.name!=='ДУ'&&t.id!==salary.id);
all.push({...salary,id:'salary-b2c',name:'Зарплатный проект #B2C',sourceId:salary.id},
  {...salary,id:'salary-b2b',name:'Зарплатный проект #B2B'});
const units=['CBP','CX','DB','DP','Data','PC','ДомКлик','УБ'];
all.sort((a,b)=>units.indexOf(a.unit)-units.indexOf(b.unit)||a.name.localeCompare(b.name,'ru'));
const aliases={
  'Сберчаевые #B2C':'СберЧаевые',
  'Трансграничные переводы #B2C':'Трансграничные переводы',
  'Трансграничный эквайринг #B2C':'Трансграничный эквайринг',
};
const codes=['attract.nalichie_self_service','attract.nalichie_uspeshnyh_biznes_zapuskov','attract.campaign_launches'];
const colorNames={green:'Зелёный',yellow:'Жёлтый',red:'Красный',gray:'Серый'};
const rows=all.map(t=>{
  const b2b=t.name.includes('#B2B');
  const source=ddi.products.find(p=>p.id===(t.sourceId||t.id))||ddi.products.find(p=>p.name===aliases[t.name]);
  assert.ok(b2b||source,`Unmatched source: ${t.name}`);
  const metrics=codes.map(code=>{
    if(b2b)return {code,relevance:'?',light:'?',color:null,reason:'B2B: заполнение «?» по указанию пользователя'};
    const m=source.metrics.flatMap(b=>b.metrics||[]).find(m=>m.code===code);
    if(!m||m.is_applicabble_flg===false)return {code,relevance:'Нерелевантно',light:'Серый',color:'gray',reason:m?'Неприменимо в DDI':'Метрика отсутствует в карточке DDI'};
    const color=m.traffic_light in colorNames?m.traffic_light:null;
    return {code,relevance:'Релевантно',light:colorNames[color]||'?',color,value:m.value,max:m.max_value};
  });
  return {unit:t.unit,name:t.name,id:t.id,sourceId:b2b?null:source.id,sourceName:b2b?null:source.name,metrics};
});
assert.equal(rows.length,80);assert.equal(new Set(rows.map(r=>r.id)).size,80);
assert.ok(rows.some(r=>r.unit==='PC'&&r.name==='Чат'));
assert.equal(rows.filter(r=>r.name.includes('#B2B')).length,4);
assert.ok(rows.filter(r=>r.name.includes('#B2B')).every(r=>r.metrics.every(m=>m.relevance==='?'&&m.light==='?')));
await fs.writeFile(out+'rows.json',JSON.stringify(rows,null,2));
const wb=Workbook.create(),s=wb.worksheets.add('Участники опросов');
s.showGridLines=false;s.tabColor='#163A56';
s.getRange('A1:H96').format.font={name:'Arial',size:10,color:'#172B3A'};
s.getRange('A1:H96').format.verticalAlignment='center';
s.getRange('A1').values=[['Команды опросов DDI']];
s.getRange('A1').format.font={name:'Arial',size:15,bold:true,color:'#163A56'};
s.getRange('A2').values=[['80 команд. ДУ исключён. Зарплатный проект разделён на #B2C и #B2B; для всех #B2B указано «?».']];
s.getRange('A3').values=[['Релевантность и светофоры — по текущим карточкам DDI. Успешные пилоты = «Наличие успешных бизнес-запусков»; запуски = «Запуски кампаний за квартал».']];
s.getRange('A2:H3').format.font={name:'Arial',size:10,color:'#53697B'};
const headers=['Юнит','Команда','Self-service: релевантность','Self-service: светофор','Успешные пилоты: релевантность','Успешные пилоты: светофор','Запуски: релевантность','Запуски: светофор'];
s.getRange('A5:H85').values=[headers,...rows.map(r=>[r.unit,r.name,...r.metrics.flatMap(m=>[m.relevance,m.light])])];
const table=s.tables.add('A5:H85',true,'SurveyTeams');table.showFilterButton=true;
s.getRange('A5:H5').format={fill:'#163A56',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,rowHeight:50};
s.getRange('A6:H85').format.wrapText=true;s.getRange('A6:H85').format.rowHeight=32;
s.getRange('A1:A96').format.columnWidth=13;
s.getRange('B1:B96').format.columnWidth=54;
s.getRange('C1:H96').format.columnWidth=21;
const fills={green:['#DDF2E3','#23633D'],yellow:['#FFF0C2','#795B0A'],red:['#FADDDD','#9F3030'],gray:['#EAEDEF','#59656E']};
rows.forEach((r,i)=>{
  const n=i+6;
  if(r.name.length>48)s.getRange(`A${n}:H${n}`).format.rowHeight=44;
  r.metrics.forEach((m,j)=>{
    const col=['D','F','H'][j];
    if(m.color){const [fill,color]=fills[m.color];s.getRange(`${col}${n}`).format={fill,font:{name:'Arial',size:10,bold:true,color},horizontalAlignment:'center'};}
  });
});
s.getRange('A87').values=[['Источники для B2C']];s.getRange('A87').format.font={name:'Arial',size:11,bold:true,color:'#163A56'};
s.getRange('B88:D91').values=[
  ['Зарплатный проект #B2C','Зарплатный продукт','Данные прежней команды'],
  ['Сберчаевые #B2C','СберЧаевые','Данные прежней команды'],
  ['Трансграничные переводы #B2C','Трансграничные переводы','Данные прежней команды'],
  ['Трансграничный эквайринг #B2C','Трансграничный эквайринг','Данные прежней команды'],
];
s.getRange('B88:D91').format.wrapText=true;s.getRange('B88:D91').format.rowHeight=40;
s.getRange('A93').values=[['Если метрика отсутствует в карточке DDI, указано «Нерелевантно» и серый светофор. «?» означает, что оценка не переносилась.']];
s.getRange('A94').values=[['Источник: текущий DDI standalone, оценка II квартала 2026; состав команд — текущие опросники с согласованными изменениями.']];
s.getRange('A93:H94').format.font={name:'Arial',size:10,color:'#53697B'};
s.freezePanes.freezeRows(5);s.freezePanes.freezeColumns(2);
wb.recalculate();
assert.equal(s.getRange('A6:H85').values.length,80);
const preview=await wb.render({sheetName:s.name,range:'A1:H26',scale:1,format:'png'});
await fs.writeFile(out+'preview.png',new Uint8Array(await preview.arrayBuffer()));
await (await SpreadsheetFile.exportXlsx(wb)).save(out+'Команды_опросов_DDI_80.xlsx');
console.log(JSON.stringify({teams:80,b2bUnknown:4,chat:true,du:false}));
