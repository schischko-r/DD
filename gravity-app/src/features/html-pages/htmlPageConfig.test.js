import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HTML_PAGE_API_SKILL_KEYS,
  adjacentHtmlPagePath,
  htmlPageContentIds,
  mergeEmbeddedHtmlPageConfig,
  parseHtmlPageConfig,
  resolveHtmlPageContext,
} from './htmlPageConfig.js';

test('HTML page config exposes every API-supported skill key', () => {
  assert.deepEqual(HTML_PAGE_API_SKILL_KEYS, [
    'csi',
    'drafts',
    'client_metrics',
    'pilots',
    'complaints',
    'funnel',
    'clickstream_funnel',
  ]);
});

test('legacy Clickstream config can consume canonical API embedded content', () => {
  assert.deepEqual(
    htmlPageContentIds('clickstream'),
    ['clickstream_funnel', 'clickstream'],
  );
  assert.deepEqual(htmlPageContentIds('clickstream_funnel'), ['clickstream_funnel']);
  assert.deepEqual(htmlPageContentIds(''), []);
});

test('embedded API pages extend local config without replacing its fallback metadata', () => {
  const localClickstream = {
    url: './clickstream.html',
    title: 'Локальный кликстрим',
    icon: 'ChartLine',
  };
  assert.deepEqual(
    mergeEmbeddedHtmlPageConfig(
      {clickstream: localClickstream},
      ['clickstream_funnel', 'unknown'],
    ),
    {
      clickstream: localClickstream,
      clickstream_funnel: localClickstream,
    },
  );
});

test('HTML page env accepts metadata objects and legacy URL strings', () => {
  assert.deepEqual(
    parseHtmlPageConfig(JSON.stringify({
      clickstream: {
        url: './clickstream.html',
        title: 'Анализ воронок',
        icon: 'ChartLine',
      },
      legacy: './legacy.html',
      empty: {url: '', title: 'Пустой навык', icon: 'Sparkles'},
    })),
    {
      clickstream: {
        url: './clickstream.html',
        title: 'Анализ воронок',
        icon: 'ChartLine',
      },
      legacy: {url: './legacy.html', title: '', icon: ''},
      empty: {url: '', title: 'Пустой навык', icon: 'Sparkles'},
    },
  );
});

test('adjacent HTML pages accept both bare filenames and dot-slash paths', () => {
  assert.equal(
    adjacentHtmlPagePath('Клиентские_метрики_все_продукты.html'),
    'Клиентские_метрики_все_продукты.html',
  );
  assert.equal(
    adjacentHtmlPagePath('./Клиентские_метрики_все_продукты.html'),
    'Клиентские_метрики_все_продукты.html',
  );
  for (const unsupported of [
    '../report.html',
    'reports/report.html',
    '/report.html',
    'https://example.com/report.html',
    'report.txt',
  ]) {
    assert.equal(adjacentHtmlPagePath(unsupported), '');
  }
});

test('HTML page context resolver takes the funnel directly from recommendation metadata', () => {
  const tool = {
    valueSources: {funnel: ['ai_products.0']},
  };

  assert.deepEqual(
    resolveHtmlPageContext(tool, {
      product_group: 'Не использовать это производное поле',
      ai_products: ['Воронка. Открытие рублевых вкладов.'],
    }),
    {funnel: 'Воронка. Открытие рублевых вкладов.'},
  );
});

test('generic HTML page context passes the mapped AI product to a product filter', () => {
  assert.deepEqual(
    resolveHtmlPageContext(
      {valueSources: {product: ['ai_products.0']}},
      {
        ai_products: ['Пилоты. Вклады'],
        product_group: 'Не использовать это производное поле',
      },
    ),
    {product: 'Пилоты. Вклады'},
  );
});
