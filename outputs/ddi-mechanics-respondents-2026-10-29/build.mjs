import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const dir=new URL('.',import.meta.url).pathname;
const data=JSON.parse(await fs.readFile(`${dir}inputs.json`,'utf8'));
const w=Workbook.create();
function sheet(name,title,headers,widths,count){const s=w.worksheets.add(name);s.showGridLines=false;
 s.getRangeByIndexes(0,0,count+4,headers.length).format.font={name:'Arial',size:10,color:'#353044'};
 s.getRange('A2').values=[[title]];s.getRange('A2').format.font={name:'Arial',size:14,bold:true,color:'#71617F'};
 s.getRangeByIndexes(3,0,1,headers.length).values=[headers];s.getRangeByIndexes(3,0,1,headers.length).format={fill:'#85718F',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:44,wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'};
 widths.forEach((v,i)=>s.getRangeByIndexes(0,i,count+4,1).format.columnWidth=v);s.freezePanes.freezeRows(4);return s;}
const s=sheet('Механики и ФИО','Механики: участники и результаты опроса',['Юнит','Команда','ФИО проходившего','Логин участника','Вариант','Баллы были','Баллы стали','Макс. группы','Было, 0–100','Стало, 0–100','Изменение, п.п.','Макс. команды','Вклад DDI, п.п.'],[12,46,46,36,10,14,14,16,15,15,18,16,18],data.summary.length);
data.summary.forEach((r,i)=>{const n=i+5;s.getRange(`A${n}:H${n}`).values=[[r.unit,r.team,r.fio,r.participant,r.variant,r.old,r.new,r.maximum]];s.getRange(`I${n}:K${n}`).formulas=[[`=F${n}/H${n}*100`,`=G${n}/H${n}*100`,`=J${n}-I${n}`]];s.getRange(`L${n}`).values=[[r.den]];s.getRange(`M${n}`).formulas=[[`=(G${n}-F${n})/L${n}*100`]];});
s.getRange(`F5:H78`).setNumberFormat('0.00');s.getRange('I5:K78').setNumberFormat('0.0');s.getRange('L5:M78').setNumberFormat('0.00');
const d=sheet('Ответы по механикам','Ответы по механикам с ФИО участника',['Юнит','Команда','ФИО проходившего','Логин участника','Вариант','Метрика механик','Балл был','Балл стал','Макс. балл','В индексе','Вопрос','Ответ участника','Варианты ответа','Подтверждение','Комментарий','Файл-источник','Строка CSV'],[12,46,46,36,10,43,13,13,13,12,62,62,54,65,62,31,14],data.details.length);
d.getRange(`A5:Q${data.details.length+4}`).values=data.details.map(r=>[r.unit,r.team,r.fio,r.participant,r.variant,r.metric,r.old,r.new,r.maximum,r.included?'Да':'Нет',r.question,r.answer,r.options,r.proof,r.comment,r.file,r.row]);
d.getRange(`G5:I${data.details.length+4}`).setNumberFormat('0.00');d.getRange(`K5:O${data.details.length+4}`).format.wrapText=true;d.getRange(`A5:Q${data.details.length+4}`).format.rowHeight=60;
s.getRange('O4:P9').values=[['О расчёте','Пояснение'],['База','II кв. 2026. Результаты предыдущего расчёта сохранены.'],['Выборка','74 набора ответов, 70 команд. Без прежней оценки команды исключены.'],['Повторные ответы','Каждый участник — отдельная строка. Вариант соответствует прежней детализации.'],['Баллы метрик','Взвешенные баллы DDI. Для группы отдельно приведена шкала 0–100.'],['Источник ФИО','Поле «ФИО» исходных questionare-uplifts(5/6/7).csv, без дополнения имён.']];s.getRange('O4:P9').format.columnWidth=50;s.getRange('O4:P9').format.wrapText=true;s.getRange('O4:P9').format.rowHeight=45;
const cross=JSON.parse(await fs.readFile(`${dir}crosssell.json`,'utf8'));
const c=sheet('Кросс-селл после покупки','Cross-sell после оформления продукта: ответы анкеты',['Юнит','Команда','ФИО проходившего','Логин участника','Ответ','Подтверждение / продукт','Комментарий','Вопрос','Статус в расчёте','Файл-источник','Строка CSV'],[12,46,46,36,25,70,60,70,35,31,14],cross.length);
c.getRange(`A5:K${cross.length+4}`).values=cross.map(r=>[r.unit,r.team,r.fio,r.participant,r.answer,r.proof,r.comment,r.question,r.scope,r.source,r.row]);
c.getRange(`E5:I${cross.length+4}`).format.wrapText=true;c.getRange(`A5:K${cross.length+4}`).format.rowHeight=65;
c.getRange('M4:N7').values=[['Что показано','Пояснение'],['Ответы анкеты','41 ответ от 37 команд. Повторные ответы участников сохранены отдельно.'],['Связь с DDI','У этих строк в CSV пустые баллы и аплифт. Ответы не пересчитаны в баллы.'],['Прежняя оценка','Исторический балл Cross-sell на листе ответов по механикам сохранён отдельно.']];c.getRange('M4:N7').format.columnWidth=58;c.getRange('M4:N7').format.wrapText=true;
w.recalculate();
const expected=data.summary.map(r=>[r.old/r.maximum*100,r.new/r.maximum*100,(r.new-r.old)/r.maximum*100]);s.getRange('I5:K78').values.forEach((row,i)=>row.forEach((v,j)=>{if(Math.abs(v-expected[i][j])>1e-8)throw Error('Score mismatch')}));
console.log((await w.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:10},maxChars:500})).ndjson);
for(const [name,range]of [['Кросс-селл после покупки','A1:F12']]){const b=await w.render({sheetName:name,range,scale:1.2,format:'png'});await fs.writeFile(`${dir}${name}.png`,new Uint8Array(await b.arrayBuffer()));}
await(await SpreadsheetFile.exportXlsx(w)).save(`${dir}Механики_DDI_ФИО_кросс_селл.xlsx`);
console.log(JSON.stringify({respondents:data.summary.length,teams:new Set(data.summary.map(r=>r.team)).size,metricRows:data.details.length}));
