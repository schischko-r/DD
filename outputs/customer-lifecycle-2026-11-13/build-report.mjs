import {readFile, writeFile, rename, unlink} from 'node:fs/promises';
import {resolve, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readReportWorkbook} from './read-report-workbook.mjs';

const templatePath = fileURLToPath(new URL('./index.html', import.meta.url));
const productIds = ['deposits', 'prime'];
const salesKeys = ['reporting', 'monthly', 'process', 'journey'];
const fail = message => { throw new Error(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const httpUrl = value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname); }
  catch { return false; }
};

function validateSource(source, path) {
  if (source === null || source === undefined) return;
  if (!object(source) || typeof source.title !== 'string' || !source.title.trim()) fail(`${path}.title: укажите название источника`);
  if (source.url !== undefined && (typeof source.url !== 'string' || !httpUrl(source.url))) fail(`${path}.url: допустима абсолютная ссылка http(s)`);
  if (source.locator !== undefined && typeof source.locator !== 'string') fail(`${path}.locator: ожидается строка`);
}

export function validateReportData(data) {
  if (!object(data) || data.schemaVersion !== 1) fail('schemaVersion: ожидается 1');
  if (typeof data.reportId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(data.reportId)) fail('reportId: используйте 1–120 букв, цифр, точек, дефисов или подчёркиваний');
  if (!productIds.includes(data.selectedProduct)) fail('selectedProduct: deposits или prime');
  if (data.generatedAt !== null && (typeof data.generatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(data.generatedAt) || !Number.isFinite(Date.parse(data.generatedAt)))) fail('generatedAt: ISO-дата или null');
  if (!object(data.products)) fail('products: ожидается объект');
  for (const id of productIds) {
    const product = data.products[id];
    if (!object(product) || !object(product.market) || !object(product.sales)) fail(`products.${id}: нужны market и sales`);
    for (const key of ['tamApproved', 'samApproved', 'samVolume', 'identified']) {
      const field = product.market[key];
      const path = `products.${id}.market.${key}`;
      if (!object(field)) fail(`${path}: нужен объект {value, source}`);
      if (key.endsWith('Approved')) {
        if (typeof field.value !== 'boolean') fail(`${path}.value: ожидается boolean`);
      } else if (field.value !== null) {
        const value = typeof field.value === 'string' ? field.value.replace(/\s/g, '').replace(',', '.') : field.value;
        if (!['number', 'string'].includes(typeof field.value) || (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value)) || !Number.isFinite(Number(value)) || Number(value) < 0) fail(`${path}.value: неотрицательное число, числовая строка или null`);
      }
      validateSource(field.source, `${path}.source`);
    }
    for (const key of salesKeys) {
      const item = product.sales[key];
      const path = `products.${id}.sales.${key}`;
      if (!object(item) || typeof item.checked !== 'boolean' || typeof item.url !== 'string') fail(`${path}: нужны checked:boolean и url:string`);
      if (item.url && !httpUrl(item.url)) fail(`${path}.url: допустима абсолютная ссылка http(s)`);
      validateSource(item.source, `${path}.source`);
      if (item.checked && key !== 'monthly' && !item.url && !item.source) fail(`${path}: для отметки нужна ссылка на результат или подтверждающий источник`);
    }
    for (const key of ['recommendations', 'samGrowthEvents']) {
      if (!Array.isArray(product[key])) fail(`products.${id}.${key}: ожидается массив`);
      product[key].forEach((item, index) => {
        const path = `products.${id}.${key}[${index}]`;
        if (!object(item) || typeof item.title !== 'string' || !item.title.trim() || typeof item.description !== 'string' || !item.description.trim()) fail(`${path}: нужны непустые title и description`);
        validateSource(item.source, `${path}.source`);
      });
    }
  }
  return data;
}

export async function buildReport(inputPath, outputPath) {
  const input = resolve(inputPath);
  const output = resolve(outputPath);
  if (output === resolve(templatePath) || output === input) fail('Выберите отдельный выходной HTML: шаблон и JSON нельзя перезаписывать');
  const data = validateReportData(/\.xlsx$/i.test(input) ? await readReportWorkbook(input) : JSON.parse(await readFile(input, 'utf8')));
  if (data.reportId === 'customer-lifecycle-2026-11-13') fail('Для собранного отчёта задайте уникальный reportId вместо идентификатора шаблона');
  const template = await readFile(templatePath, 'utf8');
  const pattern = /(<script\b[^>]*\bid="report-data"[^>]*>)[\s\S]*?(<\/script>)/g;
  if ([...template.matchAll(pattern)].length !== 1) fail('Шаблон должен содержать ровно один script#report-data');
  const payload = JSON.stringify(data, null, 2).replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const html = template.replace(pattern, (_match, open, close) => `${open}\n${payload}\n${close}`);
  const temporary = resolve(dirname(output), `.${basename(output)}.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(temporary, html, {flag: 'wx'});
    await rename(temporary, output);
  } finally { await unlink(temporary).catch(() => {}); }
  return {output, reportId: data.reportId};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--data' || args[2] !== '--output') {
    process.stderr.write('Использование: node build-report.mjs --data report.json|report.xlsx --output report.html\n');
    process.exitCode = 1;
  } else {
    try { const result = await buildReport(args[1], args[3]); process.stdout.write(`Собран отчёт: ${result.output}\n`); }
    catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
  }
}
