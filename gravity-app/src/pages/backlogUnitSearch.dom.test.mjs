import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {JSDOM, VirtualConsole} from 'jsdom';
import {getBacklogTeamFilterOptions} from '../domain/backlogTeamSelection.js';

test('backlog Unit and searchable Team controls preserve valid selection, quarters and asynchronous entry context', async () => {
  const appRoot = fileURLToPath(new URL('../../', import.meta.url));
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'ddi-backlog-unit-test-')));
  let dom;
  try {
    const htmlPath = join(temporary, 'index.html');
    await writeFile(htmlPath, '<html><body><div id="root"></div><script type="module" src="./entry.jsx"></script></body></html>');
    await writeFile(join(temporary, 'entry.jsx'), `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {ThemeProvider} from '@gravity-ui/uikit';
      import {BacklogDecompositionPage} from ${JSON.stringify(resolve(appRoot, 'src/pages/BacklogDecompositionPage.jsx'))};
      const root = createRoot(document.getElementById('root'));
      window.renderBacklog = props => root.render(<ThemeProvider theme="light"><BacklogDecompositionPage {...props} onOpenTeam={(team, member) => { window.openedBacklogTeam = {team, member}; }} /></ThemeProvider>);
    `);
    const bundle = await build({configFile: false, root: temporary, logLevel: 'silent',
      resolve: {alias: {'react': resolve(appRoot, 'node_modules/react'), 'react-dom': resolve(appRoot, 'node_modules/react-dom'), '@gravity-ui/uikit': resolve(appRoot, 'node_modules/@gravity-ui/uikit')}},
      plugins: [viteSingleFile()], build: {write: false, rollupOptions: {input: htmlPath}}});
    const html = bundle.output.find((item) => item.type === 'asset' && item.fileName.endsWith('.html')).source;
    const errors = [];
    const console = new VirtualConsole();
    console.on('error', (...args) => errors.push(args.join(' ')));
    console.on('jsdomError', (error) => errors.push(error.message));
    dom = new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ''), {
      url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: console,
      beforeParse(window) {
        window.scrollTo = () => {};
        window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
        window.HTMLElement.prototype.getBoundingClientRect = () => ({x: 0, y: 0, left: 0, top: 0, right: 900, bottom: 700, width: 900, height: 700});
        window.HTMLCanvasElement.prototype.getContext = () => ({font: '', measureText: (text) => ({width: String(text).length * 7, actualBoundingBoxAscent: 11, actualBoundingBoxDescent: 3})});
        window.SVGElement.prototype.getBBox = () => ({x: 0, y: 0, width: 100, height: 14});
        window.SVGElement.prototype.getComputedTextLength = function () {return this.textContent.length * 7;};
        Object.defineProperty(window.document, 'fonts', {value: {ready: Promise.resolve(), check: () => true, addEventListener() {}, removeEventListener() {}}});
        window.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
        window.addEventListener('error', (event) => errors.push(event.message));
      },
    });
    for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) dom.window.eval(script.replaceAll('import.meta.url', JSON.stringify('http://localhost/index.html')));
    const doc = dom.window.document;
    const pause = () => new Promise((resolve) => setTimeout(resolve, 30));
    const wait = async (predicate) => {for (let i = 0; i < 80; i++) {if (predicate()) return;await pause();}assert.ok(predicate(), errors.join('\n') || 'UI state ready');};
    const data = JSON.parse(await readFile(resolve(appRoot, 'public/backlog-data.json'), 'utf8'));
    const products = JSON.parse(await readFile(resolve(appRoot, 'public/report-data.json'), 'utf8')).products;
    const auto = getBacklogTeamFilterOptions(data.teams, products).find((option) => option.content === 'Автокредит');
    assert.ok(auto);
    const props = {data: null, products: [], status: 'loading', initialTeamKey: auto.value};
    dom.window.renderBacklog(props);
    await pause();
    dom.window.renderBacklog({...props, data, status: 'ready'});
    await wait(() => doc.querySelector('[role="combobox"][aria-label="Команда"]'));
    // Unit metadata can arrive after the board itself, as it does during app load.
    dom.window.renderBacklog({...props, data, products, status: 'ready'});
    const control = (label) => doc.querySelector(`[role="combobox"][aria-label="${label}"]`);
    await wait(() => control('Юнит')?.textContent.includes('CBP') && control('Команда')?.textContent.includes('Автокредит'));
    const open = async (label) => {control(label).click();await pause();};
    const options = () => [...doc.querySelectorAll('[role="option"]')];
    const choose = async (label, value) => {
      await open(label);
      const search = doc.querySelector('input[placeholder="Найти команду"]');
      if (search?.value) {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(search, '');
        search.dispatchEvent(new dom.window.Event('input', {bubbles: true}));await pause();
      }
      const option = options().find((item) => item.textContent.trim() === value);
      assert.ok(option, `${label}: ${value}`);option.click();await pause();
    };
    const close = async () => {doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key: 'Escape', code: 'Escape', bubbles: true}));await pause();};
    await open('Команда');
    assert.ok(options().some((option) => option.textContent.includes('Автокредит')));
    assert.ok(!options().some((option) => option.textContent.includes('СберПрайм')), 'unit excludes other teams');
    const search = doc.querySelector('input[placeholder="Найти команду"]');
    assert.ok(search);
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(search, 'Объект');
    search.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
    await wait(() => options().length === 1);
    assert.equal(options()[0].textContent.trim(), 'Объект Авто');
    options()[0].click();await pause();
    const autoBoard = data.teams.find((team) => team.key === auto.teamKey);
    const q2 = autoBoard.quarters.find((quarter) => quarter.key === '2026-Q2');
    assert.ok(q2);
    await choose('Квартал', q2.label);
    const previousQuarter = control('Квартал').textContent;
    await choose('Команда', 'Автокредит');
    assert.equal(control('Квартал').textContent, previousQuarter, 'shared-board member switch preserves quarter');
    await choose('Юнит', 'CX');
    await wait(() => !control('Команда').textContent.includes('Автокредит'));
    await open('Команда');
    const cxLabels = options().map((option) => option.textContent.trim());
    for (const label of ['МВС', 'Пакет услуг СберПремьер', 'СберПрайм', 'PB']) assert.ok(cxLabels.includes(label), label);
    assert.ok(!cxLabels.includes('Автокредит'));
    await close();
    await choose('Команда', 'СберПрайм');
    const selectedQuarter = control('Квартал').textContent;
    await choose('Юнит', 'Все юниты');
    assert.ok(control('Команда').textContent.includes('СберПрайм'), 'clearing unit keeps a valid team');
    assert.equal(control('Квартал').textContent, selectedQuarter);
    dom.window.renderBacklog({...props, data, products, status: 'ready'});
    await pause();
    assert.ok(control('Команда').textContent.includes('СберПрайм'), 'same initial key never resets subsequent user selection');
    assert.ok(!errors.some((error) => /Maximum update depth|TypeError|ReferenceError/.test(error)), errors.join('\n'));
  } finally {
    dom?.window.close();
    await rm(temporary, {recursive: true, force: true});
  }
});
