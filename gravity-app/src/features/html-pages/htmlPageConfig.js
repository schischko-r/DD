function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export const HTML_PAGE_API_SKILL_KEYS = Object.freeze([
  'csi',
  'drafts',
  'client_metrics',
  'pilots',
  'complaints',
  'digital_index',
  'funnel',
  'funnel_b2c',
  'clickstream_funnel',
]);

const HTML_PAGE_CONTENT_ID_ALIASES = Object.freeze({
  clickstream: 'clickstream_funnel',
});

const HTML_PAGE_CONFIG_FALLBACK_IDS = Object.freeze({
  clickstream_funnel: 'clickstream',
});

export function htmlPageContentIds(id) {
  const normalizedId = normalizeText(id);
  if (!normalizedId) return [];
  const canonicalId = HTML_PAGE_CONTENT_ID_ALIASES[normalizedId] || normalizedId;
  return canonicalId === normalizedId
    ? [canonicalId]
    : [canonicalId, normalizedId];
}

export function mergeEmbeddedHtmlPageConfig(config, embeddedIds = []) {
  const merged = {...config};
  const availableIds = new Set(embeddedIds);
  for (const skillKey of HTML_PAGE_API_SKILL_KEYS) {
    if (availableIds.has(skillKey) && !merged[skillKey]) {
      const fallbackId = HTML_PAGE_CONFIG_FALLBACK_IDS[skillKey];
      merged[skillKey] = fallbackId && merged[fallbackId]
        ? {...merged[fallbackId]}
        : {url: '', title: '', icon: ''};
    }
  }
  return merged;
}

function normalizeHtmlPageEntry(value) {
  if (typeof value === 'string') {
    return {url: value.trim(), title: '', icon: ''};
  }
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  return {
    url: normalizeText(value.url),
    title: normalizeText(value.title),
    icon: normalizeText(value.icon),
  };
}

export function adjacentHtmlPagePath(value) {
  const configuredUrl = normalizeText(value);
  if (!configuredUrl) return '';
  const relativePath = configuredUrl.startsWith('./')
    ? configuredUrl.slice(2)
    : configuredUrl;
  if (
    !relativePath
    || relativePath.includes('/')
    || relativePath.includes('\\')
    || !relativePath.toLowerCase().endsWith('.html')
  ) {
    return '';
  }
  return relativePath;
}

export function parseHtmlPageConfig(rawValue, {strict = false} = {}) {
  if (!rawValue) return {};
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new TypeError('expected a JSON object');
    }
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([id]) => id)
        .map(([id, value]) => [id, normalizeHtmlPageEntry(value)])
        .filter(([, value]) => value),
    );
  } catch (error) {
    if (strict) {
      throw new Error(`VITE_HTML_PAGE_URLS must be a JSON object: ${error.message}`);
    }
    return {};
  }
}

function valueAtPath(source, path) {
  return String(path || '').split('.').reduce(
    (value, key) => (value == null ? undefined : value[key]),
    source,
  );
}

export function resolveHtmlPageContext(tool, recommendation) {
  if (!tool) return {};
  return Object.fromEntries(
    Object.entries(tool.valueSources || {}).map(([contextKey, paths]) => {
      const value = paths
        .map((path) => valueAtPath(recommendation, path))
        .find((candidate) => candidate !== undefined && candidate !== null && candidate !== '');
      const resolvedValue = tool.valueResolvers?.[contextKey]?.(value) ?? value;
      return [contextKey, resolvedValue ?? ''];
    }),
  );
}
