const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export const STATIC_LINK_DEFINITIONS = [
  {key: 'dashboard.team-contact', label: 'Напишите нам', url: 'mailto:MYCherkova@sberbank.ru?cc=yspetukhova%40sberbank.ru'},
  {key: 'team.report-error', label: 'Нашли ошибку?', url: 'https://public.oprosso.sberbank.ru/p/6yyb40xa'},
  {key: 'team.idea', label: 'Есть идея?', url: 'https://public.oprosso.sberbank.ru/p/amsp1k1c'},
  {key: 'team.report-access-request', label: 'Завести заявку на доступ', url: 'https://sberfriend.sberbank.ru/deeplink-hash-catcher/?path=L3NiZXJmcmllbmQv&callback=L2RlZXBsaW5rLWtlZXBlci8=#/application/F3C76EADA61AB8EBE053F7E9740A44EF?sberfriend.searchQuery=%D0%94%D1%80%D1%83%D0%B3%D0%B5%20%D0%BE%D1%84%D0%BE%D1%80%D0%BC%D0%B8%D1%82%D1%8C%20%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%20%D0%BA%20%D1%81%D1%82%D0%B5%D0%BD%D0%B4%D0%B0%D0%BC%20%D1%80%D0%B0%D0%B7%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%BA%D0%B8%20%D0%B8%20%D1%82%D0%B5%D1%81%D1%82%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F'},
  {key: 'team.complex-report', label: 'Перейти', url: 'http://tvlds-mvp001760.cloud.delta.sbrf.ru:8014/complex-report'},
  {key: 'team.cross-sell', label: 'Перейти', url: 'https://losshunter.ru/showcase/crosssell/#screen=pult'},
  {key: 'team.ab-course', label: 'Онлайн курс по A/B', url: 'https://hr.sberbank.ru/platform/catalog/c515dcab-a8b7-4f03-a76a-e1b7349f857d'},
  {key: 'team.ab-demo', label: 'Демо A/B-платформы', url: 'https://sbervideo.sberbank.ru/watch/kpgpJi35gzwMIVu3X51'},
];

function stableId(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `link-${(hash >>> 0).toString(36)}`;
}

export function isAllowedExternalUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function isSafeLinkPath(path) {
  return Array.isArray(path) && path.every((segment) => (
    (Number.isInteger(segment) && segment >= 0)
    || (typeof segment === 'string' && segment.length > 0 && !FORBIDDEN_PATH_SEGMENTS.has(segment))
  ));
}

export function isValidLinkScope(scope) {
  if (scope == null) return true;
  return typeof scope === 'object'
    && ['all', 'teams', 'types'].includes(scope.kind)
    && (scope.values === undefined || Array.isArray(scope.values));
}

export function isValidLinkPlacement(placement) {
  if (!placement || typeof placement !== 'object' || Array.isArray(placement)) return false;
  if (placement.kind === 'ui') return typeof placement.key === 'string' && placement.key.trim().length > 0;
  if (placement.kind !== 'report') return false;
  if (typeof placement.blockCode !== 'string' || !placement.blockCode.trim()) return false;
  if (placement.metricCode !== undefined && typeof placement.metricCode !== 'string') return false;
  if (!isSafeLinkPath(placement.path || [])) return false;
  if (placement.urlField !== undefined && !['url', 'link'].includes(placement.urlField)) return false;
  if (placement.labelField !== undefined && !['label', 'name'].includes(placement.labelField)) return false;
  return true;
}

export function normalizeLinkScope(scope, currentProductId = '') {
  if (!scope) return {kind: 'all', values: []};
  if (scope.kind) return {kind: scope.kind, values: [...(scope.values || [])]};
  if (scope.mode === 'current') return {kind: 'teams', values: [currentProductId].filter(Boolean)};
  if (scope.mode === 'teams') return {kind: 'teams', values: [...(scope.productIds || [])]};
  if (scope.mode === 'types') return {kind: 'types', values: [...(scope.types || [])]};
  return {kind: 'all', values: []};
}

export function linkScopeMatches(scope, product) {
  const normalized = normalizeLinkScope(scope);
  if (normalized.kind === 'all') return true;
  if (!product) return false;
  if (normalized.kind === 'teams') return normalized.values.includes(product.id);
  if (normalized.kind === 'types') return normalized.values.includes(product.type);
  return false;
}

function scopeRank(scope) {
  const kind = normalizeLinkScope(scope).kind;
  return kind === 'teams' ? 3 : kind === 'types' ? 2 : 1;
}

export function resolveStaticLink(rules, key, product = null, fallback = null) {
  const definition = fallback || STATIC_LINK_DEFINITIONS.find((item) => item.key === key) || null;
  const matches = (rules || [])
    .filter((rule) => rule?.placement?.kind === 'ui' && rule.placement.key === key)
    .filter((rule) => linkScopeMatches(rule.scope, product))
    .sort((left, right) => scopeRank(left.scope) - scopeRank(right.scope));
  const selected = matches.at(-1);
  if (selected?.effect === 'hide') return null;
  if (!selected) return definition;
  return {
    key,
    label: selected.label || definition?.label || key,
    url: selected.url || definition?.url || '',
  };
}

function externalLinkFromObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const urlField = isAllowedExternalUrl(value.url) ? 'url' : isAllowedExternalUrl(value.link) ? 'link' : null;
  if (!urlField) return null;
  const labelField = typeof value.label === 'string'
    ? 'label'
    : typeof value.name === 'string'
      ? 'name'
      : null;
  return {urlField, labelField, url: value[urlField], label: value[labelField] || value.button?.label || 'Ссылка'};
}

function scanLinkObjects(value, path, add) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanLinkObjects(item, [...path, index], add));
    return;
  }
  const link = externalLinkFromObject(value);
  if (link) add(path, link);
  Object.entries(value).forEach(([key, item]) => {
    if (key === 'url' || key === 'link') return;
    scanLinkObjects(item, [...path, key], add);
  });
}

export function extractReportLinkCatalog(report, productIds = null) {
  const selectedIds = productIds ? new Set(productIds) : null;
  const rules = [];
  (report?.products || []).forEach((product) => {
    if (selectedIds && !selectedIds.has(product.id)) return;
    (product.metrics || []).forEach((block) => {
      const scan = (root, metricCode = '') => scanLinkObjects(root, [], (path, link) => {
        const slot = `${block.code}|${metricCode}|${path.join('.')}`;
        rules.push({
          id: stableId(`${product.id}|${slot}`),
          origin: 'baseline',
          effect: 'upsert',
          placement: {
            kind: 'report',
            sourceProductId: product.id,
            blockCode: block.code,
            metricCode,
            path,
            urlField: link.urlField,
            labelField: link.labelField,
            slot,
          },
          scope: {kind: 'teams', values: [product.id]},
          label: link.label,
          url: link.url,
        });
      });
      const blockWithoutMetrics = {...block};
      delete blockWithoutMetrics.metrics;
      scan(blockWithoutMetrics);
      (block.metrics || []).forEach((metric) => scan(metric, metric.code));
    });
  });
  return rules;
}

export function staticLinkCatalog() {
  return STATIC_LINK_DEFINITIONS.map((item) => ({
    id: stableId(`ui|${item.key}`),
    origin: 'baseline',
    effect: 'upsert',
    placement: {kind: 'ui', key: item.key, slot: item.key},
    scope: {kind: 'all', values: []},
    label: item.label,
    url: item.url,
  }));
}

function valueAtPath(root, path) {
  if (!isSafeLinkPath(path)) return undefined;
  return path.reduce((current, segment) => {
    if (!current || typeof current !== 'object' || !Object.hasOwn(current, segment)) return undefined;
    return current[segment];
  }, root);
}

function targetRoot(product, placement) {
  const block = (product.metrics || []).find((item) => item.code === placement.blockCode);
  if (!block) return null;
  if (!placement.metricCode) return block;
  return (block.metrics || []).find((item) => item.code === placement.metricCode) || null;
}

function applyReportRule(report, rule) {
  const placement = rule.placement || {};
  if (placement.kind !== 'report') return;
  (report.products || []).forEach((product) => {
    if (!linkScopeMatches(rule.scope, product)) return;
    const root = targetRoot(product, placement);
    const target = valueAtPath(root, placement.path || []);
    if (!target || typeof target !== 'object') return;
    const urlField = placement.urlField || ('url' in target ? 'url' : 'link');
    if (!Object.hasOwn(target, urlField)) return;
    if (rule.effect === 'hide') {
      target[urlField] = '';
      return;
    }
    if (!isAllowedExternalUrl(rule.url)) return;
    target[urlField] = rule.url;
    const labelField = placement.labelField || ('label' in target ? 'label' : 'name' in target ? 'name' : null);
    if (labelField && Object.hasOwn(target, labelField) && rule.label) target[labelField] = rule.label;
  });
}

export function materializeReportLinks(report, rules = report?.constructor?.linkRules || []) {
  const overlays = (rules || []).filter((rule) => rule.origin !== 'baseline' || rule.edited);
  const reportRules = overlays.filter((rule) => rule?.placement?.kind === 'report');
  if (!reportRules.length) return report;
  const copy = structuredClone(report);
  reportRules.sort((left, right) => scopeRank(left.scope) - scopeRank(right.scope)).forEach((rule) => applyReportRule(copy, rule));
  return copy;
}

export function upsertLinkRule(rules, incoming, currentProductId = '') {
  const rule = {
    ...incoming,
    id: incoming.id || stableId(`${incoming.placement?.slot || incoming.placement?.key}|${Date.now()}|${Math.random()}`),
    origin: 'override',
    edited: true,
    effect: incoming.effect || 'upsert',
    scope: normalizeLinkScope(incoming.scope, currentProductId),
  };
  if (!isValidLinkScope(rule.scope) || !isValidLinkPlacement(rule.placement)) {
    throw new Error('Некорректная область или позиция ссылки.');
  }
  if (rule.effect !== 'hide' && (!rule.label?.trim() || !isAllowedExternalUrl(rule.url))) {
    throw new Error('Укажите название и корректную ссылку http, https или mailto');
  }
  const next = (rules || []).filter((item) => item.id !== rule.id);
  return [...next, rule];
}
