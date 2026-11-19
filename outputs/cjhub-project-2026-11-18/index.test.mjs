import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(new URL('../../gravity-app/package.json', import.meta.url));
const {JSDOM, VirtualConsole} = require('jsdom');
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const project = JSON.parse(readFileSync(new URL('./project.json', import.meta.url), 'utf8'));
const normalized = value => value.replace(/\s+/g, ' ').replace(/ё/g, 'е').trim().toLowerCase();

function openPage(t, {clipboard, fallback = true} = {}) {
  const errors = [];
  const requests = [];
  const fallbackCopies = [];
  const fallbackFocused = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(html, {
    url: new URL('./index.html', import.meta.url).href,
    runScripts: 'dangerously',
    virtualConsole: console,
    beforeParse(window) {
      window.matchMedia = () => ({matches: true, addEventListener() {}, removeEventListener() {}});
      window.IntersectionObserver = class {observe() {} disconnect() {}};
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.fetch = async url => { requests.push(String(url)); throw new Error('Unexpected network request'); };
      if (clipboard) Object.defineProperty(window.navigator, 'clipboard', {value: {writeText: clipboard}});
      window.document.execCommand = command => {
        assert.equal(command, 'copy');
        const selected = [...window.document.querySelectorAll('textarea')].find(field => field.selectionStart === 0 && field.selectionEnd === field.value.length);
        fallbackFocused.push(Boolean(selected && window.document.activeElement === selected));
        fallbackCopies.push(selected?.value || window.document.activeElement?.value || window.getSelection().toString());
        return fallback;
      };
    },
  });
  t.after(() => {
    dom.window.close();
    assert.deepEqual(errors, [], 'the page runs without script errors');
    assert.deepEqual(requests, [], 'the standalone page makes no data requests');
  });
  return {
    window: dom.window, document: dom.window.document, fallbackCopies, fallbackFocused,
    settle: () => new Promise(resolve => dom.window.setTimeout(resolve, 0)),
  };
}

