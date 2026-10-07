const RESEARCH_BY_METRIC = Object.freeze({
  'general.mau_produkta': ['Как нарастить MAU продукта?', 'tpl-dd1826ea30b64216'],
  'cx.score': ['Разбор клиентского пути', 'tpl-23c9e112ebf24ca5'],
  'general.obъem_celevogo_rynka_v_sbere': ['Анализ экосистемы у конкурентов', 'tpl-e0da42c952304826'],
  'general.klienty_s_produktom': ['Что говорят консалтеры по продукту?', 'tpl-29dbdea5b71b42ea'],
  'mehaniki.cross_sell': ['С кем коллабиться?', 'tpl-4836dfe789b8471c'],
  'general.obъem_celevogo_rynka_v_rossii': ['Сравнение с топ-3 конкурентов', 'tpl-cb4c86c60de241f5'],
});

export function researchActionForMetric(metric) {
  const entry = RESEARCH_BY_METRIC[String(metric?.code || '').toLowerCase()];
  if (!entry) return null;
  const [label, templateId] = entry;
  return {label, href: `https://losshunter.ru/new/research?direction=tpl:${templateId}`};
}
