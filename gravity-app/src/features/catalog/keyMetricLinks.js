import {resolveStaticLink} from '../../domain/linkRules.js';

const PRODUCT_ACTIVITY_FUNNELS = {
  key: 'catalog.key-metrics.product.activity-funnels',
  label: 'Воронки активности продуктов',
  url: 'https://navigator.sigma.sbrf.ru/gdash/12215/1000034254',
};
const PRODUCT_SATELLITES = {
  key: 'catalog.key-metrics.product.satellites',
  label: 'Продукты-спутники',
  url: 'https://navigator.sigma.sbrf.ru/gdash/12215/1000030917',
};
const SEGMENT_ACTIVE_CLIENT_BASE = {
  key: 'catalog.key-metrics.segment.active-client-base',
  label: 'Отчет "Активная клиентская база"',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000000301',
};
const SEGMENT_MAJOR = {
  key: 'catalog.key-metrics.segment.major',
  label: 'Отчет "Major"',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000002349?type_of_view=1',
};
const SEGMENT_CLIENTS_1_2 = {
  key: 'catalog.key-metrics.segment.clients-1-2',
  label: 'Отчет "Клиенты с 1+2+"',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000001389',
};
const PHYGITAL_APPEALS = {
  key: 'catalog.key-metrics.phygital.appeals',
  label: 'Статистика обращений',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000000219',
};
const PHYGITAL_APPEAL_KPI = {
  key: 'catalog.key-metrics.phygital.appeal-kpi',
  label: 'КПЭ по Обращениям',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000000111',
};
const PHYGITAL_FCR = {
  key: 'catalog.key-metrics.phygital.fcr',
  label: 'FCR',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000000319',
};
const PHYGITAL_CONTACT_CENTER_CHAT = {
  key: 'catalog.key-metrics.phygital.contact-center-chat',
  label: 'КЦ ЧАТ',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000001679',
};
const PHYGITAL_KEY_METRICS = {
  key: 'catalog.key-metrics.phygital.overview',
  label: 'Phygital Channels - ключевые метрики',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000003084',
};
const DP_NOTIFICATIONS = {
  key: 'catalog.key-metrics.dp.notifications',
  label: 'Уведомления',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000000477/1000031866',
};
const DP_SBER_INVESTMENTS = {
  key: 'catalog.key-metrics.dp.sber-investments',
  label: 'СберИнвестиции',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000000604',
};
const DP_SBOL = {
  key: 'catalog.key-metrics.dp.sbol',
  label: 'СБОЛ',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000000188',
};
const DP_SBER_KIDS = {
  key: 'catalog.key-metrics.dp.sber-kids',
  label: 'SberKids',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000002729/1000029287?dtDate=20260531&nDynamicTypeID=3&sSet=3&tab_1=1&plat=ios&version=3.x%7C%7C%7C4.x%7C%7C%7C5.0.0%7C%7C%7C5.1.0%7C%7C%7C5.2.0%7C%7C%7C5.4.0',
};
const CHAT_ENTRY_FUNNEL = {
  key: 'catalog.context.chat-entry-funnel',
  label: 'Вход в канал и автоматизация',
  url: 'https://navigator.sigma.sbrf.ru/gdash/1000004111/1000036478?mobile_os=All&calendar_start=2026-01-01&factor_type=ЕЛЧ%20(без%20Навыков%20Заботы)&is_limited=2&calendar_end=2026-06-30&period_name=2&switch_charts_elch=ЕЛЧ%20(с%20Welcome)%7C%7C%7CЕЛЧ%20(Без%20Welcome)&switch_top_number=6&vSearch=gta',
};
const SBOL_ONBOARDING = {
  key: 'catalog.context.sbol-onboarding',
  label: 'Воронка онбординга в СБОЛ',
  url: 'https://clickstream.sberbank.ru/frontend/sbol/reports/funnels/39101',
};

const PRODUCT_LINK_DEFINITIONS = [PRODUCT_ACTIVITY_FUNNELS, PRODUCT_SATELLITES];
const SEGMENT_LINK_DEFINITIONS = [SEGMENT_ACTIVE_CLIENT_BASE, SEGMENT_MAJOR, SEGMENT_CLIENTS_1_2];
const PHYGITAL_LINK_DEFINITIONS = [PHYGITAL_APPEALS, PHYGITAL_APPEAL_KPI, PHYGITAL_FCR, PHYGITAL_CONTACT_CENTER_CHAT, PHYGITAL_KEY_METRICS];

