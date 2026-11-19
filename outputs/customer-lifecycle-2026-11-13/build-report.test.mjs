import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {buildReport, validateReportData} from './build-report.mjs';
import {readReportWorkbook, reportFromWorkbookRows} from './read-report-workbook.mjs';

const require = createRequire(new URL('../../gravity-app/package.json', import.meta.url));
const {JSDOM} = require('jsdom');
const templatePath = fileURLToPath(new URL('./index.html', import.meta.url));
const builderPath = fileURLToPath(new URL('./build-report.mjs', import.meta.url));

function fixture() {
  return {
    schemaVersion: 1, reportId: 'builder-test-report', generatedAt: '2026-11-16T10:00:00Z', selectedProduct: 'prime',
    products: Object.fromEntries(['deposits', 'prime'].map(id => [id, {
      market: {
        tamApproved: {value: true, source: null}, samApproved: {value: false, source: null},
        samVolume: {value: '9007199254740993123456', source: {title: 'Workbook', locator: 'Sheet 1!B2'}},
        identified: {value: '123 456,70', source: null},
      },
      sales: Object.fromEntries(['reporting', 'monthly', 'process', 'journey'].map(key => [key, {checked: key === 'monthly', url: '', source: null}])),
      recommendations: [], samGrowthEvents: [],
    }])),
  };
}

