import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  CAMPAIGNING_TEAM,
  campaigningLinksForBlock,
  linkLabelForUrl,
  shortenNavigatorUrl,
} from './campaigningLinks.js';
import {linksForBlock} from './blockLinks.js';

const report = JSON.parse(readFileSync(new URL('../../../public/report-data.json', import.meta.url), 'utf8'));
const team = report.products.find((product) => product.name === CAMPAIGNING_TEAM);

test('a Navigator link keeps only its dashboard id', () => {
  assert.equal(
    shortenNavigatorUrl('https://navigator.sigma.sbrf.ru/gdash/1000004779/1000041234'),
    'https://navigator.sigma.sbrf.ru/gdash/1000004779',
  );
  assert.equal(
    shortenNavigatorUrl('https://navigator.sigma.sbrf.ru/gdash/1000003023?period=2026-06-01'),
    'https://navigator.sigma.sbrf.ru/gdash/1000003023',
  );
  assert.equal(
    shortenNavigatorUrl('https://navigator.sigma.sbrf.ru/gdash/1000003023'),
    'https://navigator.sigma.sbrf.ru/gdash/1000003023',
  );
  const qlik = 'https://qlik.sigma.sbrf.ru/qs_b2c_data/scim_sigma/sense/app/9d8c38da/sheet/aa70d1a2/state/analysis';
  assert.equal(shortenNavigatorUrl(qlik), qlik, 'only Navigator has a trimmable tail');
});

test('a link is named by where it leads, not by the metric that cited it', () => {
  assert.equal(linkLabelForUrl('https://navigator.sigma.sbrf.ru/gdash/1000003023'), 'Дашборд в Навигаторе');
  assert.equal(linkLabelForUrl('https://qlik.sigma.sbrf.ru/qs_b2c_data/x'), 'Дашборд в Qlik');
  assert.equal(linkLabelForUrl('https://jira.sberbank.ru/secure/RapidBoard.jspa'), 'Доска в Jira');
  assert.equal(linkLabelForUrl('https://confluence.sberbank.ru/pages/viewpage.action'), 'Страница в Confluence');
});

test('metrics sharing a dashboard collapse into one link, named by its subject', () => {
  // The workbook cites gdash/1000003023 for Доп. NPV, OR, CTR and CR кампейнинга.
  const links = campaigningLinksForBlock({name: CAMPAIGNING_TEAM}, {code: 'general'});
  assert.deepEqual(links, [
    {label: 'Ключевые метрики', url: 'https://navigator.sigma.sbrf.ru/gdash/1000003023'},
    {label: 'CLTV', url: 'https://navigator.sigma.sbrf.ru/gdash/1000002443'},
  ]);

  assert.deepEqual(
    campaigningLinksForBlock({name: CAMPAIGNING_TEAM}, {code: 'rezulьtativnostь'}),
    [
      {label: 'Ключевые метрики', url: 'https://navigator.sigma.sbrf.ru/gdash/1000003023'},
      {label: 'Драйверы метрик', url: 'https://navigator.sigma.sbrf.ru/gdash/1000004779'},
    ],
  );

  const unnamed = campaigningLinksForBlock({name: CAMPAIGNING_TEAM}, {code: 'analiz_effektivnostь'});
  assert.deepEqual(unnamed.map((link) => link.label), ['Дашборд в Навигаторе', 'Дашборд в Qlik'],
    'a board without its own name falls back to where it leads');
});

test('the goals block keeps only the report it already had', () => {
  assert.deepEqual(campaigningLinksForBlock({name: CAMPAIGNING_TEAM}, {code: 'goals'}), []);
});

test('only the campaigning team gets them', () => {
  assert.deepEqual(campaigningLinksForBlock({name: 'Вклады+НС'}, {code: 'general'}), []);
  assert.deepEqual(campaigningLinksForBlock({name: CAMPAIGNING_TEAM}, {code: 'cx'}), []);
});

test('the team card shows one link per dashboard in "Где посмотреть"', () => {
  assert.ok(team, 'the campaigning team is in the report');
  for (const block of team.metrics) {
    const links = linksForBlock(block, team.metrics, team);
    const urls = links.map((link) => link.url);
    assert.equal(new Set(urls).size, urls.length, `${block.name}: the same address is listed twice`);
    for (const link of links) {
      assert.doesNotMatch(
        link.label,
        /^(?:OR|CTR|CR кампейнинга|Доп\. NPV|∆CLTV)/,
        `${block.name}: a link is still named after a metric`,
      );
    }
  }
});