export const CATALOG_STATIC_LINK_DEFINITIONS = [
  ...PRODUCT_LINK_DEFINITIONS,
  ...SEGMENT_LINK_DEFINITIONS,
  ...PHYGITAL_LINK_DEFINITIONS,
  DP_NOTIFICATIONS,
  DP_SBER_INVESTMENTS,
  DP_SBOL,
  DP_SBER_KIDS,
  CHAT_ENTRY_FUNNEL,
  SBOL_ONBOARDING,
];

function withoutKey({label, url}) {
  return {label, url};
}

function resolveDefinition(definition, product, linkRules) {
  return resolveStaticLink(linkRules, definition.key, product, withoutKey(definition));
}

function resolveDefinitions(definitions, product, linkRules) {
  if (!linkRules?.length) return definitions.map(withoutKey);
  return definitions.map((definition) => resolveDefinition(definition, product, linkRules)).filter(Boolean);
}

export const PRODUCT_KEY_METRIC_LINKS = PRODUCT_LINK_DEFINITIONS.map(withoutKey);

export const SEGMENT_KEY_METRIC_LINKS = SEGMENT_LINK_DEFINITIONS.map(withoutKey);

export const PHYGITAL_CHANNEL_KEY_METRIC_LINKS = PHYGITAL_LINK_DEFINITIONS.map(withoutKey);

const DP_CHANNEL_LINKS = new Map([
  ['уведомления', DP_NOTIFICATIONS],
  ['сберинвестор', DP_SBER_INVESTMENTS],
  ['сберинвестиции', DP_SBER_INVESTMENTS],
  ['сбол', DP_SBOL],
  ['сберkids', DP_SBER_KIDS],
  ['sberkids', DP_SBER_KIDS],
]);

export const CHAT_ENTRY_FUNNEL_LINK = withoutKey(CHAT_ENTRY_FUNNEL);

export const SBOL_ONBOARDING_LINK = withoutKey(SBOL_ONBOARDING);

export function isKeyMetricStaticLink(item) {
  const label = String(item?.label || '').trim();
  const url = String(item?.url || '').trim();
  return [...PRODUCT_LINK_DEFINITIONS, ...SEGMENT_LINK_DEFINITIONS, ...PHYGITAL_LINK_DEFINITIONS, DP_NOTIFICATIONS, DP_SBER_INVESTMENTS, DP_SBOL, DP_SBER_KIDS]
    .some((definition) => definition.label === label || definition.url === url);
}

export function keyMetricLinksForTeam(product, audience, linkRules = []) {
  const unit = String(product?.unit || '').trim().toLowerCase();
  const name = String(product?.name || '').trim().toLowerCase();
  if (unit === 'dp' && audience === 'digital-channel') {
    const definitions = [PRODUCT_ACTIVITY_FUNNELS];
    const channelLink = DP_CHANNEL_LINKS.get(name);
    if (channelLink) definitions.push(channelLink);
    return resolveDefinitions(definitions, product, linkRules);
  }
  if (audience === 'service-channel' || audience === 'telemarketing') return resolveDefinitions(PHYGITAL_LINK_DEFINITIONS, product, linkRules);
  if (audience === 'age' || audience === 'income' || audience === 'segment') return resolveDefinitions(SEGMENT_LINK_DEFINITIONS, product, linkRules);
  return resolveDefinitions(PRODUCT_LINK_DEFINITIONS, product, linkRules);
}

export function contextualBlockLinksForTeam(product, block, linkRules = []) {
  const name = String(product?.name || '').trim().toLowerCase();
  const code = String(block?.code || '').trim().toLowerCase();
  const blockName = String(block?.name || '').trim().toLowerCase();
  if (name === 'чат' && (code === 'voronka_vhoda_v_kanal' || blockName === 'воронка входа в канал')) {
    const link = resolveDefinition(CHAT_ENTRY_FUNNEL, product, linkRules);
    return link ? [link] : [];
  }
  if (name === 'сбол' && (code === 'voronka_onbordinga' || blockName === 'воронка онбординга')) {
    const link = resolveDefinition(SBOL_ONBOARDING, product, linkRules);
    return link ? [link] : [];
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
