export const PRODUCT_KEY_METRIC_LINKS = [
  {label: 'Воронки активности продуктов', url: 'https://navigator.sigma.sbrf.ru/gdash/12215/1000034254'},
  {label: 'Продукты-спутники', url: 'https://navigator.sigma.sbrf.ru/gdash/12215/1000030917'},
];

export const SEGMENT_KEY_METRIC_LINKS = [
  {label: 'Отчет "Активная клиентская база"', url: 'https://navigator.sigma.sbrf.ru/gdash/1000000301'},
  {label: 'Отчет "Major"', url: 'https://navigator.sigma.sbrf.ru/gdash/1000002349?type_of_view=1'},
  {label: 'Отчет "Клиенты с 1+2+"', url: 'https://navigator.sigma.sbrf.ru/gdash/1000001389'},
];

export const PHYGITAL_CHANNEL_KEY_METRIC_LINKS = [
  {label: 'Статистика обращений', url: 'https://navigator.sigma.sbrf.ru/gdash/1000000219'},
  {label: 'КПЭ по Обращениям', url: 'https://navigator.sigma.sbrf.ru/gdash/1000000111'},
  {label: 'FCR', url: 'https://navigator.sigma.sbrf.ru/gdash/1000000319'},
  {label: 'КЦ ЧАТ', url: 'https://navigator.sigma.sbrf.ru/gdash/1000001679'},
  {label: 'Phygital Channels - ключевые метрики', url: 'https://navigator.sigma.sbrf.ru/gdash/1000003084'},
];

export function keyMetricLinksForAudience(audience) {
  if (audience === 'service-channel' || audience === 'telemarketing') return PHYGITAL_CHANNEL_KEY_METRIC_LINKS;
  if (audience === 'age' || audience === 'income' || audience === 'segment') return SEGMENT_KEY_METRIC_LINKS;
  return PRODUCT_KEY_METRIC_LINKS;
}

export function isLegacyProductKeyMetricLink(item) {
  const label = String(item?.label || '').trim();
  const url = String(item?.url || '').trim();
  return /(?:продукт[ыа]-?спутник|воронки активности продуктов|ЕКМ)/i.test(label)
    || PRODUCT_KEY_METRIC_LINKS.some((link) => link.url === url);
}
