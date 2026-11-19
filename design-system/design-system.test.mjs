import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {flattenTokens, resolveTokens, renderTokensCss, renderComponentsCss} from './build.mjs';

const require = createRequire(new URL('../gravity-app/package.json', import.meta.url));
const {JSDOM, VirtualConsole} = require('jsdom');
const tokens = JSON.parse(readFileSync(new URL('./tokens.json', import.meta.url), 'utf8'));
const registry = JSON.parse(readFileSync(new URL('./components.json', import.meta.url), 'utf8'));
const token = ($type, $value) => ({$type, $value});

test('typed tokens resolve aliases and generate CSS variables without losing units', () => {
  const resolved = resolveTokens(tokens);
  assert.equal(resolved.size, flattenTokens(tokens).size);
  assert.ok(resolved.size > 50);
  assert.deepEqual(resolved.get('color.text.primary').value, resolved.get('primitive.color.ink').value);
  const css = renderTokensCss(tokens);
  assert.match(css, /--ddi-color-text-primary: var\(--ddi-primitive-color-ink\)/);
  assert.match(css, /--ddi-size-control: 44px/);
  assert.match(css, /--ddi-motion-duration: 160ms/);
  assert.doesNotMatch(css, /\[object Object\]|undefined|NaN/);
  assert.equal(resolveTokens({group: {$type: 'number', base: {$value: 2}, alias: {$value: '{group.base}'}}}).get('group.alias').value, 2);
});

test('invalid token references, types and ambiguous CSS names fail explicitly', async t => {
  const cases = [
    ['missing alias', {a: token('number', '{missing}')}, /Missing.*missing/],
    ['alias cycle', {a: token('number', '{b}'), b: token('number', '{a}')}, /Circular/],
    ['alias type mismatch', {a: token('number', 1), b: token('dimension', '{a}')}, /type mismatch/],
    ['unsupported type', {a: token('unknown', 1)}, /Unsupported/],
    ['out of gamut color', {a: token('color', {colorSpace: 'srgb', components: [1.1, 0, 0]})}, /Invalid color/],
    ['invalid alpha', {a: token('color', {colorSpace: 'srgb', components: [0, 0, 0], alpha: -1})}, /Invalid color/],
    ['unitless dimension', {a: token('dimension', 4)}, /Invalid dimension/],
    ['non-finite number', {a: token('number', Infinity)}, /Invalid number/],
    ['empty font family', {a: token('fontFamily', [])}, /Invalid fontFamily/],
    ['invalid font weight', {a: token('fontWeight', 1001)}, /Invalid fontWeight/],
    ['negative duration', {a: token('duration', {value: -1, unit: 'ms'})}, /Invalid duration/],
  ];
  for (const [name, document, error] of cases) await t.test(name, () => assert.throws(() => resolveTokens(document), error));
  assert.throws(() => renderTokensCss({'a-b': token('number', 1), a: {b: token('number', 2)}}), /collide/);
  assert.throws(() => renderTokensCss({family: token('fontFamily', '</style><script>window.injected=1</script>')}), /unsafe closing style tag/);
});

