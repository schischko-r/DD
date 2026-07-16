import assert from 'node:assert/strict';
import test from 'node:test';
import {CHAT_ENTRY_FUNNEL_LINK, PHYGITAL_CHANNEL_KEY_METRIC_LINKS, SBOL_ONBOARDING_LINK, contextualBlockLinksForTeam, isLegacyProductKeyMetricLink, isProductSatelliteLink, keyMetricLinksForTeam} from './keyMetricLinks.js';

test('phygital channels receive their dedicated Navigator links', () => {
  assert.deepEqual(keyMetricLinksForTeam({name: 'Чат'}, 'service-channel'), PHYGITAL_CHANNEL_KEY_METRIC_LINKS);
  assert.deepEqual(keyMetricLinksForTeam({name: 'Телемаркетинг'}, 'telemarketing'), PHYGITAL_CHANNEL_KEY_METRIC_LINKS);
  assert.deepEqual(
    PHYGITAL_CHANNEL_KEY_METRIC_LINKS.map((item) => item.url),
    [
      'https://navigator.sigma.sbrf.ru/gdash/1000000219',
      'https://navigator.sigma.sbrf.ru/gdash/1000000111',
      'https://navigator.sigma.sbrf.ru/gdash/1000000319',
      'https://navigator.sigma.sbrf.ru/gdash/1000001679',
      'https://navigator.sigma.sbrf.ru/gdash/1000003084',
    ],
  );
});

test('DP channels keep activity funnels and receive their corresponding link', () => {
  const cases = [
    ['Уведомления', 'https://navigator.sigma.sbrf.ru/gdash/1000000477/1000031866'],
    ['СберИнвестор', 'https://navigator.sigma.sbrf.ru/gdash/1000000604'],
    ['СБОЛ', 'https://navigator.sigma.sbrf.ru/gdash/1000000188'],
    ['СберKids', 'https://navigator.sigma.sbrf.ru/gdash/1000002729/1000029287?dtDate=20260531&nDynamicTypeID=3&sSet=3&tab_1=1&plat=ios&version=3.x%7C%7C%7C4.x%7C%7C%7C5.0.0%7C%7C%7C5.1.0%7C%7C%7C5.2.0%7C%7C%7C5.4.0'],
  ];
  cases.forEach(([name, url]) => {
    const links = keyMetricLinksForTeam({name, unit: 'DP'}, 'digital-channel');
    assert.equal(links[0].label, 'Воронки активности продуктов');
    assert.equal(links[1].url, url);
    assert.equal(links.some(isProductSatelliteLink), false);
  });
});

test('team-specific funnel links are limited to Chat and SBOL blocks', () => {
  assert.deepEqual(
    contextualBlockLinksForTeam({name: 'Чат'}, {code: 'voronka_vhoda_v_kanal'}),
    [CHAT_ENTRY_FUNNEL_LINK],
  );
  assert.deepEqual(
    contextualBlockLinksForTeam({name: 'СБОЛ'}, {code: 'voronka_onbordinga'}),
    [SBOL_ONBOARDING_LINK],
  );
  assert.deepEqual(contextualBlockLinksForTeam({name: 'Уведомления'}, {code: 'voronka_onbordinga'}), []);
});

test('legacy product key metric links are recognized for phygital filtering', () => {
  assert.equal(isLegacyProductKeyMetricLink({label: 'Продукты-спутники'}), true);
  assert.equal(isLegacyProductKeyMetricLink({label: 'ЕКМ'}), true);
  assert.equal(isLegacyProductKeyMetricLink({label: 'Статистика обращений'}), false);
  assert.equal(isProductSatelliteLink({label: 'Продукты-спутники'}), true);
  assert.equal(isProductSatelliteLink({label: 'Воронки активности продуктов'}), false);
});
