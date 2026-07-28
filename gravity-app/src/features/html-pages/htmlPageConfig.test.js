import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
