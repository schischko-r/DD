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

const DP_CHANNEL_LINKS = new Map([
  ['уведомления', {label: 'Уведомления', url: 'https://navigator.sigma.sbrf.ru/gdash/1000000477/1000031866'}],
  ['сберинвестор', {label: 'СберИнвестиции', url: 'https://navigator.sigma.sbrf.ru/gdash/1000000604'}],
  ['сберинвестиции', {label: 'СберИнвестиции', url: 'https://navigator.sigma.sbrf.ru/gdash/1000000604'}],
  ['сбол', {label: 'СБОЛ', url: 'https://navigator.sigma.sbrf.ru/gdash/1000000188'}],
  ['сберkids', {label: 'SberKids', url: 'https://navigator.sigma.sbrf.ru/gdash/1000002729/1000029287?dtDate=20260531&nDynamicTypeID=3&sSet=3&tab_1=1&plat=ios&version=3.x%7C%7C%7C4.x%7C%7C%7C5.0.0%7C%7C%7C5.1.0%7C%7C%7C5.2.0%7C%7C%7C5.4.0'}],
  ['sberkids', {label: 'SberKids', url: 'https://navigator.sigma.sbrf.ru/gdash/1000002729/1000029287?dtDate=20260531&nDynamicTypeID=3&sSet=3&tab_1=1&plat=ios&version=3.x%7C%7C%7C4.x%7C%7C%7C5.0.0%7C%7C%7C5.1.0%7C%7C%7C5.2.0%7C%7C%7C5.4.0'}],
]);

export const CHAT_ENTRY_FUNNEL_LINK = {
  label: 'Вход в канал и автоматизация',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000004111/1000036478?mobile_os=All&calendar_start=2026-01-01&factor_type=ЕЛЧ%20(без%20Навыков%20Заботы)&is_limited=2&calendar_end=2026-06-30&period_name=2&switch_charts_elch=ЕЛЧ%20(с%20Welcome)%7C%7C%7CЕЛЧ%20(Без%20Welcome)&switch_top_number=6&vSearch=gta',
};

export const SBOL_ONBOARDING_LINK = {
  label: 'Воронка онбординга в СБОЛ',
  url: 'https://clickstream.sberbank.ru/frontend/sbol/reports/funnels/39101',
};

const PRODUCT_CHURN_LINKS = new Map([
  ['дсж кк', {label: 'Воронка оттока', url: 'https://navigator.sigma.sbrf.ru/gdash/1000000766/1000008585'}],
  ['дсж пк', {label: 'Воронка оттока', url: 'https://navigator.sigma.sbrf.ru/gdash/1000000726/1000006981'}],
]);

export function keyMetricLinksForTeam(product, audience) {
  const unit = String(product?.unit || '').trim().toLowerCase();
  const name = String(product?.name || '').trim().toLowerCase();
  if (unit === 'dp' && audience === 'digital-channel') {
    const channelLink = DP_CHANNEL_LINKS.get(name);
    return channelLink ? [PRODUCT_KEY_METRIC_LINKS[0], channelLink] : [PRODUCT_KEY_METRIC_LINKS[0]];
  }
  if (audience === 'service-channel' || audience === 'telemarketing') return PHYGITAL_CHANNEL_KEY_METRIC_LINKS;
  if (audience === 'age' || audience === 'income' || audience === 'segment') return SEGMENT_KEY_METRIC_LINKS;
  return PRODUCT_KEY_METRIC_LINKS;
}

export function contextualBlockLinksForTeam(product, block) {
  const name = String(product?.name || '').trim().toLowerCase();
  const code = String(block?.code || '').trim().toLowerCase();
  const blockName = String(block?.name || '').trim().toLowerCase();
  if (name === 'чат' && (code === 'voronka_vhoda_v_kanal' || blockName === 'воронка входа в канал')) return [CHAT_ENTRY_FUNNEL_LINK];
  if (name === 'сбол' && (code === 'voronka_onbordinga' || blockName === 'воронка онбординга')) return [SBOL_ONBOARDING_LINK];
  if (code === 'churn' || blockName === 'воронка оттока') {
    const churnLink = PRODUCT_CHURN_LINKS.get(name);
    if (churnLink) return [churnLink];
  }
  return [];
}

export function isProductSatelliteLink(item) {
  const label = String(item?.label || '').trim();
  const url = String(item?.url || '').trim();
  return /продукт[ыа]-?спутник/i.test(label) || PRODUCT_KEY_METRIC_LINKS[1].url === url;
}

export function isLegacyProductKeyMetricLink(item) {
  const label = String(item?.label || '').trim();
  const url = String(item?.url || '').trim();
  return /(?:продукт[ыа]-?спутник|воронки активности продуктов|ЕКМ)/i.test(label)
    || PRODUCT_KEY_METRIC_LINKS.some((link) => link.url === url);
}
