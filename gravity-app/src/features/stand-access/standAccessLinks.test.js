import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  STAND_ACCESS_ALLOW_ATTRIBUTE,
  STAND_ACCESS_HOST,
  STAND_ACCESS_INTRO,
  STAND_ACCESS_OUTRO,
  STAND_ACCESS_STEPS,
  attachStandAccessInterceptor,
  findStandAccessLink,
  isStandAccessHref,
  standAccessUrl,
} from './standAccessLinks.js';

function anchor(href, {allow = false, baseURI = 'https://ddi.example/app/'} = {}) {
  const attributes = new Map([['href', href]]);
  if (allow) attributes.set(STAND_ACCESS_ALLOW_ATTRIBUTE, '');
  const element = {
    baseURI,
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    hasAttribute: (name) => attributes.has(name),
  };
  element.closest = (selector) => (selector === 'a[href]' ? element : null);
  return element;
}

function clickEvent(target) {
  const event = {target, defaultPrevented: false, prevented: false, stopped: false};
  event.preventDefault = () => { event.prevented = true; event.defaultPrevented = true; };
  event.stopPropagation = () => { event.stopped = true; };
  return event;
}

function fakeDocument(baseURI = 'https://ddi.example/app/') {
  const listeners = [];
  return {
    baseURI,
    listeners,
    addEventListener: (type, handler, capture) => listeners.push({type, handler, capture}),
    removeEventListener: (type, handler, capture) => {
      const index = listeners.findIndex((entry) => (
        entry.type === type && entry.handler === handler && entry.capture === capture
      ));
      if (index >= 0) listeners.splice(index, 1);
    },
  };
}

test('every path on the development stand host counts as a stand link', () => {
  assert.equal(STAND_ACCESS_HOST, 'tvlds-mvp001760.cloud.delta.sbrf.ru:8014');
  for (const path of ['/', '/complex-report', '/drafts', '/funnel', '/pilots?product=BNPL']) {
    assert.ok(isStandAccessHref(`http://${STAND_ACCESS_HOST}${path}`), path);
  }
  assert.equal(
    standAccessUrl(`https://${STAND_ACCESS_HOST}/drafts`),
    `https://${STAND_ACCESS_HOST}/drafts`,
    'the scheme does not change the verdict',
  );
});

test('links outside the stand host are left alone', () => {
  assert.equal(isStandAccessHref('https://confluence.sberbank.ru/pages/viewpage.action'), false);
  assert.equal(isStandAccessHref('http://tvlds-mvp001760.cloud.delta.sbrf.ru:9000/drafts'), false);
  assert.equal(isStandAccessHref('http://tvlds-mvp001760.cloud.delta.sbrf.ru/drafts'), false);
  assert.equal(isStandAccessHref('/drafts'), false);
  assert.equal(isStandAccessHref(''), false);
  assert.equal(isStandAccessHref('not a url'), false);
});

test('a relative stand link inside an embedded page resolves against its base', () => {
  const target = anchor('/drafts', {baseURI: `http://${STAND_ACCESS_HOST}/reports/`});
  assert.equal(findStandAccessLink(target), `http://${STAND_ACCESS_HOST}/drafts`);
});

test('the dialog action that leaves for the stand opts out of interception', () => {
  const target = anchor(`http://${STAND_ACCESS_HOST}/complex-report`, {allow: true});
  assert.equal(findStandAccessLink(target), '');
});

test('clicking a stand link opens the popup instead of navigating', () => {
  const opened = [];
  const document = fakeDocument();
  attachStandAccessInterceptor(document, (href) => opened.push(href));

  const [listener] = document.listeners;
  assert.equal(listener.type, 'click');
  assert.equal(listener.capture, true, 'the capture phase wins over page handlers');

  const event = clickEvent(anchor(`http://${STAND_ACCESS_HOST}/funnel`));
  listener.handler(event);
  assert.deepEqual(opened, [`http://${STAND_ACCESS_HOST}/funnel`]);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
});

test('clicks on other links keep their default behaviour', () => {
  const opened = [];
  const document = fakeDocument();
  attachStandAccessInterceptor(document, (href) => opened.push(href));
  const [listener] = document.listeners;

  const event = clickEvent(anchor('https://cjxplorer.com/invite/b6eb223a'));
  listener.handler(event);
  assert.deepEqual(opened, []);
  assert.equal(event.prevented, false);

  const outsideAnchor = clickEvent({closest: () => null});
  listener.handler(outsideAnchor);
  assert.deepEqual(opened, []);
});

test('a report frame is instrumented once and detaches cleanly', () => {
  const document = fakeDocument();
  const detach = attachStandAccessInterceptor(document, () => {});
  assert.equal(attachStandAccessInterceptor(document, () => {}), detach);
  assert.equal(document.listeners.length, 1, 'repeated bridge attempts do not stack listeners');

  detach();
  assert.equal(document.listeners.length, 0);
  attachStandAccessInterceptor(document, () => {});
  assert.equal(document.listeners.length, 1, 'a reloaded frame can be instrumented again');
});

test('a missing frame document or handler is a no-op', () => {
  assert.doesNotThrow(() => attachStandAccessInterceptor(null, () => {})());
  assert.doesNotThrow(() => attachStandAccessInterceptor(fakeDocument(), null)());
});

test('the popup repeats the stand access instructions verbatim', () => {
  assert.equal(STAND_ACCESS_INTRO, 'Для доступа непосредственно к системе необходимо в АС Друг в поисковой строке ввести «Доступ к стендам разработки и тестирования», далее:');
  assert.deepEqual(STAND_ACCESS_STEPS, [
    'Выбрать «Открыть доступ»',
    'В поле «Выберите автоматизированную систему или ИТ услугу» указать «AI HUB B2C (CI06049712)»',
    'В обосновании — «Для разработки и тестирования инструмента AI суммаризации»',
  ]);
  assert.match(STAND_ACCESS_OUTRO, /почтовый адрес сигма и первичный пароль/);
  assert.match(STAND_ACCESS_OUTRO, /Хазипова Мария Юрьевна/);
});

test('the app and its embedded pages both route stand links to the popup', () => {
  const appSource = readFileSync(new URL('../../app/App.jsx', import.meta.url), 'utf8');
  assert.match(appSource, /attachStandAccessInterceptor\(\s*typeof document === 'undefined' \? null : document,\s*setStandAccessHref,\s*\)/);
  assert.match(appSource, /<StandAccessDialog href=\{standAccessHref\} onClose=\{\(\) => setStandAccessHref\(''\)\} \/>/);
  assert.match(appSource, /<HtmlReportPage [^>]*onStandAccessLink=\{setStandAccessHref\}/);

  const framePage = readFileSync(new URL('../../pages/HtmlReportPage.jsx', import.meta.url), 'utf8');
  assert.match(framePage, /attachStandAccessInterceptor\(frameRef\.current\?\.contentDocument, onStandAccessLink\)/);

  const dialogSource = readFileSync(new URL('./StandAccessDialog.jsx', import.meta.url), 'utf8');
  assert.match(dialogSource, /extraProps=\{\{\[STAND_ACCESS_ALLOW_ATTRIBUTE\]: ''\}\}/);

  const teamProfileSource = readFileSync(new URL('../../pages/TeamProfilePage.jsx', import.meta.url), 'utf8');
  assert.match(
    teamProfileSource,
    /href=\{COMPLEX_REPORT_URL\} target="_blank" extraProps=\{\{\[STAND_ACCESS_ALLOW_ATTRIBUTE\]: ''\}\}/,
    'the complex report dialog keeps its own exit instead of opening a second popup',
  );
});
