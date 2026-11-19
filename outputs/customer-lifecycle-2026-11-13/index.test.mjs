import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';

const require = createRequire(new URL('../../gravity-app/package.json', import.meta.url));
const {JSDOM, VirtualConsole} = require('jsdom');
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const storageKey = 'ddi-lifecycle-checklist-v1';
const keys = ['reporting', 'monthly', 'process', 'journey'];
const evidenceKeys = ['reporting', 'process', 'journey'];

function reportFixture(reportId = 'customer-lifecycle-2026-11-13') {
  return {
    schemaVersion: 1, reportId, generatedAt: null, selectedProduct: 'deposits',
    products: Object.fromEntries(['deposits', 'prime'].map(id => [id, {
      market: {
        tamApproved: {value: true, source: null}, samApproved: {value: true, source: null},
        samVolume: {value: null, source: null}, identified: {value: null, source: null},
      },
      sales: Object.fromEntries(keys.map(key => [key, {checked: false, url: '', source: null}])),
      recommendations: [], samGrowthEvents: [],
    }])),
  };
}

function openPage(t, {storage = new Map(), blocked = '', reportData = reportFixture()} = {}) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(html, {
    url: new URL('./index.html', import.meta.url).href,
    runScripts: 'outside-only',
    virtualConsole: console,
  });
  const {window} = dom;
  const document = window.document;
  document.getElementById('report-data').textContent = JSON.stringify(reportData);
  Object.defineProperty(window, 'localStorage', {get() {
    if (blocked === 'access') throw new window.DOMException('Storage unavailable', 'SecurityError');
    return {
      getItem(key) {
        if (blocked === 'read') throw new Error('Storage read unavailable');
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        if (blocked === 'write') throw new Error('Storage quota unavailable');
        storage.set(key, String(value));
      },
    };
  }});
  // JSDOM lacks native dialog rendering. Exercise application callbacks while
  // the browser checks cover focus trapping, Escape and method="dialog".
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new window.Event('close'));
  };
  window.eval(document.getElementById('product-ui-script').textContent);
  t.after(() => {
    dom.window.close();
    assert.deepEqual(errors, [], 'feature interactions raise no browser errors');
  });
  const select = document.getElementById('product-select');
  const checkbox = key => document.getElementById(`check-${key}`);
  const controls = key => document.querySelector(`[data-evidence-for="${key}"]`);
  const evidenceDialog = document.getElementById('evidence-dialog');
  const evidenceInput = document.getElementById('evidence-url');
  return {
    window, document, storage, select, checkbox, controls, evidenceDialog,
    values: () => keys.map(key => checkbox(key).checked),
    selectProduct(value) {
      select.value = value;
      select.dispatchEvent(new window.Event('change', {bubbles: true}));
    },
    editEvidence(key) {
      document.querySelector(`[data-evidence-key="${key}"]`).click();
      assert.equal(evidenceDialog.open, true);
    },
    submitEvidence(value) {
      evidenceInput.value = value;
      evidenceInput.dispatchEvent(new window.Event('input', {bubbles: true}));
      document.getElementById('evidence-form').dispatchEvent(
        new window.Event('submit', {bubbles: true, cancelable: true}),
      );
    },
    attach(key, value) {
      this.editEvidence(key);
      this.submitEvidence(value);
      assert.equal(evidenceDialog.open, false, 'valid evidence closes its dialog');
    },
  };
}

function assertEmpty(page) {
  assert.deepEqual(page.values(), [false, false, false, false]);
  for (const key of keys) {
    assert.equal(page.checkbox(key).disabled, key !== 'monthly');
    assert.equal(page.checkbox(key).closest('.sales-check-item').classList.contains('sales-check-item--complete'), false);
    const link = page.controls(key).querySelector('.evidence-link');
    assert.equal(link.hidden, true);
    assert.equal(link.hasAttribute('href'), false);
  }
}

function market(page) {
  const byId = id => page.document.getElementById(id);
  return {
    tam: byId('market-tam-approved'),
    sam: byId('market-sam-approved'),
    identified: byId('market-identified'),
    volume: byId('market-sam-volume'),
    coverage: byId('market-coverage-value'),
    hint: byId('market-assessment-hint'),
    zones: () => [...page.document.querySelectorAll('.market-light.is-active')].map(light => light.dataset.zone),
    enter(identified, volume) {
      for (const [input, value] of [[this.identified, identified], [this.volume, volume]]) {
        input.value = value;
        input.dispatchEvent(new page.window.Event('input', {bubbles: true}));
      }
    },
  };
}

function deleteFromInput(page, input, inputType) {
  const allowed = input.dispatchEvent(new page.window.InputEvent('beforeinput', {
    bubbles: true, cancelable: true, inputType,
  }));
  if (allowed) {
    // Emulate the browser's default edit only when beforeinput was not handled.
    let start = input.selectionStart;
    let end = input.selectionEnd;
    if (start === end) {
      if (inputType === 'deleteContentBackward') start = Math.max(0, start - 1);
      else end = Math.min(input.value.length, end + 1);
    }
    input.setRangeText('', start, end, 'start');
    input.dispatchEvent(new page.window.InputEvent('input', {bubbles: true, inputType}));
  }
  return allowed;
}

function potentialAnalysis(page) {
  const byId = id => page.document.getElementById(id);
  return {
    section: byId('market-analysis'),
    title: byId('market-analysis-title'),
    summary: byId('market-analysis-summary'),
    gap: byId('market-analysis-gap'),
    target: byId('market-analysis-target'),
    actions: byId('market-analysis-actions'),
  };
}

test('embedded JSON seeds the selected product, both market datasets and checklist values', t => {
  const reportData = reportFixture('json-seed-test');
  reportData.selectedProduct = 'prime';
  Object.assign(reportData.products.deposits.market, {samVolume: {value: 1200}, identified: {value: '960'}});
  reportData.products.deposits.sales.monthly.checked = true;
  Object.assign(reportData.products.prime.market, {samVolume: {value: '2000'}, identified: {value: 1900}});
  reportData.products.prime.sales.reporting = {checked: true, url: 'https://example.org/prime/report', source: null};
  const page = openPage(t, {reportData});
  assert.equal(page.select.value, 'prime');
  assert.equal(market(page).volume.value, '2 000');
  assert.equal(market(page).identified.value, '1 900');
  assert.deepEqual(market(page).zones(), ['green']);
  assert.deepEqual(page.values(), [true, false, false, false]);
  page.selectProduct('deposits');
  assert.equal(market(page).volume.value, '1 200');
  assert.equal(market(page).identified.value, '960');
  assert.deepEqual(market(page).zones(), ['yellow']);
  assert.deepEqual(page.values(), [false, true, false, false]);
});

