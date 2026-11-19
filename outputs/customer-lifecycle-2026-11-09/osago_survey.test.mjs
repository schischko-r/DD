import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(new URL('../../gravity-app/package.json', import.meta.url));
const {JSDOM, VirtualConsole} = require('jsdom');
const html = readFileSync(new URL('./osago_survey.html', import.meta.url), 'utf8');
const normalized = text => text.replace(/\s/g, ' ');
const originalControlIds = `tam sam ev1 ev2 sam_d sc yau mau_yau mau mau_m gr ch nt npv cac_norm
  ch1 ch2 ch3 ch4 cm1 cm2 cm3 cm4 cm5 cm6 cm7 cm8 cm9 cm10 cm11 cm12 cm13 dzo nrt cov crd
  churn_model churn_model_url cmu1 cmu2 cmu3 cmu4 cmu5 cmu6 cmu7 cmu8 cmu9 cmu10 cmu11 cmu12 cmu13
  dzo_churn cr cr_hist cr_tr pol cr_cl cr_cl_hist cr_cl_tr n1 n6 mau_yau_ref`.split(/\s+/);

function openSurvey(t) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(html, {
    url: new URL('./osago_survey.html', import.meta.url).href,
    runScripts: 'dangerously',
    virtualConsole: console,
    beforeParse(window) {
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.matchMedia = query => ({matches: query.includes('prefers-reduced-motion'), addEventListener() {}, removeEventListener() {}});
      window.ResizeObserver = class {observe() {} disconnect() {}};
      window.requestAnimationFrame = () => 1;
      window.cancelAnimationFrame = () => {};
      window.SVGElement.prototype.getTotalLength = () => 100;
      window.SVGElement.prototype.getPointAtLength = () => ({x: 0, y: 0});
    },
  });
  const document = dom.window.document;
  t.after(() => {
    dom.window.close();
    assert.deepEqual(errors, [], 'initialization and interactions raise no script errors');
  });
  return {
    window: dom.window, document,
    value: id => document.getElementById(id).value,
    numberValue: id => Number.parseFloat(document.getElementById(id).value.replace(/\s/g, '').replace(',', '.')),
    change(id, value) {
      const input = document.getElementById(id);
      input.value = String(value);
      input.dispatchEvent(new dom.window.Event('change', {bubbles: true}));
    },
    color: id => [...document.querySelectorAll(`#${id} .dt.on`)].map(dot => ['g', 'y', 'r'].find(color => dot.classList.contains(color))),
  };
}

test('the original numeric defaults and initial computed results are preserved', t => {
  const page = openSurvey(t);
  // Captured from the original synthetic survey before the visual change.
  for (const id of originalControlIds) assert.ok(page.document.getElementById(id), `${id} is retained`);
  for (const [id, value] of Object.entries({tam: 12500000, sam: 4200000, sam_d: 500000, yau: 520000, mau: 250000, gr: 8000, ch: 25000, npv: 600, nrt: 4.2, cov: 62, crd: .84, cr: 23.7, pol: 520000, cr_cl: 11.6, n1: 28.3, n6: 71.5})) assert.equal(page.numberValue(id), value, id);
  for (const name of ['r1', 'r2', 'r4', 'r4Cl', 'score', 'openPool', 'poolTake', 'closePool']) assert.equal(typeof page.window[name], 'function');
  assert.equal(page.numberValue('sc'), 11.9);
  assert.equal(page.numberValue('mau_yau'), 48.1);
  assert.equal(page.numberValue('nt'), -17000);
  assert.equal(page.document.getElementById('fs').textContent, '53 / 100');
  assert.equal(page.document.querySelectorAll('#cards .ccard').length, 11);
  assert.equal(page.document.querySelectorAll('#cards_churn .ccard').length, 8);
  assert.deepEqual([...page.document.querySelectorAll('#cp input:checked,#cmp input:checked')].map(input => input.id), ['ch1', 'ch2', 'ch3', 'cm1', 'cm2', 'cm3', 'cm6', 'cm7', 'cm10']);
  assert.match(page.document.body.textContent, /Синтетические данные/);
});

