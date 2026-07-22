import assert from 'node:assert/strict';
import test from 'node:test';
import {collectBlockLinks, linksForBlock} from './blockLinks.js';

const action = (label) => ({label, url: `https://example.test/${encodeURIComponent(label)}`});

test('bottom report links follow their linked metric applicability', () => {
  const block = {
    code: 'attract',
    actions: [
      action('Отчет "Пилотные кампании"'),
      action('Отчет "Воронки из коммуникации в продажу"'),
    ],
    metrics: [{code: 'attract.campaign_launches', is_applicabble_flg: false}],
  };

  assert.deepEqual(linksForBlock(block).map((item) => item.label), []);
  block.metrics[0].is_applicabble_flg = true;
  assert.deepEqual(
    linksForBlock(block).map((item) => item.label),
    ['Отчет "Пилотные кампании"', 'Отчет "Воронки из коммуникации в продажу"'],
  );
});

test('metric buttons inherit their own metric applicability', () => {
  const block = {
    code: 'custom',
    metrics: [{
      code: 'custom.report',
      is_applicabble_flg: false,
      button: {label: 'Отчет', link: 'https://example.test/report'},
    }],
  };

  assert.deepEqual(collectBlockLinks(block)[0].metricCodes, ['custom.report']);
  assert.deepEqual(linksForBlock(block), []);
});

test('specialized funnel reports follow the reporting metric', () => {
  const block = {
    code: 'voronka_onbordinga',
    name: 'Воронка онбординга',
    metrics: [{name: 'Настроена отчетность', is_applicabble_flg: false}],
  };
  const product = {name: 'СБОЛ', type: 'Канал', unit: 'DP'};

  assert.deepEqual(linksForBlock(block, [block], product), []);
  block.metrics[0].is_applicabble_flg = true;
  assert.deepEqual(linksForBlock(block, [block], product).map((item) => item.label), ['Воронка онбординга в СБОЛ']);
});
