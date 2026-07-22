export function scoreFor(product, rows) {
  return rows.find((row) => row.name === product.name && row.unit === product.unit)?.score ?? 0;
}

export function groupFor(product, rows) {
  return rows.find((row) => row.name === product.name && row.unit === product.unit)?.group || '\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445';
}

export function percent(value, max) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(value) / Number(max)) * 100)));
}

export function allocateIndexUplifts(recommendations, currentScore) {
  const score = Math.max(0, Math.min(100, Number(currentScore) || 0));
  const targetTenths = Math.round((100 - score) * 10);
  const gaps = recommendations.map((item) => Math.max(0, Number(item.gap) || 0));
  const totalGap = gaps.reduce((sum, gap) => sum + gap, 0);
  if (!recommendations.length || totalGap <= 0 || targetTenths <= 0) {
    return recommendations.map((item) => ({...item, indexUplift: 0}));
  }

  const allocations = gaps.map((gap, index) => {
    const exactTenths = gap / totalGap * targetTenths;
    const tenths = Math.floor(exactTenths);
    return {index, tenths, remainder: exactTenths - tenths};
  });
  let remainingTenths = targetTenths - allocations.reduce((sum, item) => sum + item.tenths, 0);
  [...allocations]
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .forEach((item) => {
      if (remainingTenths <= 0) return;
      allocations[item.index].tenths += 1;
      remainingTenths -= 1;
    });

  return recommendations.map((item, index) => ({
    ...item,
    indexUplift: allocations[index].tenths / 10,
  }));
}

export function summarizeRecommendationUplifts(recommendations, visibleLimit = 4) {
  const limit = Math.max(0, Math.floor(Number(visibleLimit) || 0));
  const visible = recommendations.slice(0, limit);
  const hidden = recommendations.slice(limit);
  return {
    visible,
    hiddenCount: hidden.length,
    hiddenUplift: Math.round(hidden.reduce((sum, item) => sum + Number(item.indexUplift || 0), 0) * 10) / 10,
  };
}

export function blockPercent(block) {
  const metrics = block.metrics || [];
  const value = metrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);
  const max = metrics.reduce((sum, metric) => sum + Number(metric.max_value || 0), 0);
  return percent(value, max);
}

export function radarBlockPercent(block) {
  const metrics = block?.metrics || [];
  if (!metrics.some((metric) => metric.is_applicabble_flg !== false)) return null;
  return blockPercent(block);
}

export function antiTopBlockLabel(blockName) {
  return String(blockName || '').trim() === 'Цели'
    ? 'Мониторинг: Цели/Факторный анализ/Прогнозы'
    : blockName;
}

export function isTbdMetric(metric) {
  return metric?.tbd === true;
}

export function isInformationalMetric(metric) {
  return Number(metric?.dd_calculation_flg) === 0;
}

export function isDdIndexMetric(metric) {
  return metric?.is_applicabble_flg !== false
    && !metric?.excluded_from_index
    && !isInformationalMetric(metric)
    && Number(metric?.max_value || 0) > 0;
}

export function hasMetricDeviations(metrics) {
  return (metrics || []).some((metric) =>
    isDdIndexMetric(metric) && Number(metric?.value || 0) < Number(metric?.max_value || 0),
  );
}

export function inapplicableMetricLabel(metric) {
  const code = String(metric?.code || '').trim();
  const name = String(metric?.name || '').trim();
  const isAbTests = /^hyp\.ab_tests$/i.test(code)
    || /^(?:A\/B|А\/В)[-\s]?тесты$/i.test(name);
  return isAbTests ? 'Нет плана по A/B' : 'Не применимо';
}

const DIGITAL_TRACE_CROSS_SELL_PRODUCTS = new Set([
  'ОСАГО',
  'КАСКО',
  'Брокерский счет',
  'ВЗР',
  'Страхование залога',
  'ЗЛС',
  'Вклады+НС',
  'ОМС',
  'Потребительский кредит',
  'Выписки, справки',
  'Кредитные карты',
  'Платежи',
  'Переводы по РФ',
  'Дебетовая карта',
  'SberPay NFC',
  'Детская карта',
  'СберСпасибо',
]);

export function isCrossSellDigitallyConfirmed(product, block, metric) {
  const isProduct = /^продукт$/i.test(String(product?.type || '').trim());
  const isMechanics = /^mehaniki$/i.test(String(block?.code || '').trim())
    || /^механики$/i.test(String(block?.name || '').trim());
  const isCrossSell = /^mehaniki\.cross_sell$/i.test(String(metric?.code || '').trim())
    || /^cross-sell$/i.test(String(metric?.name || '').trim());
  return isProduct && isMechanics && isCrossSell
    && DIGITAL_TRACE_CROSS_SELL_PRODUCTS.has(String(product?.name || '').trim());
}

const AGE_SEGMENT_NAMES = new Set(['Молодежь', 'Дети', 'Рабочий возраст', 'Зрелость']);
const INCOME_SEGMENT_NAMES = new Set(['Top Affluent', 'PB', 'МВС']);
const DIGITAL_CHANNEL_NAMES = new Set(['СБОЛ', 'СберKids', 'СберИнвестор', 'Уведомления']);
const SERVICE_CHANNEL_NAMES = new Set(['Чат', 'Колл-центр', 'Коллцентр', 'Колл центр']);

