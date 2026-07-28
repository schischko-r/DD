function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
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