async function files(t, data = fixture()) {
  const directory = await mkdtemp(join(tmpdir(), 'ddi-lifecycle-report-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const input = join(directory, 'report.json');
  const output = join(directory, 'report.html');
  await writeFile(input, JSON.stringify(data));
  return {directory, input, output};
}

test('builder embeds the exact JSON safely as one nonexecutable payload', async t => {
  const data = fixture();
  const attack = '</script><script id="injected">globalThis.bad = true</script><img src=x>&\u2028\u2029';
  data.products.prime.recommendations = [{title: attack, description: attack, source: {title: attack, url: 'https://example.org/source?x=1&y=2'}}];
  data.products.deposits.sales.process = {checked: true, url: '', source: {title: 'Локальный документ', locator: 'Раздел 3'}};
  const {input, output} = await files(t, data);
  const inputBefore = await readFile(input, 'utf8');
  const templateBefore = await readFile(templatePath, 'utf8');
  const result = await buildReport(input, output);
  assert.deepEqual(result, {output, reportId: data.reportId});
  const generated = new JSDOM(await readFile(output, 'utf8')).window.document;
  const payloads = generated.querySelectorAll('script#report-data[type="application/json"]');
  assert.equal(payloads.length, 1);
  assert.deepEqual(JSON.parse(payloads[0].textContent), data);
  assert.doesNotMatch(payloads[0].textContent, /[<>&\u2028\u2029]/);
  assert.equal(generated.querySelector('#injected,img[src="x"]'), null);
  const template = new JSDOM(templateBefore).window.document;
  assert.deepEqual(
    [...generated.querySelectorAll('script:not([type="application/json"])')].map(script => script.textContent),
    [...template.querySelectorAll('script:not([type="application/json"])')].map(script => script.textContent),
    'the generated report retains the executable template unchanged',
  );
  assert.equal(await readFile(input, 'utf8'), inputBefore);
  assert.equal(await readFile(templatePath, 'utf8'), templateBefore);
});

test('validator rejects invalid values, unsupported products and unsafe sources', async t => {
  const cases = [
    ['schemaVersion', data => { data.schemaVersion = 2; }],
    ['selectedProduct', data => { data.selectedProduct = 'unknown'; }],
    ['products.prime', data => { delete data.products.prime; }],
    ['tamApproved', data => { data.products.deposits.market.tamApproved.value = 'true'; }],
    ['samVolume', data => { data.products.deposits.market.samVolume.value = -1; }],
    ['samVolume', data => { data.products.deposits.market.samVolume.value = Infinity; }],
    ['identified', data => { data.products.deposits.market.identified.value = ''; }],
    ['source.title', data => { data.products.deposits.market.samVolume.source.title = ''; }],
    ['source.url', data => { data.products.deposits.market.samVolume.source.url = 'javascript:alert(1)'; }],
    ['source.url', data => { data.products.deposits.market.samVolume.source.url = 'file:///tmp/report'; }],
    ['source.locator', data => { data.products.deposits.market.samVolume.source.locator = 123; }],
    ['sales.reporting', data => { data.products.prime.sales.reporting.checked = true; }],
    ['sales.journey.url', data => { data.products.prime.sales.journey.url = 'data:text/html,hello'; }],
    ['recommendations', data => { data.products.prime.recommendations = [{title: 'Action', description: ''}]; }],
  ];
  for (const [path, change] of cases) await t.test(path, () => {
    const data = fixture();
    change(data);
    assert.throws(() => validateReportData(data), error => error.message.includes(path));
  });
  assert.equal(validateReportData(fixture()).reportId, 'builder-test-report');
});

test('builder protects the input, template and existing output when validation fails', async t => {
  const {input, output} = await files(t);
  const templateBefore = await readFile(templatePath, 'utf8');
  const inputBefore = await readFile(input, 'utf8');
  await assert.rejects(buildReport(input, input), /нельзя перезаписывать/);
  await assert.rejects(buildReport(input, templatePath), /нельзя перезаписывать/);
  assert.equal(await readFile(input, 'utf8'), inputBefore);
  assert.equal(await readFile(templatePath, 'utf8'), templateBefore);
  await writeFile(output, 'previous report');
  const invalid = fixture();
  invalid.products.prime.market.identified.value = 'invalid';
  await writeFile(input, JSON.stringify(invalid));
  await assert.rejects(buildReport(input, output), /identified/);
  assert.equal(await readFile(output, 'utf8'), 'previous report');
  const reserved = fixture();
  reserved.reportId = 'customer-lifecycle-2026-11-13';
  await writeFile(input, JSON.stringify(reserved));
  await assert.rejects(buildReport(input, output), /уникальный reportId/);
  assert.equal(await readFile(output, 'utf8'), 'previous report');
});

test('the documented CLI creates a standalone report and reports invalid arguments', async t => {
  const {input, output} = await files(t);
  const run = spawnSync(process.execPath, [builderPath, '--data', input, '--output', output], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
  const doc = new JSDOM(await readFile(output, 'utf8')).window.document;
  assert.equal(JSON.parse(doc.getElementById('report-data').textContent).reportId, 'builder-test-report');
  assert.equal(doc.querySelectorAll('script[src],link[rel="stylesheet"]').length, 0);
  const badArgs = spawnSync(process.execPath, [builderPath], {encoding: 'utf8'});
  assert.equal(badArgs.status, 1);
  assert.match(badArgs.stderr, /Использование:/);
});

function workbookRows() {
  const data = fixture();
  const rows = Array.from({length: 6}, () => []);
  rows[2] = ['reportId', data.reportId, '', 'selectedProduct', 'Прайм', '', 'generatedAt', data.generatedAt];
  for (const [name, id] of [['Вклады', 'deposits'], ['Прайм', 'prime']]) {
    for (const [key, field] of Object.entries(data.products[id].market)) {
      const value = typeof field.value === 'boolean' ? field.value ? 'Да' : 'Нет' : field.value;
      rows.push([name, key, 'Описание поля', value, '', '', field.source?.title ?? '', field.source?.url ?? '', field.source?.locator ?? '']);
    }
    for (const [key, field] of Object.entries(data.products[id].sales)) rows.push([name, key, 'Описание задачи', field.checked ? 'Да' : 'Нет', field.url]);
  }
  const narratives = Array.from({length: 6}, () => []);
  narratives.push(['Вклады', 'Рекомендация', 'Проверить сегмент', 'Обоснование и ожидаемый результат', '', 'Источник', 'https://example.org/source', 'Раздел 4']);
  narratives.push(['Прайм', 'Событие SAM', 'Проверить событие', 'Критерий отбора и проверка гипотезы']);
  return {rows, narratives};
}

test('workbook rows preserve data types, source context and product-specific authored recommendations', () => {
  const {rows, narratives} = workbookRows();
  const result = validateReportData(reportFromWorkbookRows(rows, narratives));
  assert.equal(result.selectedProduct, 'prime');
  assert.equal(result.products.deposits.market.tamApproved.value, true);
  assert.equal(result.products.prime.market.samApproved.value, false);
  assert.equal(result.products.deposits.market.samVolume.value, '9007199254740993123456');
  assert.deepEqual(result.products.deposits.market.samVolume.source, {title: 'Workbook', locator: 'Sheet 1!B2'});
  assert.equal(result.products.deposits.recommendations[0].title, 'Проверить сегмент');
  assert.deepEqual(result.products.deposits.recommendations[0].source, {title: 'Источник', url: 'https://example.org/source', locator: 'Раздел 4'});
  assert.equal(result.products.prime.samGrowthEvents[0].title, 'Проверить событие');
  assert.equal(result.products.prime.recommendations.length, 0);
});

test('workbook rows reject duplicate or missing fields and invalid typed inputs', async t => {
  for (const [name, change, expected] of [
    ['duplicate', rows => rows.push([...rows[6]]), /повтор поля/],
    ['missing', rows => rows.splice(6, 1), /отсутствует поле/],
    ['unknown key', rows => { rows[6][1] = 'unknown'; }, /неизвестный продукт или ключ/],
    ['invalid boolean', rows => { rows[6][3] = 'Возможно'; }, /Да или Нет/],
    ['invalid number', rows => { rows[8][3] = 'не число'; }, /samVolume/],
    ['source missing title', rows => { rows[8][6] = ''; rows[8][7] = 'https://example.org/source'; }, /название источника/],
    ['changed settings', rows => { rows[2][0] = 'renamed'; }, /ключи настроек/],
  ]) await t.test(name, () => {
    const {rows, narratives} = workbookRows();
    change(rows);
    assert.throws(() => validateReportData(reportFromWorkbookRows(rows, narratives)), expected);
  });
});

test('the checked-in Excel input builds the same embedded report without modifying the workbook', async t => {
  const workbook = fileURLToPath(new URL('./report-inputs.xlsx', import.meta.url));
  const workbookBefore = await readFile(workbook);
  const data = validateReportData(await readReportWorkbook(workbook));
  const {output} = await files(t);
  const result = await buildReport(workbook, output);
  assert.equal(result.reportId, data.reportId);
  const document = new JSDOM(await readFile(output, 'utf8')).window.document;
  assert.deepEqual(JSON.parse(document.getElementById('report-data').textContent), data);
  assert.deepEqual(await readFile(workbook), workbookBefore);
  assert.equal(data.products.deposits.market.samVolume.value, null);
  assert.equal(data.products.deposits.market.identified.value, null);
  assert.equal(data.products.prime.market.samVolume.value, 20000000, 'the workbook carries the existing manual Prime SAM');
  assert.equal(data.products.prime.market.identified.value, 15000000);
  for (const id of ['deposits', 'prime']) {
    assert.equal(data.products[id].market.samVolume.source, null, 'manual values do not acquire invented sources');
    assert.equal(data.products[id].market.identified.source, null);
    assert.equal(data.products[id].recommendations.length, 0);
    assert.equal(data.products[id].samGrowthEvents.length, 0);
  }
});