export function teamHelpAudience(product) {
  const type = String(product?.type || '').trim().toLowerCase();
  const name = String(product?.name || '').trim();
  if (type === 'продукт' || type === 'product') return 'product';
  if (AGE_SEGMENT_NAMES.has(name)) return 'age';
  if (INCOME_SEGMENT_NAMES.has(name)) return 'income';
  if (type.includes('сегмент')) return 'segment';
  if (type.includes('канал')) {
    if (DIGITAL_CHANNEL_NAMES.has(name)) return 'digital-channel';
    if (SERVICE_CHANNEL_NAMES.has(name)) return 'service-channel';
    if (name === 'Телемаркетинг') return 'telemarketing';
    return 'channel';
  }
  return '';
}

export function filterInapplicableMetricSubgroups(metrics, groupForMetric = (metric) => metric?.metric_subgroup) {
  const groupApplicability = new Map();
  metrics.forEach((metric) => {
    const group = String(groupForMetric(metric) || '').trim();
    if (!group) return;
    groupApplicability.set(
      group,
      Boolean(groupApplicability.get(group)) || metric.is_applicabble_flg !== false,
    );
  });
  return metrics.filter((metric) => {
    const group = String(groupForMetric(metric) || '').trim();
    return !group || groupApplicability.get(group);
  });
}

export function filterInapplicableMetricGroups(blocks, aiRecommendationBlockCodes = [], isMetricVisible = () => true) {
  const preservedCodes = new Set(aiRecommendationBlockCodes);
  return blocks.filter((block) => {
    const metrics = (block.metrics || []).filter(isMetricVisible);
    return metrics.some((metric) => metric.is_applicabble_flg !== false)
      || preservedCodes.has(block.code);
  });
}

export function filterMetricsForBlock(block, metrics) {
  const blockCode = String(block?.code || '').trim().toLowerCase();
  const blockName = String(block?.name || '').trim().toLowerCase();
  const hidesInapplicable = blockCode === 'general'
    || blockCode === 'mehaniki'
    || blockName === 'знание ключевых метрик'
    || blockName === 'механики';
  return hidesInapplicable
    ? metrics.filter((metric) => metric.is_applicabble_flg !== false)
    : metrics;
}

export function isCampaigningRelevant(block) {
  const campaignMetric = (block?.metrics || []).find((metric) =>
    /^attract\.campaign_launches$/i.test(String(metric?.code || ''))
    || /^запуски кампаний за квартал$/i.test(String(metric?.name || '').trim()),
  );
  return Boolean(campaignMetric && campaignMetric.is_applicabble_flg !== false);
}

export function filterCampaigningLinks(block, links) {
  if (block?.code !== 'attract' || isCampaigningRelevant(block)) return links;
  return links.filter((item) => !/пилот|воронк.*(?:камп|коммуникац)/i.test(String(item?.label || '')));
}

export function isDraftsRelevant(block) {
  const draftsMetric = (block?.metrics || []).find((metric) =>
    /^attract\.chernoviki_v_sbol_70$/i.test(String(metric?.code || ''))
    || /^черновики в сбол/i.test(String(metric?.name || '').trim()),
  );
  return Boolean(draftsMetric && draftsMetric.is_applicabble_flg !== false);
}

export function filterDraftLinks(block, links) {
  if (block?.code !== 'attract' || isDraftsRelevant(block)) return links;
  return links.filter((item) => !/черновик/i.test(String(item?.label || '')));
}

export function isReportMetricRelevant(block, report) {
  const metricCodes = new Set((report?.metricCodes || []).map((code) => String(code).trim().toLowerCase()));
  const metricNames = new Set((report?.metricNames || []).map((name) => String(name).trim().toLowerCase()));
  const requiresAnyMetric = report?.requiresAnyMetric === true;
  if (!requiresAnyMetric && !metricCodes.size && !metricNames.size) return true;

  return (block?.metrics || []).some((metric) => {
    if (metric?.is_applicabble_flg === false) return false;
    if (requiresAnyMetric) return true;
    const code = String(metric?.code || '').trim().toLowerCase();
    const name = String(metric?.name || '').trim().toLowerCase();
    return metricCodes.has(code) || metricNames.has(name);
  });
}

export function filterMetricRelevantLinks(block, links) {
  return (links || []).filter((report) => isReportMetricRelevant(block, report));
}

export function metricDomId(code) {
  return `dd-metric-${encodeURIComponent(String(code || ''))}`;
}

export function difficultyMeta(value) {
  if (value <= 3) return {label: '\u041b\u0435\u0433\u043a\u043e', theme: 'success'};
  if (value <= 6) return {label: '\u0421\u0440\u0435\u0434\u043d\u0435', theme: 'warning'};
  return {label: '\u0421\u043b\u043e\u0436\u043d\u043e', theme: 'danger'};
}