test('sourced values override saved edits and reject synthetic changes while manual fields remain editable', t => {
  const reportData = reportFixture('source-priority-test');
  const source = {title: 'Подтверждённый отчёт', url: 'https://example.org/source', locator: 'Лист 2!B5'};
  const product = reportData.products.deposits;
  product.market.tamApproved = {value: true, source};
  product.market.samApproved = {value: false, source};
  product.market.samVolume = {value: 100, source};
  product.market.identified = {value: 80, source: null};
  product.sales.reporting = {checked: true, url: 'https://example.org/confirmed-report', source};
  product.sales.monthly = {checked: true, url: '', source};
  product.sales.process = {checked: true, url: '', source: {title: 'Локальный документ', locator: 'Раздел 3'}};
  const saved = {version: 2, selectedProduct: 'deposits', products: {deposits: {
    market: {tamApproved: false, samApproved: true, samVolume: '999', identified: '70'},
    reporting: {checked: false, url: 'https://example.org/override'}, monthly: {checked: false, url: ''},
  }}};
  const storage = new Map([[`ddi-lifecycle-report:${reportData.reportId}`, JSON.stringify(saved)]]);
  const page = openPage(t, {reportData, storage});
  const view = market(page);
  assert.equal(view.tam.checked, true);
  assert.equal(view.sam.checked, false);
  assert.equal(view.tam.disabled, true);
  assert.equal(view.sam.disabled, true);
  assert.equal(view.volume.readOnly, true);
  assert.equal(view.volume.value, '100');
  assert.equal(view.identified.readOnly, false);
  assert.equal(view.identified.value, '70', 'saved manual edits still override manual seed values');
  assert.deepEqual(page.values(), [true, true, true, false]);
  for (const flag of [view.tam, view.sam]) {
    const original = flag.checked;
    flag.checked = !original;
    flag.dispatchEvent(new page.window.Event('change', {bubbles: true}));
    assert.equal(flag.checked, original);
  }
  view.volume.value = '777';
  view.volume.dispatchEvent(new page.window.Event('input', {bubbles: true}));
  assert.equal(view.volume.value, '100');
  assert.equal(view.volume.dispatchEvent(new page.window.InputEvent('beforeinput', {bubbles: true, cancelable: true, inputType: 'insertText', data: '9'})), false);
  for (const key of ['reporting', 'monthly', 'process']) {
    assert.equal(page.checkbox(key).disabled, true);
    page.checkbox(key).checked = false;
    page.checkbox(key).dispatchEvent(new page.window.Event('change', {bubbles: true}));
    assert.equal(page.checkbox(key).checked, true);
  }
  const attachment = page.document.querySelector('[data-evidence-key="reporting"]');
  assert.equal(attachment.hidden, true);
  assert.equal(attachment.disabled, true);
  attachment.dispatchEvent(new page.window.MouseEvent('click', {bubbles: true}));
  assert.equal(page.evidenceDialog.open, false);
  page.document.getElementById('evidence-remove').dispatchEvent(new page.window.MouseEvent('click', {bubbles: true}));
  assert.equal(page.controls('reporting').querySelector('a').href, 'https://example.org/confirmed-report');
  view.identified.value = '75';
  view.identified.dispatchEvent(new page.window.Event('input', {bubbles: true}));
  const restored = openPage(t, {reportData, storage});
  assert.equal(market(restored).volume.value, '100');
  assert.equal(market(restored).identified.value, '75');
  assert.deepEqual(restored.values(), [true, true, true, false]);
});

test('source titles and locators render as text and source links allow only safe HTTP URLs', t => {
  const reportData = reportFixture('safe-source-test');
  const title = '<img src=x onerror="globalThis.injected=true">';
  const locator = '<svg onload="globalThis.injected=true">';
  reportData.products.deposits.market.samVolume = {value: 100, source: {title, locator, url: 'https://example.org/source?x=1&y=2'}};
  reportData.products.deposits.market.identified = {value: 80, source: {title, locator, url: 'javascript:alert(1)'}};
  const page = openPage(t, {reportData});
  const safe = page.document.querySelector('[data-source-for="market.samVolume"]');
  const unsafe = page.document.querySelector('[data-source-for="market.identified"]');
  for (const node of [safe, unsafe]) {
    assert.equal(node.hidden, false);
    assert.ok(node.textContent.includes(title));
    assert.ok(node.textContent.includes(locator));
    assert.equal(node.querySelector('img,svg,script'), null);
  }
  assert.equal(page.window.injected, undefined);
  const link = safe.querySelector('a');
  assert.equal(link.href, 'https://example.org/source?x=1&y=2');
  assert.equal(link.target, '_blank');
  assert.ok(link.relList.contains('noopener'));
  assert.ok(link.relList.contains('noreferrer'));
  assert.equal(unsafe.querySelector('a'), null);
  assert.equal(market(page).volume.readOnly, true);
  assert.equal(market(page).identified.readOnly, true);
});

