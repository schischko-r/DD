import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {JSDOM, VirtualConsole} from 'jsdom';

const build = process.env.DDI_PROFILE_TEST_HTML;

test('Summary goal details preserve scope, team statuses and the Q3-only goal policy', {skip: !build}, async () => {
  assert.ok(existsSync(build));
  const html = readFileSync(build, 'utf8'), errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  console.on('error', (...args) => errors.push(args.join(' ')));
  const dom = new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: console,
    beforeParse(window) {
      window.scrollTo = () => {};
      window.matchMedia = () => ({matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}});
      window.HTMLElement.prototype.getBoundingClientRect = () => ({x: 0, y: 0, top: 0, left: 0, right: 900, bottom: 1000, width: 900, height: 1000});
      Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', {get: () => 1000});
      Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', {get: () => 900});
      window.HTMLCanvasElement.prototype.getContext = () => ({font: '14px sans-serif', measureText: text => ({width: String(text).length * 7, actualBoundingBoxAscent: 11, actualBoundingBoxDescent: 3})});
      window.SVGElement.prototype.getBBox = function () {return {x: 0, y: 0, width: this.textContent.length * 7, height: 14};};
      window.SVGElement.prototype.getComputedTextLength = function () {return this.textContent.length * 7;};
      Object.defineProperty(window.document, 'fonts', {value: {ready: Promise.resolve(), check: () => true, addEventListener() {}, removeEventListener() {}}});
      window.ResizeObserver = class {
        constructor(callback) {this.callback = callback; this.seen = new WeakSet(); this.active = true;}
        observe(target) {if (this.seen.has(target)) return; this.seen.add(target); queueMicrotask(() => {if (this.active) this.callback([{target, contentRect: target.getBoundingClientRect()}], this);});}
        unobserve() {}
        disconnect() {this.active = false;}
      };
      window.fetch = async url => {
        const name = String(url).split('/').at(-1);
        assert.match(name, /^[\w-]+\.json$/, 'the test must not make external network requests');
        const file = new URL(`../../public/${name}`, import.meta.url);
        return {ok: existsSync(file), json: async () => existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null};
      };
      window.addEventListener('error', event => errors.push(event.message));
    },
  });
  const doc = dom.window.document;
  const pause = () => new Promise(resolve => setTimeout(resolve, 50));
  const wait = async predicate => {
    for (let i = 0; i < 80; i++) {if (predicate()) return; await pause();}
    assert.ok(predicate(), errors.join('\n') || 'Expected Summary UI state became ready');
  };
  const dialog = () => doc.querySelector('.dashboard-goal-dialog');
  const choose = async (selector, label) => {
    const trigger = doc.querySelector(selector); assert.ok(trigger, selector); trigger.click(); await pause();
    const option = [...doc.querySelectorAll('[role="option"]')].find(item => item.textContent.trim() === label);
    assert.ok(option, label); option.click(); await pause();
  };
  const open = async () => {doc.querySelector('.dashboard-goal-details').click(); await wait(() => dialog()?.querySelector('.dashboard-goal-table'));};
  const checkHero = (met, total) => {
    const hero = dialog().querySelector('.dashboard-goal-metric');
    assert.equal(hero.querySelector('strong').textContent, String(met));
    assert.equal(hero.querySelector('span').textContent.trim(), `/ ${total}`);
  };
  const close = async () => {
    doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true}));
    await wait(() => !dialog());
  };
  try {
    for (const [, attrs, script] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!/application\/json/.test(attrs)) dom.window.eval(script.replaceAll('import.meta.url', JSON.stringify('http://localhost/index.html')));
    }
    await wait(() => doc.querySelector('.dashboard-goal-summary'));
    assert.match(doc.querySelector('.dashboard-goal-summary').textContent, /43\/76/);
    assert.match(doc.querySelector('.dashboard-goal-summary').textContent, /57%/);
    assert.ok(doc.querySelector('.dashboard-goal-summary .metric-light-warning'), '43 of 76 goals keep the global marker orange');
    assert.equal(doc.querySelector('.dashboard-goal-summary .metric-light-success'), null);
    assert.equal(doc.querySelectorAll('.dashboard-goal-details').length, 1);
    await open(); checkHero(43, 76);
    assert.deepEqual([...dialog().querySelectorAll('thead th')].map(item => item.textContent),
      ['Команда', 'Переход уровня DDI', 'Цель по повышению уровня DDI']);
    assert.match(dialog().querySelector('.dashboard-goal-leaders').textContent, /7 \/ 76/);
    assert.equal(dialog().querySelectorAll('.dashboard-goal-unit-row').length, 8);
    assert.ok([...dialog().querySelectorAll('.dashboard-goal-unit-row th')].every(cell => cell.colSpan === 2), 'unit groups span the first two of three columns');
    const collapsed = [...dialog().querySelectorAll('.dashboard-goal-unit-toggle[aria-expanded="false"]')];
    for (const button of collapsed) {button.click(); await pause();}
    const teams = [...dialog().querySelectorAll('.dashboard-goal-team-row')];
    assert.equal(teams.length, 76); assert.ok(teams.every(row => row.children.length === 3));
    assert.equal(teams.filter(row => row.lastElementChild.textContent === 'Выполнена').length, 43);
    assert.equal(teams.filter(row => row.lastElementChild.textContent === 'Не выполнена').length, 33);
    assert.equal(dialog().querySelectorAll('.dashboard-goal-level-current.is-improved').length, 41, 'only actual maturity-level gains receive green transitions');
    assert.equal(dialog().querySelectorAll('.dashboard-goal-level-retained').length, 2, 'the two original leaders have a separate preservation state');
    for (const row of teams) {
      const achieved = row.lastElementChild.textContent === 'Выполнена';
      assert.ok(row.lastElementChild.querySelector(achieved ? '.g-label_theme_success' : '.g-label_theme_normal'), 'statuses have separate green and neutral themes');
    }
    const thanks = teams.find(row => row.querySelector('th').textContent === 'СберСпасибо');
    assert.match(thanks.children[1].textContent, /70%/); assert.match(thanks.children[1].textContent, /Зрелые/);
    assert.match(thanks.children[1].textContent, /68%/);
    assert.equal(thanks.querySelector('.dashboard-goal-level-current.is-improved'), null, 'a numeric gain within the same maturity level is not a green transition');
    assert.ok(thanks.querySelector('.dashboard-goal-level-previous'));
    assert.ok(thanks.querySelector('.dashboard-goal-level-current'));
    const bpif = teams.find(row => row.querySelector('th').textContent === 'БПИФ');
    assert.match(bpif.children[1].textContent, /52%/); assert.match(bpif.children[1].textContent, /63%/);
    assert.match(bpif.querySelector('.dashboard-goal-level-previous').textContent, /Развивающиеся/);
    assert.match(bpif.querySelector('.dashboard-goal-level-current.is-improved').textContent, /Зрелые/);
    assert.ok(bpif.querySelector('.dashboard-goal-level-arrow'), 'an improved team shows the old-to-new direction');
    const callCenter = teams.find(row => row.querySelector('th').textContent === 'Колл-центр');
    assert.match(callCenter.children[1].textContent, /92%/);
    assert.match(callCenter.querySelector('.dashboard-goal-level-retained').textContent, /Лидеры \(сохранение\)/);
    assert.equal(callCenter.querySelector('.dashboard-goal-level-previous'), null, 'retained leaders have one green preservation label');
    assert.equal(callCenter.querySelector('.dashboard-goal-level-current'), null);
    const firstUnit = dialog().querySelector('.dashboard-goal-unit-toggle');
    const expandedCount = teams.length; firstUnit.click(); await pause();
    assert.ok(dialog().querySelectorAll('.dashboard-goal-team-row').length < expandedCount, 'unit disclosure actually collapses its teams');
    await choose('.dashboard-goal-unit [role="combobox"]', 'CBP'); checkHero(4, 13);
    assert.equal(dialog().querySelectorAll('.dashboard-goal-team-row').length, 13);
    assert.equal(dialog().querySelectorAll('.dashboard-goal-unit-row').length, 1);
    assert.ok([...dialog().querySelectorAll('.dashboard-goal-team-row')].every(row => row.closest('tbody').querySelector('.dashboard-goal-unit-toggle b').textContent === 'CBP'));
    assert.match(doc.querySelector('.dashboard-goal-summary').textContent, /43\/76/, 'local dialog scope does not alter the global Summary');
    assert.ok(doc.querySelector('.dashboard-goal-summary .metric-light-warning'), 'local dialog selection does not change the global marker');
    await close();
    await choose('.dashboard-unit-filter [role="combobox"]', 'PC');
    await wait(() => /4\/4/.test(doc.querySelector('.dashboard-goal-summary')?.textContent));
    assert.ok(doc.querySelector('.dashboard-goal-summary .metric-light-success'), 'all four PC teams met their goals, so the global marker is green');
    assert.equal(doc.querySelector('.dashboard-goal-summary .metric-light-warning'), null);
    await open(); checkHero(4, 4);
    assert.equal(dialog().querySelectorAll('.dashboard-goal-team-row').length, 4);
    assert.equal(dialog().querySelectorAll('.dashboard-goal-unit-row').length, 1);
    assert.ok([...dialog().querySelectorAll('.dashboard-goal-team-row')].every(row => row.closest('tbody').querySelector('.dashboard-goal-unit-toggle b').textContent === 'PC'));
    await choose('.dashboard-goal-unit [role="combobox"]', 'B2C · Все юниты'); checkHero(43, 76);
    assert.match(doc.querySelector('.dashboard-unit-filter [role="combobox"]').textContent, /PC/);
    assert.ok(doc.querySelector('.dashboard-goal-summary .metric-light-success'), 'the local B2C dialog scope does not override the all-met PC marker');
    await close(); await open(); checkHero(4, 4); await close();
    await choose('.dashboard-period [role="combobox"]', 'II кв. 2026');
    await wait(() => !doc.querySelector('.dashboard-goal-summary'));
    assert.equal(doc.querySelector('.dashboard-goal-details'), null);
    assert.equal(dialog(), null, 'Q2 never presents a III-quarter goal dialog');
    assert.ok(!errors.some(error => /Maximum update depth|TypeError|ReferenceError/.test(error)), errors.join('\n'));
  } finally {dom.window.close();}
});
