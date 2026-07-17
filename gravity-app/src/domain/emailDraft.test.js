import test from 'node:test';
import assert from 'node:assert/strict';
import {createReportEml} from './emailDraft.js';
import {ensureConstructorDocument, serializeReport, updateTeam} from './reportEditor.js';

function reportFixture() {
  return ensureConstructorDocument({
    products: [{
      id: 'team-1',
      name: 'Команда «Тест»',
      unit: 'Юнит',
      tribe: 'Трайб',
      type: 'Продукт',
      period: 'II кв. 2026',
      unknown: {unicode: 'данные'},
      metrics: [{
        type: 'block',
        code: 'main',
        name: 'Основное',
        metrics: [{
          code: 'main.score',
          name: 'Оценка',
          footer: 'Описание',
          value: 1,
          max_value: 2,
          is_applicabble_flg: true,
          excluded_from_index: false,
          dd_calculation_flg: 1,
          traffic_light: 'yellow',
          recommendation_items: [],
          sort: 1,
        }],
      }],
    }],
    title: {rows: []},
    ai_skill_digest: {},
    ai_skills_enabled: true,
  });
}

function decodeBase64(value) {
  return Buffer.from(value.replace(/\s/g, ''), 'base64').toString('utf8');
}

function mimeParts(content, boundary) {
  return content
    .split(`--${boundary}`)
    .slice(1, -1)
    .map((part) => part.replace(/^\r\n/, '').replace(/\r\n$/, ''));
}

function bodyOfPart(part) {
  const [, encoded = ''] = part.split('\r\n\r\n');
  return decodeBase64(encoded);
}

test('EML is an unsent Outlook draft with UTF-8 body and exact JSON attachment', () => {
  const report = reportFixture();
  const now = new Date(2026, 6, 17, 10, 5, 0);
  const boundary = '----=_DataDriven_test_boundary';
  const draft = createReportEml(report, {
    now,
    dateText: '17.07.2026, 10:05',
    changedProductCount: 1,
    boundary,
  });

  assert.equal(draft.filename, 'data-driven-report-update-2026-07-17_10-05.eml');
  assert.equal(draft.mimeType, 'message/rfc822');
  assert.equal(draft.subject, 'Data-Driven Index: обновление report-data.json');
  assert.match(draft.content, /^To: rgshishko@sberbank\.ru\r\n/m);
  assert.match(draft.content, /^X-Unsent: 1\r\n/m);
  assert.match(draft.content, /^MIME-Version: 1\.0\r\n/m);
  assert.match(draft.content, /Content-Type: multipart\/mixed/);
  assert.match(draft.content, /Content-Type: application\/json; name="report-data\.json"/);
  assert.match(draft.content, /Content-Disposition: attachment; filename="report-data\.json"/);

  const encodedSubject = draft.content.match(/^Subject: =\?UTF-8\?B\?(.+)\?=\r$/m)?.[1];
  assert.equal(decodeBase64(encodedSubject), draft.subject);
  const parts = mimeParts(draft.content, boundary);
  assert.equal(parts.length, 2);
  assert.equal(bodyOfPart(parts[0]), draft.body);
  assert.equal(bodyOfPart(parts[1]), serializeReport(report));
  assert.match(draft.body, /^Добрый день!/);
  assert.match(draft.body, /gravity-app\/public\/report-data\.json/);
  assert.match(draft.body, /Дата формирования: 17\.07\.2026, 10:05/);
  assert.match(draft.body, /Изменено команд: 1$/);

  const base64Lines = parts.flatMap((part) => (part.split('\r\n\r\n')[1] || '').split('\r\n'));
  assert.ok(base64Lines.every((line) => line.length <= 76));
});

test('EML derives changed team count from a baseline without changing recipient or subject', () => {
  const baseline = reportFixture();
  const current = updateTeam(baseline, 'team-1', {name: 'Изменённая команда'});
  const draft = createReportEml(current, {
    baselineReport: baseline,
    now: new Date(2026, 0, 2, 3, 4),
    dateText: '02.01.2026, 03:04',
    boundary: '----=_DataDriven_baseline',
  });

  assert.match(draft.body, /Изменено команд: 1$/);
  assert.match(draft.content, /^To: rgshishko@sberbank\.ru\r\n/m);
  assert.equal(draft.subject, 'Data-Driven Index: обновление report-data.json');
});

test('EML validates date and MIME boundary inputs', () => {
  const report = reportFixture();
  assert.throws(() => createReportEml(report, {now: 'not-a-date'}), /Некорректная дата/);
  assert.throws(() => createReportEml(report, {boundary: 'bad\r\nboundary'}), /MIME boundary/);
});
