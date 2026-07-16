import assert from 'node:assert/strict';
import test from 'node:test';
import {PHYGITAL_CHANNEL_KEY_METRIC_LINKS, isLegacyProductKeyMetricLink, keyMetricLinksForAudience} from './keyMetricLinks.js';

test('phygital channels receive their dedicated Navigator links', () => {
  assert.deepEqual(keyMetricLinksForAudience('service-channel'), PHYGITAL_CHANNEL_KEY_METRIC_LINKS);
  assert.deepEqual(keyMetricLinksForAudience('telemarketing'), PHYGITAL_CHANNEL_KEY_METRIC_LINKS);
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

test('legacy product key metric links are recognized for phygital filtering', () => {
  assert.equal(isLegacyProductKeyMetricLink({label: 'Продукты-спутники'}), true);
  assert.equal(isLegacyProductKeyMetricLink({label: 'ЕКМ'}), true);
  assert.equal(isLegacyProductKeyMetricLink({label: 'Статистика обращений'}), false);
});
