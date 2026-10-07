import assert from 'node:assert/strict';
import test from 'node:test';
import {researchActionForMetric} from './teamProfileResearchLinks.js';

test('research links follow the six matching team metrics', () => {
  const cases = [
    ['general.mau_produkta', 'Как нарастить MAU продукта?', 'tpl-dd1826ea30b64216'],
    ['cx.score', 'Разбор клиентского пути', 'tpl-23c9e112ebf24ca5'],
    ['general.obъem_celevogo_rynka_v_sbere', 'Анализ экосистемы у конкурентов', 'tpl-e0da42c952304826'],
    ['general.klienty_s_produktom', 'Что говорят консалтеры по продукту?', 'tpl-29dbdea5b71b42ea'],
    ['mehaniki.cross_sell', 'С кем коллабиться?', 'tpl-4836dfe789b8471c'],
    ['general.obъem_celevogo_rynka_v_rossii', 'Сравнение с топ-3 конкурентов', 'tpl-cb4c86c60de241f5'],
  ];

  for (const [code, label, templateId] of cases) {
    assert.deepEqual(researchActionForMetric({code}), {
      label,
      href: `https://losshunter.ru/new/research?direction=tpl:${templateId}`,
    });
  }
  assert.equal(researchActionForMetric({code: 'general.dau_produkta'}), null);
  assert.equal(researchActionForMetric(null), null);
});