test('the lifecycle diagram precedes the survey and navigation resolves to unique section IDs', t => {
  const page = openSurvey(t);
  const document = page.document;
  const overview = document.getElementById('osago-cycle');
  const diagram = document.getElementById('cycle-diagram');
  assert.ok(overview.contains(diagram));
  assert.equal(diagram.querySelectorAll('.node').length, 20);
  assert.ok(overview.compareDocumentPosition(document.getElementById('osago-potential')) & page.window.Node.DOCUMENT_POSITION_FOLLOWING);
  const expected = ['osago-cycle', 'osago-potential', 'osago-base', 'osago-channels', 'osago-journey', 'osago-activation', 'osago-summary'];
  assert.deepEqual([...document.querySelectorAll('[data-survey-section]')].map(section => section.id), expected);
  const links = [...document.querySelectorAll('.survey-nav [data-survey-link]')];
  assert.deepEqual(links.map(link => link.getAttribute('href')), expected.map(id => `#${id}`));
  for (const link of links) assert.equal(link.dataset.surveyLink, document.getElementById(link.hash.slice(1)).id);
  const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const route of diagram.querySelectorAll('[data-route]')) assert.ok(document.getElementById(route.dataset.route));
  for (const path of diagram.querySelectorAll('[marker-end]')) {
    const id = path.getAttribute('marker-end').match(/url\(#([^)]*)\)/)?.[1];
    assert.ok(id && document.getElementById(id));
  }
  for (const id of ['tam', 'sam', 'sam_d', 'yau', 'mau', 'cr', 'cr_hist', 'cr_cl', 'cr_cl_hist', 'n1', 'n6']) assert.ok(document.getElementById(id).labels.length > 0, `${id} has an associated label`);
});

test('potential and active-base fields still recalculate through their change handlers', t => {
  const page = openSurvey(t);
  page.change('sam', 1000);
  for (const [identified, coverage, color] of [[600, 60, 'r'], [850, 85, 'y'], [950, 95, 'g']]) {
    page.change('sam_d', identified);
    assert.equal(page.numberValue('sc'), coverage);
    assert.deepEqual(page.color('sl'), [color]);
    assert.equal(page.document.getElementById('alertBlock').style.display, color === 'g' ? 'none' : 'block');
    assert.ok(normalized(page.document.getElementById('zPotBody').textContent).includes(String(1000 - identified)));
  }
  page.change('yau', 1000);
  page.change('mau', 750);
  page.change('gr', 500);
  page.change('ch', 200);
  assert.equal(page.numberValue('mau_yau'), 75);
  assert.equal(page.numberValue('nt'), 300);
  assert.deepEqual(page.color('mytl'), ['g']);
  assert.equal(page.document.getElementById('alertB2').style.display, 'none');
  page.change('mau', 500);
  page.change('gr', 100);
  page.change('ch', 300);
  assert.equal(page.numberValue('mau_yau'), 50);
  assert.equal(page.numberValue('nt'), -200);
  assert.deepEqual(page.color('mytl'), ['r']);
  assert.equal(page.document.getElementById('alertB2').style.display, 'block');
  assert.ok(page.document.getElementById('zBaseVerdict').textContent.includes('-200'));
});

test('acquisition and churn tabs retain independent channel selections and generated cards', t => {
  const page = openSurvey(t);
  const tab = (block, index) => page.document.querySelector(`[onclick="switchTab(this,'${block}',${index})"]`);
  tab('b3', 1).click();
  assert.equal(page.document.getElementById('tab_b3_1').style.display, 'block');
  assert.equal(page.document.getElementById('tab_b3_0').style.display, 'none');
  page.document.getElementById('cmu4').click();
  assert.equal(page.document.querySelectorAll('#cards_churn .ccard').length, 9);
  assert.equal(page.document.querySelectorAll('#cards .ccard').length, 11);
  page.document.getElementById('cmu4').click();
  assert.equal(page.document.querySelectorAll('#cards_churn .ccard').length, 8);
  tab('b3', 0).click();
  assert.equal(tab('b3', 0).classList.contains('active'), true);
  page.document.getElementById('ch4').click();
  assert.equal(page.document.querySelectorAll('#cards .ccard').length, 12);
  page.document.getElementById('ch4').click();
  assert.equal(page.document.querySelectorAll('#cards .ccard').length, 11);
  page.change('dzo', '');
  assert.equal(page.document.querySelectorAll('#cards .ccard').length, 9);
  page.document.querySelector('#zBaseLinks .jump-btn').click();
  assert.equal(page.document.getElementById('tab_b3_1').style.display, 'block');
});

test('opening and closing funnel histories keep their opposite trend rules and score calculation', t => {
  const page = openSurvey(t);
  for (const [history, color] of [['20;21;22;23', 'g'], ['20;21;22;21', 'y'], ['25;24;23;22', 'r']]) {
    page.change('cr_hist', history);
    assert.deepEqual(page.color('crl'), [color]);
    assert.equal(page.document.getElementById('alertB4acq').style.display, color === 'g' ? 'none' : 'block');
  }
  page.document.querySelector('[onclick="switchTab(this,\'b4\',1)"]').click();
  assert.equal(page.document.getElementById('tab_b4_1').style.display, 'block');
  for (const [history, color] of [['12;11;10;9', 'g'], ['9;8;7;8', 'y'], ['9;10;11;12', 'r']]) {
    page.change('cr_cl_hist', history);
    assert.deepEqual(page.color('cr_cl_l'), [color]);
    assert.equal(page.document.getElementById('alertB4cl').style.display, color === 'g' ? 'none' : 'block');
  }
  page.document.querySelector('[onclick="switchTab(this,\'b4\',0)"]').click();
  assert.equal(page.document.getElementById('tab_b4_0').style.display, 'block');
  page.change('sam', 100);
  page.change('sam_d', 100);
  page.change('cr', 25);
  page.change('n1', 100);
  page.change('n6', 100);
  page.window.score();
  assert.equal(page.document.getElementById('fs').textContent, '90 / 100');
  assert.equal(page.document.getElementById('fs').className, 'sc g');
  page.change('sam_d', 0);
  page.change('cr', 10);
  page.change('n1', 0);
  page.change('n6', 0);
  page.window.score();
  assert.equal(page.document.getElementById('fs').textContent, '25 / 100');
  assert.equal(page.document.getElementById('fs').className, 'sc r');
});

test('the activity pool opens, takes an action once and returns to the survey', t => {
  const page = openSurvey(t);
  const open = page.document.querySelector('[onclick="openPool()"]');
  open.click();
  assert.equal(page.document.body.classList.contains('pool-open'), true);
  assert.equal(page.document.querySelectorAll('#poolBody .pact').length, 15);
  assert.deepEqual([...page.document.querySelectorAll('#poolBody .pblock')].map(block => block.querySelectorAll('.pact').length), [5, 7, 3]);
  const action = page.document.querySelector('#poolBody .pact');
  action.querySelector('.ptake').click();
  assert.equal(action.classList.contains('taken'), true);
  assert.match(page.document.getElementById('poolTaken').textContent, /Взято в работу: 1 из 15/);
  action.querySelector('.ptake').click();
  assert.match(page.document.getElementById('poolTaken').textContent, /Взято в работу: 1 из 15/);
  page.document.querySelector('[onclick="closePool()"]').click();
  assert.equal(page.document.body.classList.contains('pool-open'), false);
  open.click();
  assert.match(page.document.getElementById('poolTaken').textContent, /Взято в работу: 1 из 15/);
  page.document.querySelector('[onclick="closePool()"]').click();
  assert.equal(page.document.body.classList.contains('pool-open'), false);
});

test('static and recalculated status content uses SVG icons without rendered emoji', async t => {
  const page = openSurvey(t);
  const settle = () => new Promise(resolve => page.window.setTimeout(resolve, 0));
  const assertNoEmoji = () => {
    const walker = page.document.createTreeWalker(page.document.body, page.window.NodeFilter.SHOW_TEXT);
    const text = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement?.closest('script,style,textarea')) text.push(node.textContent);
    }
    for (const control of page.document.querySelectorAll('input,textarea')) text.push(control.value);
    assert.doesNotMatch(text.join('\n'), /\p{Extended_Pictographic}|\uFE0F|\u20E3/u);
  };
  await settle();
  assertNoEmoji();
  assert.ok(page.document.querySelector('svg[data-ui-icon]'));
  page.change('sam', 1000);
  page.change('sam_d', 600);
  page.change('cr_hist', '25;24;23;22');
  await settle();
  assertNoEmoji();
  assert.ok(page.document.querySelector('#zPotBody svg[data-ui-icon]'));
  page.document.querySelector('[onclick="openPool()"]').click();
  page.document.querySelector('#poolBody .ptake').click();
  await settle();
  assertNoEmoji();
  assert.ok(page.document.querySelector('#poolTaken svg[data-ui-icon]'));
  assert.match(page.document.getElementById('poolTaken').textContent, /Взято в работу: 1 из/);
});

test('metric units remain inside native input wrappers and never enter numeric values', t => {
  const page = openSurvey(t);
  const coverage = page.document.getElementById('cov');
  const wrapper = coverage.closest('.metric-field');
  assert.ok(wrapper);
  assert.equal(coverage.type, 'number');
  assert.equal(coverage.value, '62');
  assert.equal(wrapper.querySelector('.metric-adornment .metric-unit').textContent.trim(), '%');
  assert.equal([...coverage.closest('.f').childNodes].some(node => node.nodeType === page.window.Node.TEXT_NODE && node.textContent.includes('%')), false, 'there is no detached percent below the field');
  assert.ok(coverage.labels.length > 0);
  page.change('cov', 80);
  assert.equal(coverage.value, '80');
  assert.equal(wrapper.querySelector('.metric-unit').textContent.trim(), '%');
  page.change('sam', 1000);
  page.change('sam_d', 850);
  const computed = page.document.getElementById('sc');
  assert.equal(page.numberValue('sc'), 85);
  assert.doesNotMatch(computed.value, /%|\p{Extended_Pictographic}/u);
  assert.equal(computed.closest('.metric-field').querySelector('.metric-unit').textContent.trim(), '%');
});
