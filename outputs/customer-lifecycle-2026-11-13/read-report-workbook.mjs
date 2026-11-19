import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const productIds = new Map([['Вклады', 'deposits'], ['Прайм', 'prime'], ['deposits', 'deposits'], ['prime', 'prime']]);
const marketKeys = ['tamApproved', 'samApproved', 'samVolume', 'identified'];
const salesKeys = ['reporting', 'monthly', 'process', 'journey'];
const text = value => value == null ? '' : String(value).trim();
const boolean = (value, at) => {
  if (value === true || text(value) === 'Да') return true;
  if (value === false || text(value) === 'Нет') return false;
  throw new Error(`${at}: укажите Да или Нет`);
};
function source(row, start, at) {
  const [title, url, locator] = row.slice(start, start + 3).map(text);
  if (!title && !url && !locator) return null;
  if (!title) throw new Error(`${at}: укажите название источника`);
  return {title, ...(url && {url}), ...(locator && {locator})};
}

export function reportFromWorkbookRows(rows, recommendationRows) {
  if (rows[2]?.[0] !== 'reportId' || rows[2]?.[3] !== 'selectedProduct' || rows[2]?.[6] !== 'generatedAt') throw new Error('Данные!3: изменены ключи настроек отчёта');
  const data = {
    schemaVersion: 1, reportId: text(rows[2][1]), selectedProduct: productIds.get(text(rows[2][4])) || text(rows[2][4]),
    generatedAt: text(rows[2][7]) || null,
    products: Object.fromEntries(['deposits', 'prime'].map(id => [id, {market: {}, sales: {}, recommendations: [], samGrowthEvents: []}])),
  };
  const seen = new Set();
  rows.slice(6).forEach((row, index) => {
    if (row.every(value => !text(value))) return;
    const at = `Данные!${index + 7}`;
    const id = productIds.get(text(row[0]));
    const key = text(row[1]);
    if (!id || ![...marketKeys, ...salesKeys].includes(key)) throw new Error(`${at}: неизвестный продукт или ключ поля`);
    const signature = `${id}.${key}`;
    if (seen.has(signature)) throw new Error(`${at}: повтор поля ${signature}`);
    seen.add(signature);
    const origin = source(row, 6, at);
    if (marketKeys.includes(key)) data.products[id].market[key] = {
      value: key.endsWith('Approved') ? boolean(row[3], at) : row[3] == null || text(row[3]) === '' ? null : row[3], source: origin,
    };
    else data.products[id].sales[key] = {checked: boolean(row[3], at), url: text(row[4]), source: origin};
  });
  for (const id of ['deposits', 'prime']) for (const key of [...marketKeys, ...salesKeys]) {
    if (!seen.has(`${id}.${key}`)) throw new Error(`Данные: отсутствует поле ${id}.${key}`);
  }
  recommendationRows.slice(6).forEach((row, index) => {
    // Reserved rows with product/type but no authored content are not recommendations.
    if (!row.slice(2).some(value => text(value))) return;
    const at = `Рекомендации!${index + 7}`;
    const id = productIds.get(text(row[0]));
    const kind = new Map([['Рекомендация', 'recommendations'], ['Событие SAM', 'samGrowthEvents']]).get(text(row[1]));
    if (!id || !kind) throw new Error(`${at}: неизвестный продукт или тип записи`);
    data.products[id][kind].push({title: text(row[2]), description: text(row[3]), source: source(row, 5, at)});
  });
  return data;
}

export async function readReportWorkbook(path) {
  let modulePath;
  try { modulePath = createRequire(import.meta.url).resolve('@oai/artifact-tool'); }
  catch {
    const dependencies = process.env.ARTIFACT_NODE_MODULES || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
    try { modulePath = createRequire(join(dependencies, '..', 'package.json')).resolve('@oai/artifact-tool'); }
    catch { throw new Error('Для чтения XLSX нужен @oai/artifact-tool: установите runtime или задайте ARTIFACT_NODE_MODULES'); }
  }
  const {FileBlob, SpreadsheetFile} = await import(pathToFileURL(modulePath).href);
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
  return reportFromWorkbookRows(
    workbook.worksheets.getItem('Данные').getUsedRange().values,
    workbook.worksheets.getItem('Рекомендации').getUsedRange().values,
  );
}
