import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjacentHtmlPagePath,
  parseHtmlPageConfig,
  resolveHtmlPageContext,
} from './htmlPageConfig.js';

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

test('HTML page context resolver takes the funnel directly from ai_product_mapping output', () => {
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
