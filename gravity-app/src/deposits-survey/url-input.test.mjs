import assert from 'node:assert/strict';
import test from 'node:test';
import {hasHttpLinks, toHttpUrl} from './metric-source.js';
import {hasBacklogLinks} from './previous-backlogs.js';

test('domain links accept no scheme and opening uses an absolute URL', () => {
  for (const link of ['example.ru/report', 'www.example.com/a?b=c#d', 'example.org', 'пример.рф/отчет', 'example.com:8080/report', 'https://example.test/report', 'http://example.test/report']) {
    assert.equal(hasHttpLinks(link), true, link);
    assert.match(toHttpUrl(link), /^https?:\/\//);
  }
  assert.equal(hasHttpLinks(' example.ru/a \n\nhttps://example.com/b\n'), true);
  for (const link of ['text', 'user@example.com', 'javascript:alert(1)', 'ftp://example.com', 'https://', 'https://localhost', 'https://bad domain.ru', 'https://-domain.com']) assert.equal(hasHttpLinks(link), false, link);
});

test('backlog accepts scheme-less links only on approved Jira and SberTrack hosts', () => {
  assert.equal(hasBacklogLinks('jira.sberbank.ru/browse/DA-1\nsbertrack.sberbank.ru/DA-2'), true);
  for (const link of ['example.ru/backlog', 'confluence.sberbank.ru/backlog', 'jira.sberbank.ru.example.com/backlog', 'user@jira.sberbank.ru/browse/DA-1']) assert.equal(hasBacklogLinks(link), false, link);
});