function composite(color, background = [1, 1, 1]) {
  const alpha = color.alpha ?? 1;
  return color.components.map((channel, index) => channel * alpha + background[index] * (1 - alpha));
}
function luminance(rgb) {
  const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

test('readable semantic foreground/background pairs meet 4.5:1 contrast', () => {
  const resolved = resolveTokens(tokens);
  const pairs = [
    ['color.text.primary', 'color.surface.page'],
    ['color.text.secondary', 'color.surface.page'],
    ['color.text.meta', 'color.surface.page'],
    ['color.action.on-primary', 'color.action.primary'],
    ['color.action.on-primary', 'color.action.hover'],
    ['color.agent.foreground', 'color.agent.background'],
    ['color.text.primary', 'color.agent.background'],
    ...['success', 'warning', 'danger', 'neutral'].map(state => [`color.status.${state}.foreground`, `color.status.${state}.background`]),
  ];
  for (const [foreground, background] of pairs) {
    const bg = composite(resolved.get(background).value);
    const fg = composite(resolved.get(foreground).value, bg);
    const values = [luminance(bg), luminance(fg)].sort((a, b) => a - b);
    const ratio = (values[1] + 0.05) / (values[0] + 0.05);
    assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(3)}:1`);
  }
});

test('generated standalone catalog and tokens are current', () => {
  const output = execFileSync(process.execPath, [new URL('./build.mjs', import.meta.url).pathname, '--check'], {encoding: 'utf8'});
  assert.equal(JSON.parse(output).check, true);
});

test('component media queries follow breakpoint tokens and reject unknown markers', () => {
  const changed = structuredClone(tokens);
  changed.layout.breakpoint.mobile.$value = {value: 800, unit: 'px'};
  const source = '@media(max-width:{{DDI_BP_MOBILE}}){.ddi{display:block}}';
  assert.match(renderComponentsCss(source, tokens), /max-width:760px/);
  assert.match(renderComponentsCss(source, changed), /max-width:800px/);
  assert.throws(() => renderComponentsCss('@media(max-width:{{DDI_BP_UNKNOWN}}){}', tokens), /Unknown.*marker/);
});

test('documented components trace to existing source documents and selectors', () => {
  const documents = new Map();
  try {
    for (const component of registry.components) {
      assert.ok(component.references.length, `${component.id} has a source`);
      for (const reference of component.references) {
        if (!documents.has(reference.file)) {
          documents.set(reference.file, new JSDOM(readFileSync(new URL(`../${reference.file}`, import.meta.url), 'utf8')));
        }
        if (reference.selector) assert.ok(documents.get(reference.file).window.document.querySelector(reference.selector), `${component.id}: ${reference.file} ${reference.selector}`);
      }
    }
  } finally {
    for (const dom of documents.values()) dom.window.close();
  }
});

function openCatalog(t) {
  const errors = [];
  const requests = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(readFileSync(new URL('./index.html', import.meta.url), 'utf8'), {
    url: new URL('./index.html', import.meta.url).href,
    runScripts: 'dangerously',
    virtualConsole: console,
    beforeParse(window) {
      window.matchMedia = () => ({matches: true, addEventListener() {}, removeEventListener() {}});
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.fetch = (...args) => { requests.push(args); return Promise.reject(new Error('Unexpected network request')); };
      window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
      window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
      window.HTMLInputElement.prototype.reportValidity = function () { return this.checkValidity(); };
    },
  });
  t.after(() => {
    dom.window.close();
    assert.deepEqual(errors, [], 'no runtime errors');
    assert.deepEqual(requests, [], 'no network requests');
  });
  const {window} = dom;
  const document = window.document;
  const byId = id => {
    const element = document.getElementById(id);
    assert.ok(element, `#${id} exists`);
    return element;
  };
  const input = (id, value, type = 'input') => {
    const element = byId(id);
    element.value = value;
    element.dispatchEvent(new window.Event(type, {bubbles: true}));
    return element;
  };
  return {window, document, byId, input};
}

test('standalone catalog has registered examples, valid anchors and native accessible controls', t => {
  const {document} = openCatalog(t);
  const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
  assert.equal(new Set(ids).size, ids.length, 'IDs are unique');
  for (const link of document.querySelectorAll('a[href^="#"]')) {
    assert.ok(document.getElementById(link.getAttribute('href').slice(1)), `anchor ${link.getAttribute('href')}`);
  }
  assert.deepEqual(new Set([...document.querySelectorAll('[data-component]')].map(element => element.dataset.component)), new Set(registry.components.map(component => component.id)));
  assert.equal(document.querySelectorAll('script[src],link[rel="stylesheet"]').length, 0);
  for (const element of document.querySelectorAll('[src]')) assert.match(element.getAttribute('src'), /^data:/);
  for (const style of document.querySelectorAll('style')) {
    assert.doesNotMatch(style.textContent, /@import\b/i);
    for (const [, url] of style.textContent.matchAll(/url\(\s*["']?([^)'"\s]+)/gi)) assert.match(url, /^(#|data:)/);
  }
  for (const element of document.querySelectorAll('input,select,textarea')) {
    assert.ok(element.labels?.length || element.getAttribute('aria-label') || element.getAttribute('aria-labelledby'), `${element.id} has an accessible name`);
  }
  assert.ok(document.querySelector('[data-component="agent-dialog"] .ddi-thinking-spec'));
  assert.ok(document.querySelector('[data-component="agent-dialog"] .ddi-mini-funnel'));
  assert.ok(document.querySelector('[data-component="agent-dialog"] table caption'));
  assert.ok(document.querySelector('details.ddi-skill > summary'));
});

test('evidence URLs gate completion, reject unsafe protocols, and can be edited or removed', t => {
  const {window, byId, input} = openCatalog(t);
  const check = byId('ddi-evidence-check');
  const link = byId('ddi-evidence-link');
  const dialog = byId('ddi-evidence-dialog');
  const submit = () => byId('ddi-evidence-form').dispatchEvent(new window.Event('submit', {bubbles: true, cancelable: true}));
  assert.equal(check.checked, false);
  assert.equal(check.disabled, true);
  assert.equal(link.hidden, true);
  check.checked = true;
  check.dispatchEvent(new window.Event('change', {bubbles: true}));
  assert.equal(check.checked, false, 'completion cannot be forced without evidence');
  byId('ddi-evidence-open').click();
  assert.equal(dialog.open, true);
  for (const url of ['javascript:alert(1)', 'data:text/html,unsafe', 'file:///tmp/evidence']) {
    input('ddi-evidence-url', url);
    submit();
    assert.equal(dialog.open, true);
    assert.equal(check.checked, false);
    assert.equal(check.disabled, true);
    assert.equal(link.hasAttribute('href'), false);
  }
  input('ddi-evidence-url', 'https://example.org/evidence?a=1');
  submit();
  assert.equal(dialog.open, false);
  assert.equal(check.disabled, false);
  assert.equal(check.checked, true);
  assert.equal(link.hidden, false);
  assert.equal(link.href, 'https://example.org/evidence?a=1');
  assert.equal(link.target, '_blank');
  assert.ok(link.relList.contains('noopener') && link.relList.contains('noreferrer'));
  check.click();
  assert.equal(check.checked, false, 'linked checklist can be manually unchecked');
  byId('ddi-evidence-open').click();
  input('ddi-evidence-url', 'https://example.org/edited');
  submit();
  assert.equal(check.checked, true);
  assert.equal(link.href, 'https://example.org/edited');
  byId('ddi-evidence-open').click();
  byId('ddi-evidence-remove').click();
  assert.equal(dialog.open, false);
  assert.equal(check.checked, false);
  assert.equal(check.disabled, true);
  assert.equal(link.hidden, true);
  assert.equal(link.hasAttribute('href'), false);
});

test('product filter isolates evidence and manual metrics and cancel keeps saved evidence', t => {
  const {window, byId, input} = openCatalog(t);
  const select = byId('ddi-product');
  assert.deepEqual([...select.options].map(option => [option.value, option.textContent.trim()]), [['deposits', 'Вклады'], ['prime', 'Прайм']]);
  input('ddi-identified', '800');
  byId('ddi-evidence-open').click();
  input('ddi-evidence-url', 'https://example.org/deposits');
  byId('ddi-evidence-form').dispatchEvent(new window.Event('submit', {bubbles: true, cancelable: true}));
  input('ddi-product', 'prime', 'change');
  assert.equal(byId('ddi-evidence-check').checked, false);
  assert.equal(byId('ddi-evidence-check').disabled, true);
  assert.equal(byId('ddi-identified').value, '');
  input('ddi-identified', '950');
  input('ddi-product', 'deposits', 'change');
  assert.equal(byId('ddi-evidence-check').checked, true);
  assert.equal(byId('ddi-evidence-link').href, 'https://example.org/deposits');
  assert.equal(byId('ddi-identified').value, '800');
  byId('ddi-evidence-open').click();
  input('ddi-evidence-url', 'https://example.org/unsaved');
  byId('ddi-evidence-cancel').click();
  assert.equal(byId('ddi-evidence-dialog').open, false);
  assert.equal(byId('ddi-evidence-link').href, 'https://example.org/deposits');
  input('ddi-product', 'prime', 'change');
  assert.equal(byId('ddi-identified').value, '950');
});

test('numeric input formats exact digits while sourced denominator stays readonly', t => {
  const {byId, input} = openCatalog(t);
  const sam = byId('ddi-sam');
  assert.equal(sam.readOnly, true);
  assert.equal(sam.disabled, false, 'readonly value remains selectable');
  assert.equal(sam.value.replace(/\s/g, ''), '1000');
  assert.ok(sam.closest('[data-component="source-field"]'));
  const identified = input('ddi-identified', '345664566546');
  assert.equal(identified.value, '345 664 566 546');
  input('ddi-identified', '1234,5600');
  assert.equal(identified.value, '1 234,5600');
  input('ddi-identified', '1234.');
  assert.equal(identified.value, '1 234.');
  assert.equal(identified.type, 'text');
  const unit = identified.parentElement.querySelector('.ddi-field-unit');
  assert.ok(unit?.textContent.trim(), 'unit belongs to the field wrapper');
  assert.doesNotMatch(identified.value, /%|₽/);
  input('ddi-identified', '500');
  const coverage = byId('ddi-coverage').textContent;
  input('ddi-sam', '2000');
  assert.equal(byId('ddi-coverage').textContent, coverage, 'synthetic edit cannot supersede source');
  assert.equal(sam.value.replace(/\s/g, ''), '1000');
});

test('coverage, readable status and insight use one derived state including invalid input', t => {
  const {document, byId, input} = openCatalog(t);
  const cases = [['', 'neutral', null], ['0', 'danger', 0], ['799', 'danger', 79.9], ['800', 'warning', 80], ['949.6', 'success', 95], ['1000', 'success', 100], ['1001', 'neutral', null], ['-1', 'neutral', null], ['oops', 'neutral', null]];
  for (const [value, state, coverage] of cases) {
    input('ddi-identified', value);
    assert.equal(byId('ddi-insight').dataset.state, state, value);
    assert.equal(document.querySelector('[data-component="status"]').dataset.state, state, value);
    const lights = [...document.querySelectorAll('.ddi-lights [data-status][data-active="true"]')];
    assert.deepEqual(lights.map(light => light.dataset.status), state === 'neutral' ? [] : [state], value);
    assert.ok(byId('ddi-status-label').textContent.trim());
    assert.ok(byId('ddi-insight-title').textContent.trim());
    assert.equal(byId('ddi-status-label').textContent, byId('ddi-insight-title').textContent);
    assert.ok(byId('ddi-insight-body').textContent.trim());
    const output = byId('ddi-coverage').textContent;
    if (coverage === null) assert.doesNotMatch(output, /\d/, value);
    else assert.equal(Number(output.replace(/\s|%/g, '').replace(',', '.')), coverage, value);
  }
});

test('scenario tabs support keyboard selection, roving focus and linked native panels', t => {
  const {window, document, byId} = openCatalog(t);
  const example = byId('ddi-tab-example');
  const rules = byId('ddi-tab-rules');
  assert.equal(byId('ddi-tabs').getAttribute('role'), 'tablist');
  function selected(active, inactive) {
    assert.equal(active.getAttribute('aria-selected'), 'true');
    assert.equal(active.tabIndex, 0);
    assert.equal(inactive.getAttribute('aria-selected'), 'false');
    assert.equal(inactive.tabIndex, -1);
    const panel = byId(active.getAttribute('aria-controls'));
    assert.equal(panel.hidden, false);
    assert.equal(panel.getAttribute('aria-labelledby'), active.id);
    assert.equal(byId(inactive.getAttribute('aria-controls')).hidden, true);
  }
  selected(example, rules);
  example.focus();
  example.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
  selected(rules, example);
  assert.equal(document.activeElement, rules);
  rules.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
  selected(example, rules);
  example.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'End', bubbles: true}));
  selected(rules, example);
  rules.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Home', bubbles: true}));
  selected(example, rules);
  rules.click();
  selected(rules, example);
});