test('standalone navigation points to unique semantic sections and uses only the authorized external CTA', t => {
  const page = openPage(t);
  const document = page.document;
  assert.equal(document.querySelectorAll('main').length, 1);
  assert.ok(document.querySelector('nav.page-nav[aria-label]'));
  const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(new Set(ids).size, ids.length);
  const links = [...document.querySelectorAll('.page-nav a[data-section]')];
  assert.deepEqual(links.map(link => link.dataset.section), ['overview', 'value', 'scenarios', 'skills', 'architecture', 'roadmap', 'start']);
  assert.equal(document.getElementById('passport'), null);
  for (const link of links) {
    const target = document.getElementById(link.hash.slice(1));
    assert.ok(target);
    assert.equal(target.tagName, 'SECTION');
  }
  for (const link of document.querySelectorAll('a[href^="#"]')) assert.ok(document.getElementById(link.hash.slice(1)));
  const external = [...document.querySelectorAll('a[href]')].filter(link => /^https?:/i.test(link.getAttribute('href')));
  assert.ok(external.length > 0);
  for (const link of external) {
    assert.equal(link.getAttribute('href'), project.distribution.url, 'no MCP or SberTrack URL is invented');
    assert.equal(link.target, '_blank');
    assert.ok(link.relList.contains('noopener'));
    assert.ok(link.relList.contains('noreferrer'));
  }
  assert.equal(document.querySelectorAll('script[src],link[rel="stylesheet"],iframe').length, 0);
  for (const node of document.querySelectorAll('[src]')) assert.match(node.getAttribute('src'), /^(?:data:|#)/);
  const css = [...document.querySelectorAll('style')].map(style => style.textContent).join('\n');
  assert.doesNotMatch(css, /@import|url\(\s*['"]?https?:/i);
});

test('the two scenario tabs support clicks, arrow keys and a single selected accessible panel', t => {
  const page = openPage(t);
  const document = page.document;
  const tabs = [...document.querySelectorAll('#scenario-tabs [role="tab"]')];
  assert.equal(tabs.length, 2);
  assert.equal(document.getElementById('scenario-tabs').getAttribute('role'), 'tablist');
  const assertSelected = selected => {
    tabs.forEach((tab, index) => {
      assert.equal(tab.tagName, 'BUTTON');
      assert.equal(tab.getAttribute('aria-selected'), String(index === selected));
      assert.equal(tab.tabIndex, index === selected ? 0 : -1);
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      assert.ok(panel);
      assert.equal(panel.getAttribute('role'), 'tabpanel');
      assert.equal(panel.getAttribute('aria-labelledby'), tab.id);
      assert.equal(panel.hidden, index !== selected);
    });
  };
  assertSelected(0);
  tabs[1].click();
  assertSelected(1);
  tabs[1].focus();
  tabs[1].dispatchEvent(new page.window.KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
  assertSelected(0);
  assert.equal(document.activeElement, tabs[0]);
  tabs[0].dispatchEvent(new page.window.KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}));
  assertSelected(1);
  assert.equal(document.activeElement, tabs[1]);
  tabs[1].dispatchEvent(new page.window.KeyboardEvent('keydown', {key: 'Home', bubbles: true}));
  assertSelected(0);
  tabs[0].dispatchEvent(new page.window.KeyboardEvent('keydown', {key: 'End', bubbles: true}));
  assertSelected(1);
});

test('the hero shows the final result schema with empty metrics instead of fabricated figures', t => {
  const page = openPage(t);
  const table = page.document.querySelector('#overview table.result-table');
  assert.ok(table);
  assert.equal(table.querySelector('caption').textContent.trim(), 'Результат для пользователя');
  assert.deepEqual([...table.querySelectorAll('thead th')].map(cell => normalized(cell.getAttribute('aria-label') || cell.title || cell.textContent)), ['шаг', 'клиенты', 'конверсия', 'среднее время']);
  const rows = [...table.querySelectorAll('tbody tr')];
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.cells.length, 4);
    for (const cell of [...row.cells].slice(1)) assert.equal(cell.textContent.trim(), '—');
  }
  assert.match(page.document.querySelector('.result-example-label').textContent, /пример|структур|формат/i);
});

test('the scenario distinguishes agent work from expert validation and routes through the shared hub', t => {
  const page = openPage(t);
  const steps = [...page.document.querySelectorAll('#panel-existing .steps li')];
  assert.deepEqual(steps.map(step => step.dataset.actor), ['agent', 'agent', 'agent', 'user']);
  for (const step of steps.slice(0, 3)) assert.equal(step.querySelector('.step-role--agent').textContent.trim(), 'Агент');
  assert.equal(steps.at(-1).querySelector('.step-role--user').textContent.trim(), 'Пользователь');
  assert.match(steps.at(-1).textContent, /провер|валид/i);
  const nodes = [...page.document.querySelectorAll('#architecture .architecture-entry .architecture-node')];
  assert.equal(nodes.length, 4);
  for (const [index, label] of ['gigacode', 'навыки из атласа', 'cjhub', 'нужный навык'].entries()) assert.ok(normalized(nodes[index].textContent).includes(label));
});

test('the copy action sends the literal illustrative prompt to the Clipboard API', async t => {
  const copies = [];
  const page = openPage(t, {clipboard: async text => { copies.push(text); }});
  const prompt = page.document.getElementById('example-prompt').textContent.trim();
  assert.ok(prompt.length > 30);
  assert.match(page.document.getElementById('example-prompt').closest('section').textContent, /пример/i);
  page.document.getElementById('copy-prompt').click();
  await page.settle();
  assert.deepEqual(copies, [prompt]);
  assert.deepEqual(page.fallbackCopies, []);
  const status = page.document.getElementById('copy-status');
  assert.equal(status.getAttribute('role'), 'status');
  assert.match(status.textContent, /скопир/i);
  assert.equal(page.document.getElementById('example-prompt').textContent.trim(), prompt);
});

test('copy fallback handles unavailable or rejected Clipboard API without pretending failure is success', async t => {
  for (const mode of ['missing', 'rejected', 'failed']) await t.test(mode, async t => {
    const page = openPage(t, {
      clipboard: mode === 'missing' ? undefined : async () => { throw new Error('Clipboard denied'); },
      fallback: mode !== 'failed',
    });
    const prompt = page.document.getElementById('example-prompt').textContent.trim();
    page.document.getElementById('copy-prompt').click();
    await page.settle();
    assert.deepEqual(page.fallbackCopies, [prompt]);
    assert.deepEqual(page.fallbackFocused, [true], 'fallback focuses and selects the copied text');
    const status = page.document.getElementById('copy-status').textContent;
    if (mode === 'failed') assert.match(status, /не удалось|вручную|выдел/i);
    else assert.match(status, /скопир/i);
    assert.equal(page.document.querySelectorAll('textarea').length, 0, 'temporary fallback controls are cleaned up');
  });
});

test('the five skills, shared hub value and concise setup-dependent time estimate remain clear', t => {
  const page = openPage(t);
  const skills = [...page.document.querySelectorAll('details.skill-item')];
  assert.equal(skills.length, project.skills.length);
  assert.equal(skills.length, 5);
  for (const skill of project.skills) assert.ok(skills.some(item => normalized(item.querySelector('summary').textContent).includes(normalized(skill.name))), skill.name);
  assert.ok(normalized(skills.at(-1).querySelector('summary').textContent).includes(normalized('Работа с CJHUB')));
  const text = normalized(page.document.body.textContent);
  assert.match(text, /(?:неполн[а-я]* покрыт|не покрыва[а-я]* все|не все варианты)/);
  assert.match(text, /эксперт[а-я]* провер|валидац|валидир/);
  assert.ok(text.includes('gigacode') && text.includes('mj mcp') && text.includes('onework mcp'));
  const value = normalized(page.document.getElementById('value').textContent);
  assert.match(value, /недел/);
  assert.match(value, /минут/);
  assert.ok(value.includes('оценка времени'));
  assert.ok(value.includes('ручная сборка через webui'));
  assert.match(value, /подготовлен|настро|подключен/);
  assert.equal(normalized(page.document.getElementById('value-title').textContent).replace(/\s/g, ''), normalized('Меньше ручной сборки. Больше времени на анализ.').replace(/\s/g, ''));
  assert.match(value, /храни|сохран/);
  assert.match(value, /делит|совместн|общ[а-я]* (?:хаб|хранилищ|актив)/);
  assert.match(value, /повторн|переиспольз/);
  assert.equal(page.document.querySelectorAll('.cta-note,.estimate-note,.start-action>p').length, 0);
});

test('CJXplorer is presented as a future integration and the CX team is not assigned ownership of CJHUB', t => {
  const page = openPage(t);
  const roadmap = normalized(page.document.getElementById('roadmap').textContent);
  assert.equal(normalized(page.document.getElementById('roadmap-title').textContent), normalized('Интеграция с CJXplorer'));
  assert.ok(roadmap.includes('cjxplorer'));
  assert.match(roadmap, /пилот|дальнейш|следующ|план/);
  assert.match(roadmap, /игор[а-я]* доронин/);
  assert.ok(roadmap.includes('cx'));
  assert.match(roadmap, /интегр/);
  assert.doesNotMatch(roadmap, /владелец[^.!?]{0,50}доронин|доронин[^.!?]{0,50}владелец/);
  assert.doesNotMatch(normalized(page.document.querySelector('main').textContent), /\d+\s+(?:пользовател|команд внедрен|успешных пилот)/);
});