test('JSON recommendations and SAM events are product-specific and remain visible without scores or in green', t => {
  const reportData = reportFixture('agent-content-test');
  reportData.products.deposits.recommendations = [{title: 'Разметить вкладчиков', description: 'Проверить потребность аудитории перед кампанией.'}];
  reportData.products.deposits.samGrowthEvents = [
    {title: 'Завершение срока', description: 'Проверить интерес к новому вкладу.'},
    {title: 'Крупное поступление', description: 'Оценить гипотезу сохранения средств.'},
  ];
  reportData.products.prime.recommendations = [
    {title: 'Проверить Прайм', description: 'Отдельный вывод по Прайму.'},
    {title: 'Оценить сегмент', description: 'Проверить границы аудитории Прайма.'},
  ];
  reportData.products.prime.samGrowthEvents = [{title: 'Событие Прайма', description: 'Проверить критерий отбора.'}];
  const page = openPage(t, {reportData});
  const analysis = potentialAnalysis(page);
  const recommendations = page.document.getElementById('market-agent-recommendations');
  const events = page.document.getElementById('market-agent-events');
  const eventItems = page.document.getElementById('market-growth-events');
  const stale = page.document.getElementById('market-agent-stale');
  assert.equal(analysis.section.hidden, false);
  assert.equal(analysis.summary.hidden, true, 'numeric analysis is absent without numbers');
  assert.equal(recommendations.hidden, false);
  assert.equal(events.hidden, false);
  assert.equal(analysis.actions.children.length, 1);
  assert.equal(eventItems.children.length, 2);
  assert.ok(recommendations.textContent.includes('Разметить вкладчиков'));
  assert.ok(events.textContent.includes('Крупное поступление'));
  assert.equal(stale.hidden, true);
  page.checkbox('monthly').click();
  assert.equal(stale.hidden, true, 'sales checkboxes do not invalidate market recommendations');
  market(page).enter('95', '100');
  assert.equal(analysis.section.dataset.zone, 'green');
  assert.equal(recommendations.hidden, false);
  assert.equal(events.hidden, false);
  assert.equal(analysis.actions.children.length, 1);
  assert.equal(stale.hidden, false);
  market(page).enter('', '100');
  assert.equal(analysis.summary.hidden, true);
  assert.equal(recommendations.hidden, false);
  assert.equal(events.hidden, false);
  page.selectProduct('prime');
  assert.equal(analysis.actions.children.length, 2);
  assert.equal(eventItems.children.length, 1);
  assert.ok(recommendations.textContent.includes('Проверить Прайм'));
  assert.equal(recommendations.textContent.includes('Разметить вкладчиков'), false);
  assert.ok(events.textContent.includes('Событие Прайма'));
  assert.equal(stale.hidden, true);
  page.selectProduct('deposits');
  assert.equal(stale.hidden, false);
  const restored = openPage(t, {reportData, storage: page.storage});
  assert.ok(restored.document.getElementById('market-agent-recommendations').textContent.includes('Разметить вкладчиков'));
  assert.equal(restored.document.getElementById('market-agent-stale').hidden, false);
});

test('recommendation freshness compares numeric values rather than formatting changes', t => {
  const reportData = reportFixture('freshness-test');
  reportData.products.deposits.market.identified.value = '95.0';
  reportData.products.deposits.market.samVolume.value = '100';
  reportData.products.deposits.recommendations = [{title: 'Сохранить охват', description: 'Вывод по исходным значениям.'}];
  const page = openPage(t, {reportData});
  const stale = page.document.getElementById('market-agent-stale');
  assert.equal(stale.hidden, true);
  market(page).enter('095,00', '00100.0');
  assert.equal(stale.hidden, true);
  market(page).enter('80', '100');
  assert.equal(stale.hidden, false);
  market(page).enter('95', '100');
  assert.equal(stale.hidden, true);
  market(page).tam.click();
  assert.equal(stale.hidden, false);
});

test('manual overrides are isolated by reportId as well as product', t => {
  const storage = new Map([[storageKey, JSON.stringify({version: 2, selectedProduct: 'deposits', products: {deposits: {market: {identified: '999'}}}})]]);
  const firstData = reportFixture('separate-report-a');
  firstData.products.deposits.market.identified.value = '60';
  firstData.products.deposits.market.samVolume.value = '100';
  const secondData = reportFixture('separate-report-b');
  secondData.products.deposits.market.identified.value = '25';
  secondData.products.deposits.market.samVolume.value = '100';
  const first = openPage(t, {reportData: firstData, storage});
  market(first).enter('80', '100');
  first.checkbox('monthly').click();
  const second = openPage(t, {reportData: secondData, storage});
  assert.equal(market(second).identified.value, '25');
  assert.equal(second.checkbox('monthly').checked, false);
  market(second).enter('95', '100');
  const restored = openPage(t, {reportData: firstData, storage});
  assert.equal(market(restored).identified.value, '80');
  assert.equal(restored.checkbox('monthly').checked, true);
  assert.ok(storage.has('ddi-lifecycle-report:separate-report-a'));
  assert.ok(storage.has('ddi-lifecycle-report:separate-report-b'));
});

test('only the requested products appear and evidence-required items cannot bypass attachment', t => {
  const page = openPage(t);
  assert.deepEqual([...page.select.options].map(option => [option.value, option.textContent]), [
    ['deposits', 'Вклады'], ['prime', 'Прайм'],
  ]);
  assert.equal(page.select.value, 'deposits');
  assert.equal(page.document.getElementById('checklist-context').textContent, 'Вклады');
  assertEmpty(page);
  for (const key of evidenceKeys) {
    page.document.querySelector(`label[for="check-${key}"]`).click();
    assert.equal(page.checkbox(key).checked, false, 'disabled labels cannot check an item');
    page.checkbox(key).checked = true;
    page.checkbox(key).dispatchEvent(new page.window.Event('change', {bubbles: true}));
    assertEmpty(page);
  }
  page.selectProduct('prime');
  assertEmpty(page);
  for (const script of page.document.querySelectorAll('script:not([type="application/json"])')) new Script(script.textContent);
  for (const link of page.document.querySelectorAll('a[href^="#"]')) {
    assert.ok(page.document.getElementById(link.getAttribute('href').slice(1)));
  }
});

