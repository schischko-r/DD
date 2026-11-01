import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {FileBlob, SpreadsheetFile} from '@oai/artifact-tool';

const dir = new URL('./', import.meta.url);
const input = new URL('DDI_II_III_2026_обновлено.xlsx', dir);
const output = new URL('DDI_II_III_2026.xlsx', dir);
const cleaned = JSON.parse(await fs.readFile(new URL('comments-clean.json', dir), 'utf8'));
assert.equal(cleaned.length, 3302);
const book = await SpreadsheetFile.importXlsx(await FileBlob.load(fileURLToPath(input)));
const summary = book.worksheets.getItem('Команды'), details = book.worksheets.getItem('Метрики');
const oldSummary = summary.getRange('A1:G82').values;
const oldMetrics = details.getRange('A1:M3308').values;
const oldFormulas = details.getRange('H7:H3308').formulas;
for (let i=0; i<cleaned.length; i++) {
  assert.equal(cleaned[i].team, oldMetrics[i+6][1]);
  assert.ok(cleaned[i].comment.length <= 32767);
}
details.getRange('L7:L3308').values = cleaned.map(r => [r.comment]);
// Header text must be final before creating the native Excel tables.
for (const [sheet, name, range] of [[summary,'TeamScores','A6:G82'],[details,'MetricScores','A6:M3308']]) {
  const existing = sheet.tables.items.find(t => t.name === name);
  assert.ok(existing);
  const style = existing.style;
  existing.delete();
  const replacement = sheet.tables.add(range, true, name);
  replacement.style = style;
  replacement.showFilterButton = true;
}
book.recalculate();
assert.deepEqual(summary.getRange('A1:G82').values, oldSummary);
assert.deepEqual(details.getRange('H7:H3308').formulas, oldFormulas);
const current = details.getRange('A1:M3308').values;
for (let r=0; r<current.length; r++) for (let c=0; c<13; c++) {
  if (r>=6 && c===11) continue;
  const old = oldMetrics[r][c], now = current[r][c];
  const emptyFormula = r>=6 && c===7 && [null,''].includes(old) && [null,''].includes(now);
  if (!Object.is(old,now) && !emptyFormula) throw new Error(`Unexpected change: row ${r+1}, column ${c+1}`);
}
const scan = await book.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},maxChars:1000});
await fs.writeFile(new URL('repair-check.ndjson',dir), scan.ndjson);
for (const [sheetName,range,name] of [['Команды','A1:G14','preview-repaired-teams.png'],['Метрики','I6:M10','preview-repaired-comments.png']]) {
  const preview = await book.render({sheetName,range,scale:1,format:'png'});
  await fs.writeFile(new URL(name,dir),new Uint8Array(await preview.arrayBuffer()));
}
await (await SpreadsheetFile.exportXlsx(book)).save(fileURLToPath(output));
console.log(JSON.stringify({file:fileURLToPath(output),comments:cleaned.length,allScoresAndAnswersPreserved:true,errors:scan.ndjson}));
