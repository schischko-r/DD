function readHtmlPageUrls(rawValue) {
  if (!rawValue) return {};
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([id, url]) => id && typeof url === 'string' && url.trim())
        .map(([id, url]) => [id, url.trim()]),
    );
  } catch {
    return {};
  }
}

const HTML_PAGE_URLS = readHtmlPageUrls(
  import.meta.env.VITE_HTML_PAGE_URLS,
);

const TOOL_DEFINITIONS = [
  Object.freeze({
    id: 'clickstream',
    tool: 'html_page',
    title: 'Кликстрим',
    iframeTitle: 'Кликстрим — месячный отчёт',
    skillKeys: ['clickstream_funnel'],
    skillNames: ['Воронка оформления в СБОЛ'],
    action: Object.freeze({
      metricCode: 'attract.funnel_analysis',
      subject: 'воронке оформления в СБОЛ',
    }),
    valueSources: Object.freeze({
      funnel: ['product_group', 'ai_products.0'],
    }),
    navigation: Object.freeze({
      mode: 'query',
      contextParams: Object.freeze({funnel: 'funnel'}),
      fixedParams: Object.freeze({period: 'latest', show: '1'}),
    }),
    bridge: Object.freeze({
      fields: Object.freeze([
        Object.freeze({contextKey: 'funnel', selector: '#exp-funnel', required: true}),
      ]),
      latestPeriodSelector: '#exp-period',
      showSelector: 'button[onclick="_doLoad()"]',
    }),
  }),
];

export const TOOL_CATALOG = Object.freeze(
  TOOL_DEFINITIONS
    .map((entry) => Object.freeze({...entry, url: HTML_PAGE_URLS[entry.id]}))
    .filter((entry) => entry.url),
);

export const HTML_PAGE_TOOLS = Object.freeze(
  TOOL_CATALOG.filter((entry) => entry.tool === 'html_page'),
);

function valueAtPath(source, path) {
  return String(path || '').split('.').reduce(
    (value, key) => (value == null ? undefined : value[key]),
    source,
  );
}

export function findHtmlPageToolForRecommendation(recommendation) {
  if (!recommendation) return null;
  return HTML_PAGE_TOOLS.find((tool) => (
    tool.skillKeys.includes(recommendation.skill_key)
    || tool.skillNames.includes(recommendation.skill_name)
  )) || null;
}

export function buildHtmlPageContext(tool, recommendation) {
  if (!tool) return {};
  return Object.fromEntries(
    Object.entries(tool.valueSources || {}).map(([contextKey, paths]) => {
      const value = paths
        .map((path) => valueAtPath(recommendation, path))
        .find((candidate) => candidate !== undefined && candidate !== null && candidate !== '');
      return [contextKey, value ?? ''];
    }),
  );
}

export function buildHtmlPageUrl(tool, context = {}, baseHref = window.location.href) {
  if (!tool?.url || tool.navigation?.mode !== 'query') return tool?.url || '';
  const url = new URL(tool.url, baseHref);
  for (const [contextKey, parameter] of Object.entries(tool.navigation.contextParams || {})) {
    const value = context[contextKey];
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(parameter, value);
    }
  }
  for (const [parameter, value] of Object.entries(tool.navigation.fixedParams || {})) {
    url.searchParams.set(parameter, value);
  }
  return url.href;
}