test('reporting offers monthly MJ and analytics lists journey before process with MJ + CJHUB', t => {
  const page = openPage(t);
  const reporting = page.document.querySelector('[aria-labelledby="sales-reporting-title"]');
  const analytics = page.document.querySelector('[aria-labelledby="sales-analytics-title"]');
  assert.deepEqual([...reporting.querySelectorAll('[data-check-key]')].map(input => input.dataset.checkKey), ['reporting', 'monthly']);
  const monthly = page.checkbox('monthly').closest('.sales-check-item');
  assert.equal(monthly.querySelector('label').textContent, 'Построить помесячно воронку');
  assert.equal(monthly.querySelector('[data-skill="monthly"]').textContent, 'MJ');
  assert.equal(monthly.querySelectorAll('[data-evidence-key],.evidence-helper').length, 0);
  assert.deepEqual([...analytics.querySelectorAll('[data-check-key]')].map(input => input.dataset.checkKey), ['journey', 'process']);
  assert.equal(analytics.querySelector('[data-skill="process"]').textContent, 'MJ + CJHUB');
  assert.equal(analytics.querySelector('[data-skill="journey"]').textContent, 'MJ + CJHUB');
  assert.equal(page.document.querySelector('label[for="check-journey"]').textContent, 'Анализ отдельного клиентского пути');
  assert.equal(page.document.querySelectorAll('[data-skill="monthly"]').length, 1);
  assert.equal(analytics.querySelector('.sales-result .placeholder-copy').textContent, 'TBD');
  assert.equal(page.document.querySelectorAll('.sales-channel--pending .placeholder-copy').length, 2);
});

test('monthly completion is manual, isolated per product and persisted without requiring a link', t => {
  const page = openPage(t);
  assert.equal(page.checkbox('monthly').disabled, false);
  assert.equal(page.controls('monthly').querySelector('a').hasAttribute('href'), false);
  page.document.querySelector('label[for="check-monthly"]').click();
  assert.equal(page.checkbox('monthly').checked, true);
  assert.ok(page.checkbox('monthly').closest('.sales-check-item').classList.contains('sales-check-item--complete'));
  page.selectProduct('prime');
  assert.equal(page.checkbox('monthly').checked, false);
  page.checkbox('monthly').click();
  page.selectProduct('deposits');
  assert.equal(page.checkbox('monthly').checked, true);
  page.checkbox('monthly').click();
  const reloaded = openPage(t, {storage: page.storage});
  assert.equal(reloaded.checkbox('monthly').checked, false);
  assert.equal(reloaded.checkbox('monthly').disabled, false);
  reloaded.selectProduct('prime');
  assert.equal(reloaded.checkbox('monthly').checked, true);
  assert.equal(reloaded.controls('monthly').querySelector('a').hasAttribute('href'), false);
});

test('Market contains methodology while Customer knowledge owns the single potential assessment', t => {
  const page = openPage(t);
  const marketSection = page.document.getElementById('potential');
  const knowledge = page.document.getElementById('customer-knowledge');
  for (const id of ['market-tam-approved', 'market-sam-approved']) {
    assert.equal(page.document.querySelectorAll(`#${id}`).length, 1);
    assert.ok(marketSection.contains(page.document.getElementById(id)));
    assert.equal(knowledge.contains(page.document.getElementById(id)), false);
  }
  for (const id of ['market-identified', 'market-sam-volume', 'market-coverage-value', 'market-assessment-text', 'market-analysis']) {
    assert.equal(page.document.querySelectorAll(`#${id}`).length, 1);
    assert.ok(knowledge.contains(page.document.getElementById(id)), `${id} belongs to Customer knowledge`);
    assert.equal(marketSection.contains(page.document.getElementById(id)), false);
  }
  assert.equal(marketSection.querySelectorAll('.market-methodology').length, 1);
  assert.equal(marketSection.querySelectorAll('[data-market-field],.market-assessment,.market-analysis').length, 0);
  assert.equal(knowledge.querySelectorAll('.placeholder-copy').length, 0, 'the previous TBD is replaced');
});

test('market methodology flags start checked for both products and numeric inputs stay blank', t => {
  const page = openPage(t);
  for (const product of ['deposits', 'prime']) {
    page.selectProduct(product);
    const view = market(page);
    assert.equal(view.tam.checked, true);
    assert.equal(view.sam.checked, true);
    assert.equal(view.identified.value, '');
    assert.equal(view.volume.value, '');
    assert.equal(view.coverage.textContent.trim(), '—');
    assert.deepEqual(view.zones(), [], 'no invented numeric assessment');
  }
});

test('coverage uses identified divided by SAM with exact 80% and 95% traffic-light boundaries', t => {
  const page = openPage(t);
  const view = market(page);
  for (const [identified, volume, percent, zone] of [
    ['0', '1000', 0, 'red'], ['799', '1000', 79.9, 'red'],
    ['800', '1000', 80, 'yellow'], ['949', '1000', 94.9, 'yellow'],
    ['950', '1000', 95, 'green'], ['1000', '1000', 100, 'green'],
    ['19', '20', 95, 'green'],
    ['94.96', '100', 95, 'green'], ['79.96', '100', 80, 'yellow'],
  ]) {
    view.enter(identified, volume);
    assert.equal(Number.parseFloat(view.coverage.textContent.replace(',', '.')), percent);
    assert.deepEqual(view.zones(), [zone], `${identified}/${volume}`);
  }
});

test('both market inputs group typed and pasted integer digits without changing decimal text', t => {
  const page = openPage(t);
  const view = market(page);
  for (const input of [view.identified, view.volume]) {
    input.focus();
    for (const digit of '345664566546') {
      input.setRangeText(digit, input.selectionStart, input.selectionEnd, 'end');
      input.dispatchEvent(new page.window.InputEvent('input', {bubbles: true, inputType: 'insertText', data: digit}));
    }
    assert.equal(input.value, '345 664 566 546');
    assert.equal(input.selectionStart, input.value.length);
    for (const [raw, grouped] of [
      ['9007199254740993123456', '9 007 199 254 740 993 123 456'],
      ['1234567,8900', '1 234 567,8900'], ['1234567.00', '1 234 567.00'],
      ['1234567,', '1 234 567,'], ['1234567.', '1 234 567.'],
    ]) {
      input.value = raw;
      input.setSelectionRange(raw.length, raw.length);
      input.dispatchEvent(new page.window.InputEvent('input', {bubbles: true, inputType: 'insertFromPaste'}));
      assert.equal(input.value, grouped);
      assert.equal(input.selectionStart, grouped.length);
    }
    input.value = '';
    input.dispatchEvent(new page.window.Event('input', {bubbles: true}));
  }
  view.enter('95000', '100000');
  assert.equal(view.identified.value, '95 000');
  assert.equal(view.volume.value, '100 000');
  assert.deepEqual(view.zones(), ['green']);
  assert.equal(Number.parseFloat(view.coverage.textContent.replace(',', '.')), 95);
  view.enter('12a34', '100000');
  assert.equal(view.identified.value, '12a34', 'invalid text is not silently converted into a number');
  assert.deepEqual(view.zones(), []);
});

