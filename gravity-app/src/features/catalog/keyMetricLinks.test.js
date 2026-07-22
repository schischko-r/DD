import assert from 'node:assert/strict';
import test from 'node:test';
import {CHAT_ENTRY_FUNNEL_LINK, PHYGITAL_CHANNEL_KEY_METRIC_LINKS, SBOL_ONBOARDING_LINK, SEGMENT_KEY_METRIC_LINKS, contextualBlockLinksForTeam, isKeyMetricLinkVisibleForTeam, isLegacyProductKeyMetricLink, isProductSatelliteLink, keyMetricLinksForTeam, reportMetricBindingForLink} from './keyMetricLinks.js';

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

test('DSZh product churn links are limited to the churn block', () => {
  const cases = [
    ['ДСЖ КК', 'https://navigator.sigma.sbrf.ru/gdash/1000000766/1000008585'],
    ['ДСЖ ПК', 'https://navigator.sigma.sbrf.ru/gdash/1000000726/1000006981'],
  ];
  cases.forEach(([name, url]) => {
    assert.deepEqual(
      contextualBlockLinksForTeam({name}, {code: 'churn'}),
      [{label: 'Воронка оттока', url}],
    );
    assert.deepEqual(contextualBlockLinksForTeam({name}, {code: 'attract'}), []);
  });
  assert.deepEqual(contextualBlockLinksForTeam({name: 'ОСАГО'}, {code: 'churn'}), []);
});

test('legacy product key metric links are recognized for phygital filtering', () => {
  assert.equal(isLegacyProductKeyMetricLink({label: 'Продукты-спутники'}), true);
  assert.equal(isLegacyProductKeyMetricLink({label: 'ЕКМ'}), true);
  assert.equal(isLegacyProductKeyMetricLink({label: 'Статистика обращений'}), false);
  assert.equal(isProductSatelliteLink({label: 'Продукты-спутники'}), true);
  assert.equal(isProductSatelliteLink({label: 'Воронки активности продуктов'}), false);
});

test('Children segment hides only the 1+2+ report link', () => {
  const children = {type: 'Сегмент', name: 'Дети'};
  const onePlusTwo = SEGMENT_KEY_METRIC_LINKS.find((item) => item.label.includes('1+2+'));
  const major = SEGMENT_KEY_METRIC_LINKS.find((item) => item.label.includes('Major'));

  assert.equal(isKeyMetricLinkVisibleForTeam(children, onePlusTwo), false);
  assert.equal(isKeyMetricLinkVisibleForTeam(children, major), true);
  assert.equal(isKeyMetricLinkVisibleForTeam({type: 'Сегмент', name: 'Молодежь'}, onePlusTwo), true);
});

test('system reports have explicit metric relevance bindings', () => {
  assert.deepEqual(
    reportMetricBindingForLink({code: 'general'}, {label: 'Воронки активности продуктов'}),
    {metricCodes: ['general.mau_produkta', 'general.mau_u_vashego_kanala']},
  );
  assert.deepEqual(
    reportMetricBindingForLink({code: 'attract'}, {label: 'Отчет "Воронки из коммуникации в продажу"'}),
    {metricCodes: ['attract.campaign_launches']},
  );
  assert.deepEqual(
    reportMetricBindingForLink({code: 'voronka_onbordinga'}, SBOL_ONBOARDING_LINK),
    {metricNames: ['Настроена отчетность']},
  );
  assert.deepEqual(
    reportMetricBindingForLink({code: 'general'}, {label: 'Phygital Channels - ключевые метрики'}),
    {requiresAnyMetric: true},
  );
  assert.deepEqual(
    reportMetricBindingForLink({code: 'cx'}, {label: 'LossHunter'}),
    {requiresAnyMetric: true},
  );
});
