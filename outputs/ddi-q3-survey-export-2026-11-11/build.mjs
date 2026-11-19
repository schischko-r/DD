import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';

const dir=new URL('.',import.meta.url);
const data=JSON.parse(await fs.readFile(new URL('data.json',dir),'utf8'));
const headers=['Юнит','Команда','Группа метрик','Метрика','Балл в III квартале, %','Вопрос','Варианты','Комментарий','Ссылки'];
const wb=Workbook.create(),sheet=wb.worksheets.add('III квартал 2026');
const last=data.rows.length+1;
sheet.showGridLines=false;
sheet.tabColor='#244A73';
const used=sheet.getRange(`A1:I${last}`);
used.format.font={name:'Arial',size:10,color:'#243447'};
used.format.verticalAlignment='top';
used.format.wrapText=true;
sheet.getRange('A1:I1').values=[headers];
sheet.getRange(`A2:I${last}`).values=data.rows.map(row=>row.map(value=>typeof value==='string'&&value.startsWith('=')?"'"+value:value));
const table=sheet.tables.add(`A1:I${last}`,true,'DdiQ3Metrics');
table.showBandedRows=true;
table.showFilterButton=true;
sheet.getRange('A1:I1').format={fill:'#244A73',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},
  rowHeight:36,wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',
  borders:{insideVertical:{style:'thin',color:'#FFFFFF'}}};
const widths=[13,36,30,54,20,65,58,125,92];
widths.forEach((width,index)=>sheet.getRange(`${String.fromCharCode(65+index)}1:${String.fromCharCode(65+index)}${last}`).format.columnWidth=width);
sheet.getRange(`E2:E${last}`).setNumberFormat('0%');
sheet.getRange(`E2:E${last}`).format.horizontalAlignment='right';
sheet.freezePanes.freezeRows(1);
sheet.freezePanes.freezeColumns(2);
// Size to the actual wrapped text, including multi-line choices, comments and URLs.
let maxHeight=0;
for(let index=0;index<data.rows.length;index++) {
  const row=data.rows[index];
  const lines=Math.max(...row.map((value,col)=>textLines(value,widths[col])));
  const height=Math.min(409,Math.max(29,lines*13.5+9));
  maxHeight=Math.max(maxHeight,height);
  sheet.getRange(`A${index+2}:I${index+2}`).format.rowHeight=height;
}
function textLines(value,width) {
  if(typeof value!=='string') return 1;
  const capacity=Math.max(8,Math.floor(width*0.93));
  return value.split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/capacity)),0);
}
wb.recalculate();
const actual=sheet.getRange(`A2:I${last}`).values;
assert.deepEqual(actual,data.rows);
const inspection=await wb.inspect({kind:'region',sheetId:sheet.name,range:'A1:I4',maxChars:4000,tableMaxRows:4,tableMaxCols:9});
await fs.writeFile(new URL('inspection.json',dir),JSON.stringify(inspection,null,2));
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},maxChars:2000});
await fs.writeFile(new URL('error-scan.json',dir),JSON.stringify(errors,null,2));
const previews=[['preview-scores.png','A1:E5'],['preview-evidence.png','F1:I4']];
for(const [name,range] of previews) {
  const image=await wb.render({sheetName:sheet.name,range,scale:1,format:'png'});
  await fs.writeFile(new URL(name,dir),new Uint8Array(await image.arrayBuffer()));
}
const output=new URL('DDI_III_квартал_2026_метрики_и_ответы.xlsx',dir);
await (await SpreadsheetFile.exportXlsx(wb)).save(fileURLToPath(output));
const validation={...data.validation,sourceHashes:undefined,headers,output:fileURLToPath(output),
  sha256:createHash('sha256').update(await fs.readFile(output)).digest('hex'),maxRowHeight:maxHeight,errors:errors.ndjson};
await fs.writeFile(new URL('validation.json',dir),JSON.stringify(validation,null,2));
console.log(JSON.stringify(validation));