test('grouping preserves the logical caret and selection while editing in the middle', t => {
  const page = openPage(t);
  const input = market(page).identified;
  input.focus();
  input.value = '1 234 567';
  input.setSelectionRange(5, 5);
  input.setRangeText('9', 5, 5, 'end');
  input.dispatchEvent(new page.window.InputEvent('input', {bubbles: true, inputType: 'insertText', data: '9'}));
  assert.equal(input.value, '12 349 567');
  assert.equal(input.value.slice(0, input.selectionStart).replace(/\s/g, ''), '12349');
  assert.equal(input.selectionStart, input.selectionEnd);
  input.value = '123456789';
  input.setSelectionRange(2, 7, 'backward');
  input.dispatchEvent(new page.window.InputEvent('input', {bubbles: true, inputType: 'insertFromPaste'}));
  assert.equal(input.value, '123 456 789');
  assert.equal(input.value.slice(0, input.selectionStart).replace(/\s/g, ''), '12');
  assert.equal(input.value.slice(0, input.selectionEnd).replace(/\s/g, ''), '1234567');
  assert.equal(input.selectionDirection, 'backward');
});

test('Delete and Backspace cross group separators instead of trapping the caret', t => {
  const page = openPage(t);
  const view = market(page);
  for (const input of [view.identified, view.volume]) {
    input.focus();
    input.value = '1234';
    input.dispatchEvent(new page.window.Event('input', {bubbles: true}));
    assert.equal(input.value, '1 234');
    input.setSelectionRange(1, 1);
    deleteFromInput(page, input, 'deleteContentForward');
    assert.equal(input.value, '134', 'Delete before a group separator removes the next digit');
    deleteFromInput(page, input, 'deleteContentForward');
    assert.equal(input.value, '14', 'repeated Delete keeps removing digits');
    input.value = '12345';
    input.dispatchEvent(new page.window.Event('input', {bubbles: true}));
    assert.equal(input.value, '12 345');
    input.setSelectionRange(3, 3);
    deleteFromInput(page, input, 'deleteContentBackward');
    assert.equal(input.value, '1 345', 'Backspace after a separator removes the preceding digit');
    deleteFromInput(page, input, 'deleteContentBackward');
    assert.equal(input.value, '345', 'repeated Backspace keeps removing digits');
  }
  const reloaded = openPage(t, {storage: page.storage});
  assert.equal(market(reloaded).identified.value, '345');
  assert.equal(market(reloaded).volume.value, '345', 'separator-aware edits persist');
});

test('ordinary and selected-range deletions remove only the intended digits', t => {
  const page = openPage(t);
  const view = market(page);
  for (const input of [view.identified, view.volume]) {
    input.focus();
    input.value = '12 345';
    input.setSelectionRange(0, 0);
    assert.equal(deleteFromInput(page, input, 'deleteContentForward'), true);
    assert.equal(input.value, '2 345', 'normal Delete removes one digit');
    input.value = '12 345';
    input.setSelectionRange(input.value.length, input.value.length);
    assert.equal(deleteFromInput(page, input, 'deleteContentBackward'), true);
    assert.equal(input.value, '1 234', 'normal Backspace removes one digit');
    for (const inputType of ['deleteContentForward', 'deleteContentBackward']) {
      input.value = '1 234 567';
      input.setSelectionRange(2, 5);
      assert.equal(deleteFromInput(page, input, inputType), true);
      assert.equal(input.value, '1 567', 'selected digits are deleted without an extra neighbouring digit');
    }
  }
});

test('unformatted saved volumes are grouped on load and product switching without changing coverage', t => {
  const saved = {version: 2, selectedProduct: 'deposits', products: {
    deposits: {market: {identified: '345664566546', samVolume: '345664566546'}},
    prime: {market: {identified: '95000', samVolume: '100000'}},
  }};
  const page = openPage(t, {storage: new Map([[storageKey, JSON.stringify(saved)]])});
  const view = market(page);
  assert.equal(view.identified.value, '345 664 566 546');
  assert.equal(view.volume.value, '345 664 566 546');
  assert.equal(Number.parseFloat(view.coverage.textContent.replace(',', '.')), 100);
  page.selectProduct('prime');
  assert.equal(view.identified.value, '95 000');
  assert.equal(view.volume.value, '100 000');
  assert.deepEqual(view.zones(), ['green']);
  page.selectProduct('deposits');
  assert.equal(view.identified.value, '345 664 566 546');
  page.selectProduct('prime');
  view.enter('80000', '100000');
  const reloaded = openPage(t, {storage: page.storage});
  assert.equal(reloaded.select.value, 'prime');
  assert.equal(market(reloaded).identified.value, '80 000');
  assert.equal(market(reloaded).volume.value, '100 000');
  assert.deepEqual(market(reloaded).zones(), ['yellow']);
});

test('blank, invalid and impossible market values never show a traffic-light assessment', t => {
  const page = openPage(t);
  const view = market(page);
  for (const [identified, volume] of [
    ['', '100'], ['0', ''], ['', ''], ['5', '0'], ['-1', '100'],
    ['1', '-100'], ['not-a-number', '100'], ['5', 'NaN'],
    ['Infinity', '100'], ['1', 'Infinity'], ['101', '100'],
  ]) {
    view.enter(identified, volume);
    assert.equal(view.coverage.textContent.trim(), '—', `${identified}/${volume}`);
    assert.deepEqual(view.zones(), []);
    assert.ok(view.hint.textContent.trim().length > 0, 'explain why assessment is unavailable');
  }
  view.enter('0', '100');
  assert.deepEqual(view.zones(), ['red'], 'zero identified is different from an empty input');
});

test('unchecked methodology prerequisites neutralize otherwise valid coverage', t => {
  const page = openPage(t);
  const view = market(page);
  view.enter('95', '100');
  assert.deepEqual(view.zones(), ['green']);
  for (const flag of [view.tam, view.sam]) {
    flag.click();
    assert.equal(flag.checked, false);
    assert.deepEqual(view.zones(), []);
    assert.equal(view.coverage.textContent.trim(), '—');
    assert.ok(view.hint.textContent.trim().length > 0);
    flag.click();
    assert.deepEqual(view.zones(), ['green']);
  }
});

test('potential analysis calculates the actual gap and remaining volume for critical, moderate and green zones', t => {
  const page = openPage(t);
  const view = market(page);
  const analysis = potentialAnalysis(page);
  const text = node => node.textContent.replace(/\s/g, ' ');
  for (const [identified, sam, coverage, zone, gap, target] of [
    ['600', '1000', '60,0', 'red', '400', '350'],
    ['850', '1000', '85,0', 'yellow', '150', '100'],
    ['950', '1000', '95,0', 'green', '50', null],
  ]) {
    view.enter(identified, sam);
    assert.equal(analysis.section.hidden, false);
    assert.equal(analysis.section.dataset.zone, zone);
    assert.ok(text(analysis.summary).includes('Вклады'));
    assert.ok(text(analysis.summary).includes('1 000'));
    assert.ok(text(analysis.summary).includes(identified));
    assert.ok(text(analysis.summary).includes(coverage));
    assert.ok(text(analysis.gap).includes(gap));
    assert.equal(analysis.title.textContent, target ? 'Зона внимания — анализ потенциала' : 'Анализ потенциала');
    if (target) {
      assert.equal(analysis.target.hidden, false);
      assert.ok(text(analysis.target).includes(target));
      assert.equal(analysis.actions.children.length, 0, 'no recommendations are invented without JSON data');
    } else {
      assert.equal(analysis.target.hidden, true);
      assert.equal(analysis.target.textContent, '');
      assert.equal(analysis.actions.hidden, true);
      assert.equal(analysis.actions.children.length, 0);
      assert.match(text(analysis.gap), /резерв/i);
    }
  }
  view.enter('80', '101');
  assert.ok(text(analysis.gap).includes('21'));
  assert.ok(text(analysis.target).includes('16'), 'the volume needed to reach 95% rounds upward');
  view.enter('94.96', '100');
  assert.equal(analysis.section.dataset.zone, 'green', 'analysis uses the same rounded zone as the traffic light');
  assert.equal(analysis.title.textContent, 'Анализ потенциала');
  assert.equal(analysis.target.hidden, true);
  assert.equal(analysis.target.textContent, '');
});

test('potential analysis clears previous figures when inputs or methodology prerequisites become unavailable', t => {
  const page = openPage(t);
  const view = market(page);
  const analysis = potentialAnalysis(page);
  const assertCleared = () => {
    assert.equal(analysis.section.hidden, true);
    for (const node of [analysis.summary, analysis.gap, analysis.target, analysis.actions]) assert.equal(node.textContent, '');
    assert.equal(analysis.actions.children.length, 0);
  };
  assertCleared();
  for (const [identified, sam] of [['', '100'], ['60', ''], ['60', '0'], ['-1', '100'], ['bad', '100'], ['101', '100']]) {
    view.enter('60', '100');
    assert.equal(analysis.section.hidden, false);
    view.enter(identified, sam);
    assertCleared();
  }
  view.enter('60', '100');
  for (const flag of [view.tam, view.sam]) {
    flag.click();
    assertCleared();
    flag.click();
    assert.equal(analysis.section.hidden, false);
    assert.equal(analysis.section.dataset.zone, 'red');
  }
});

test('potential analysis derives the selected product context and restores its saved inputs', t => {
  const page = openPage(t);
  const view = market(page);
  const analysis = potentialAnalysis(page);
  view.enter('60', '100');
  assert.ok(analysis.summary.textContent.includes('Вклады'));
  page.selectProduct('prime');
  assert.equal(analysis.section.hidden, true);
  assert.equal(analysis.summary.textContent, '');
  view.enter('95', '100');
  assert.ok(analysis.summary.textContent.includes('Прайм'));
  assert.equal(analysis.section.dataset.zone, 'green');
  page.selectProduct('deposits');
  assert.equal(view.identified.value, '60');
  assert.ok(analysis.summary.textContent.includes('Вклады'));
  assert.equal(analysis.section.dataset.zone, 'red');
  const reloaded = openPage(t, {storage: page.storage});
  assert.equal(potentialAnalysis(reloaded).section.dataset.zone, 'red');
  assert.ok(potentialAnalysis(reloaded).summary.textContent.includes('Вклады'));
  reloaded.selectProduct('prime');
  assert.equal(market(reloaded).identified.value, '95');
  assert.ok(potentialAnalysis(reloaded).summary.textContent.includes('Прайм'));
  assert.equal(potentialAnalysis(reloaded).section.dataset.zone, 'green');
});

test('market inputs and flags persist independently without losing sales state', t => {
  const page = openPage(t);
  const view = market(page);
  view.enter('80', '100');
  view.tam.click();
  page.attach('reporting', 'https://example.org/deposits/report');
  page.checkbox('monthly').click();
  page.selectProduct('prime');
  assert.equal(view.identified.value, '');
  assert.equal(view.volume.value, '');
  assert.equal(view.tam.checked, true);
  view.enter('95', '100');
  view.sam.click();
  const reloaded = openPage(t, {storage: page.storage});
  const restored = market(reloaded);
  assert.equal(reloaded.select.value, 'prime');
  assert.equal(restored.identified.value, '95');
  assert.equal(restored.volume.value, '100');
  assert.equal(restored.sam.checked, false);
  assert.deepEqual(restored.zones(), []);
  reloaded.selectProduct('deposits');
  assert.equal(restored.identified.value, '80');
  assert.equal(restored.volume.value, '100');
  assert.equal(restored.tam.checked, false);
  assert.equal(restored.sam.checked, true);
  assert.deepEqual(reloaded.values(), [true, true, false, false]);
  restored.tam.click();
  assert.deepEqual(restored.zones(), ['yellow']);
  reloaded.selectProduct('prime');
  assert.equal(restored.sam.checked, false);
});

test('market storage accepts only typed fields and preserves explicit false flags', t => {
  const saved = {version: 2, selectedProduct: 'deposits', products: {
    deposits: {market: {tamApproved: 'false', samApproved: 0, identified: 95, samVolume: {value: 100}}},
    prime: {market: {tamApproved: false, samApproved: false, identified: '95', samVolume: '100'}},
  }};
  const page = openPage(t, {storage: new Map([[storageKey, JSON.stringify(saved)]])});
  const view = market(page);
  assert.equal(view.tam.checked, true);
  assert.equal(view.sam.checked, true);
  assert.equal(view.identified.value, '');
  assert.equal(view.volume.value, '');
  assert.deepEqual(view.zones(), []);
  page.selectProduct('prime');
  assert.equal(view.tam.checked, false);
  assert.equal(view.sam.checked, false);
  assert.equal(view.identified.value, '95');
  assert.equal(view.volume.value, '100');
  assert.deepEqual(view.zones(), []);
});

test('evidence rejects unsafe URLs and accepts a corrected URL in the same dialog', t => {
  const page = openPage(t);
  page.editEvidence('reporting');
  for (const url of ['', 'not a URL', '/relative', 'javascript:alert(1)', 'data:text/html,hello', 'file:///tmp/report.html', 'ftp://example.org/report']) {
    page.submitEvidence(url);
    assert.equal(page.evidenceDialog.open, true, `${url || '(empty)'} stays invalid`);
    assert.equal(page.document.getElementById('evidence-url').validity.valid, false);
    assertEmpty(page);
  }
  const input = page.document.getElementById('evidence-url');
  input.value = 'https://example.org/corrected-evidence';
  input.dispatchEvent(new page.window.Event('input', {bubbles: true}));
  assert.equal(input.validity.valid, true, 'editing clears the prior custom error');
  page.document.querySelector('#evidence-form button[type="submit"]').click();
  assert.equal(page.evidenceDialog.open, false);
  assert.equal(page.document.activeElement.dataset.evidenceKey, 'reporting');
  assert.equal(page.checkbox('reporting').checked, true);
  assert.equal(page.checkbox('reporting').disabled, false);
  assert.equal(page.controls('reporting').querySelector('a').href, input.value);
  const reloaded = openPage(t, {storage: page.storage});
  assert.deepEqual(reloaded.values(), [true, false, false, false], 'corrected evidence persists after reload');
});

test('adding, editing, toggling and removing evidence updates completion and the real link', t => {
  const page = openPage(t);
  for (const key of evidenceKeys) {
    const url = `https://example.org/evidence/${key}`;
    page.attach(key, url);
    const check = page.checkbox(key);
    const row = check.closest('.sales-check-item');
    const link = page.controls(key).querySelector('.evidence-link');
    assert.equal(check.disabled, false);
    assert.equal(check.checked, true);
    assert.equal(row.classList.contains('sales-check-item--complete'), true);
    assert.equal(link.hidden, false);
    assert.equal(link.href, url);
    assert.equal(link.textContent.trim(), 'Перейти →');
    assert.equal(link.target, '_blank');
    assert.ok(link.relList.contains('noopener'));
    assert.ok(link.relList.contains('noreferrer'));
    page.document.querySelector(`label[for="check-${key}"]`).click();
    assert.equal(check.checked, false);
    assert.equal(row.classList.contains('sales-check-item--complete'), false);
    assert.equal(link.href, url, 'unchecking retains the attached evidence');
    page.editEvidence(key);
    assert.equal(page.document.getElementById('evidence-url').value, url);
    assert.equal(page.document.getElementById('evidence-remove').hidden, false);
    page.document.getElementById('evidence-url').value = 'https://example.org/unsaved';
    page.document.getElementById('evidence-cancel').click();
    assert.equal(link.href, url, 'cancelling an edit retains the original evidence');
    assert.equal(check.checked, false, 'cancelling does not change completion');
    page.editEvidence(key);
    page.submitEvidence(`http://example.org/updated/${key}`);
    assert.equal(check.checked, true, 'saving evidence marks the item complete');
    assert.equal(link.href, `http://example.org/updated/${key}`);
    page.editEvidence(key);
    page.document.getElementById('evidence-remove').click();
    assert.equal(page.evidenceDialog.open, false);
    assert.equal(check.checked, false);
    assert.equal(check.disabled, true);
    assert.equal(row.classList.contains('sales-check-item--complete'), false);
    assert.equal(link.hidden, true);
    assert.equal(link.hasAttribute('href'), false);
  }
  assertEmpty(page);
});

test('evidence, unchecked states and selected product persist separately across reloads', t => {
  const storage = new Map();
  const first = openPage(t, {storage});
  first.attach('reporting', 'https://example.org/deposits/report');
  first.checkbox('reporting').click();
  first.checkbox('monthly').click();
  first.attach('journey', 'https://example.org/deposits/journey');
  first.selectProduct('prime');
  assertEmpty(first);
  first.attach('process', 'https://example.org/prime/process');
  first.attach('journey', 'https://example.org/prime/journey');
  first.checkbox('journey').click();
  assert.deepEqual(first.values(), [false, false, true, false]);
  const reloaded = openPage(t, {storage});
  assert.equal(reloaded.select.value, 'prime');
  assert.equal(reloaded.controls('process').querySelector('a').href, 'https://example.org/prime/process');
  assert.deepEqual(reloaded.values(), [false, false, true, false]);
  assert.equal(reloaded.controls('journey').querySelector('a').href, 'https://example.org/prime/journey');
  reloaded.selectProduct('deposits');
  assert.deepEqual(reloaded.values(), [false, true, false, true]);
  assert.equal(reloaded.controls('journey').querySelector('a').href, 'https://example.org/deposits/journey');
  assert.equal(reloaded.checkbox('reporting').disabled, false, 'unchecked evidence survives reload');
  assert.equal(reloaded.controls('reporting').querySelector('a').href, 'https://example.org/deposits/report');
  assert.equal(reloaded.controls('process').querySelector('a').hasAttribute('href'), false);
  reloaded.editEvidence('reporting');
  reloaded.document.getElementById('evidence-remove').click();
  reloaded.selectProduct('prime');
  assert.deepEqual(reloaded.values(), [false, false, true, false], 'deleting one product evidence leaves the other alone');
  const afterRemoval = openPage(t, {storage});
  afterRemoval.selectProduct('deposits');
  assert.equal(afterRemoval.checkbox('reporting').checked, false);
  assert.equal(afterRemoval.checkbox('reporting').disabled, true);
  assert.equal(afterRemoval.controls('reporting').querySelector('a').hasAttribute('href'), false, 'removal persists after reload');
});

test('existing version 2 checklists keep all three saved items while journey starts empty', t => {
  const saved = {version: 2, selectedProduct: 'deposits', products: {deposits: {
    reporting: {checked: false, url: 'https://example.org/old/report'},
    monthly: {checked: true, url: 'https://example.org/old/monthly'},
    process: {checked: true, url: 'https://example.org/old/process'},
  }}};
  const storage = new Map([[storageKey, JSON.stringify(saved)]]);
  const page = openPage(t, {storage});
  assert.deepEqual(page.values(), [false, true, true, false]);
  for (const key of keys.slice(0, 3)) {
    assert.equal(page.checkbox(key).disabled, false);
    assert.equal(page.controls(key).querySelector('a').href, saved.products.deposits[key].url);
  }
  assert.equal(page.checkbox('journey').disabled, true);
  assert.equal(page.controls('journey').querySelector('a').hasAttribute('href'), false);
  assert.equal(page.document.querySelector('[data-evidence-key="monthly"]'), null);
  assert.equal(market(page).tam.checked, true);
  assert.equal(market(page).sam.checked, true);
  assert.equal(market(page).identified.value, '');
  assert.equal(market(page).volume.value, '');
  page.attach('journey', 'https://example.org/new/journey');
  const reloaded = openPage(t, {storage});
  assert.deepEqual(reloaded.values(), [false, true, true, true]);
  for (const key of keys.slice(0, 3)) assert.equal(reloaded.controls(key).querySelector('a').href, saved.products.deposits[key].url);
  reloaded.selectProduct('prime');
  assertEmpty(reloaded);
});

test('corrupt, legacy and untrusted storage cannot invent completed items', async t => {
  const unsafeItem = {checked: true, url: 'javascript:alert(1)'};
  const cases = [
    '{broken', 'null', '[]', JSON.stringify({version: 999}),
    JSON.stringify({version: 1, selectedProduct: '', products: {deposits: {reporting: true, monthly: true, process: true}}}),
    JSON.stringify({version: 2, selectedProduct: 'unknown', products: {unknown: {reporting: {checked: true, url: 'https://example.org'}}}}),
    JSON.stringify({version: 2, selectedProduct: 'deposits', products: {deposits: {reporting: {checked: true}, journey: unsafeItem, process: {checked: true, url: 'file:///tmp/report'}}}}),
    JSON.stringify({version: 2, selectedProduct: {id: 'prime'}, products: {deposits: {reporting: {checked: true, url: 42}, monthly: 'true', process: {checked: true, url: 'data:text/html,x'}}}}),
  ];
  for (const [index, payload] of cases.entries()) await t.test(`invalid state ${index + 1}`, t => {
    const page = openPage(t, {storage: new Map([[storageKey, payload]])});
    assert.equal(page.select.value, 'deposits');
    assertEmpty(page);
  });
  await t.test('only literal booleans are accepted even when evidence is valid', t => {
    const state = {version: 2, selectedProduct: 'prime', products: {prime: {
      reporting: {checked: 'true', url: 'https://example.org/report'},
      monthly: {checked: 1, url: 'https://example.org/monthly'},
      process: {checked: true, url: 'https://example.org/process'},
    }}};
    const page = openPage(t, {storage: new Map([[storageKey, JSON.stringify(state)]])});
    assert.equal(page.select.value, 'prime');
    assert.deepEqual(page.values(), [false, false, true, false]);
    for (const key of keys.slice(0, 3)) assert.equal(page.checkbox(key).disabled, false);
    assert.equal(page.checkbox('journey').disabled, true);
  });
});

test('blocked storage keeps current-session evidence and product switching usable', async t => {
  for (const blocked of ['access', 'read', 'write']) await t.test(blocked, t => {
    const page = openPage(t, {blocked});
    assertEmpty(page);
    page.attach('journey', 'https://example.org/session/deposits');
    page.selectProduct('prime');
    assertEmpty(page);
    page.attach('process', 'https://example.org/session/prime');
    page.selectProduct('deposits');
    assert.deepEqual(page.values(), [false, false, false, true]);
    assert.equal(page.controls('journey').querySelector('a').href, 'https://example.org/session/deposits');
  });
});

test('skill dialogs show task and product context without attaching evidence or toggling checks', t => {
  const page = openPage(t);
  page.selectProduct('prime');
  const dialog = page.document.getElementById('skill-dialog');
  for (const [skill, title, url] of [
    ['monthly', 'Построить помесячно воронку', 'https://navigator.sigma.sbrf.ru/gdash/1000005903/1000050768'],
    ['process', 'Построить граф процесса', 'https://navigator.sigma.sbrf.ru/gdash/1000005903/1000050768'],
    ['journey', 'Анализ отдельного клиентского пути', 'https://navigator.sigma.sbrf.ru/gdash/1000005903/1000050768'],
    ['campaign', 'Оценить продажи и CR кампейнинга', 'https://navigator.sigma.sbrf.ru/gdash/1000005903/1000049944'],
  ]) {
    const trigger = page.document.querySelector(`[data-skill="${skill}"]`);
    trigger.click();
    assert.equal(dialog.open, true);
    assert.equal(page.evidenceDialog.open, false);
    assert.equal(page.document.getElementById('skill-title').textContent, title);
    assert.equal(page.document.getElementById('skill-product').textContent, 'Продукт: Прайм');
    assert.ok(page.document.getElementById('skill-purpose').textContent.length > 20);
    assert.ok(page.document.getElementById('skill-result').textContent.length > 20);
    const link = page.document.getElementById('skill-external');
    assert.equal(link.href, url);
    assert.equal(link.target, '_blank');
    assert.ok(link.relList.contains('noopener'));
    assert.ok(link.relList.contains('noreferrer'));
    assert.equal(dialog.querySelector('form').method, 'dialog');
    dialog.close();
    assert.equal(dialog.open, false);
    assert.equal(page.document.activeElement, trigger);
    assertEmpty(page);
  }
  page.selectProduct('deposits');
  page.document.querySelector('[data-skill="journey"]').click();
  assert.equal(page.document.getElementById('skill-product').textContent, 'Продукт: Вклады');
});
