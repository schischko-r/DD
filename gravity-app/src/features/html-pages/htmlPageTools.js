import {
  HTML_PAGE_API_SKILL_KEYS,
  htmlPageContentIds,
  mergeEmbeddedHtmlPageConfig,
  parseHtmlPageConfig,
  resolveHtmlPageContext,
} from './htmlPageConfig.js';

function embeddedHtmlPageIds() {
  if (typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll(
    'script[type="application/octet-stream"][data-ddi-html-page-id]',
  )).map((candidate) => candidate.dataset.ddiHtmlPageId);
}

const HTML_PAGE_CONFIG = mergeEmbeddedHtmlPageConfig(
  parseHtmlPageConfig(import.meta.env.VITE_HTML_PAGE_URLS),
  embeddedHtmlPageIds(),
);

function embeddedHtmlPageContent(id) {
  if (typeof document === 'undefined') return '';
  const contents = Array.from(document.querySelectorAll(
    'script[type="application/octet-stream"][data-ddi-html-page-id]',
  ));
  for (const contentId of htmlPageContentIds(id)) {
    const content = contents.find(
      (candidate) => candidate.dataset.ddiHtmlPageId === contentId,
    );
    if (content?.textContent?.trim()) return content.textContent.trim();
  }
  return '';
}

function clickstreamToolDefinition(id) {
  return Object.freeze({
    id,
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
      funnel: ['ai_products.0'],
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
      showSelector: '#exp-show, button[onclick="_doLoad()"]',
    }),
  });
}

const TOOL_DEFINITIONS = [
  clickstreamToolDefinition('clickstream'),
  clickstreamToolDefinition('clickstream_funnel'),
  Object.freeze({
    id: 'pilots',
    bridge: Object.freeze({
      fields: Object.freeze([
        Object.freeze({
          contextKey: 'product',
          selector: '#exp-product',
          required: true,
          groupSelector: '#exp-filter-panel input.filter-select:not([list])',
          groupPillSelector: '#exp-filter-panel .group-pill',
        }),
      ]),
      latestPeriodSelector: '#exp-month',
      autoSubmitOnChange: true,
    }),
  }),
  Object.freeze({
    id: 'funnel',
    bridge: Object.freeze({
      fields: Object.freeze([
        Object.freeze({
          contextKey: 'product',
          selector: '#exp-product',
          required: true,
          groupSelector: '#exp-filter-row input.filter-select:not([list])',
          groupPillSelector: '#exp-filter-row .group-pill',
        }),
      ]),
      latestPeriodSelector: '#exp-dt',
      showSelector: 'button[onclick="onFilterChange()"]',
    }),
  }),
  Object.freeze({
    id: 'client_metrics',
    bridge: Object.freeze({
      fields: Object.freeze([
        Object.freeze({
          contextKey: 'product',
          selector: '#exp-product',
          required: true,
          groupSelector: '#exp-filter-panel input.filter-select:not([list])',
          groupPillSelector: '#exp-filter-panel .group-pill',
        }),
      ]),
      latestPeriodSelector: '#exp-date',
      showSelector: 'button[onclick="_onDate()"]',
    }),
  }),
  Object.freeze({
    id: 'drafts',
    bridge: Object.freeze({
      fields: Object.freeze([
        Object.freeze({
          contextKey: 'product',
          selector: '#exp-product',
          required: true,
          groupSelector: '#exp-filter-panel input.filter-select:not([list])',
          groupPillSelector: '#exp-filter-panel .group-pill',
        }),
      ]),
      latestPeriodSelector: '#exp-period',
      showSelector: '#exp-show, button[onclick="_doLoad()"]',
    }),
  }),
  ...['csi', 'complaints'].map((id) => Object.freeze({
    id,
    bridge: Object.freeze({
      fields: Object.freeze([
        Object.freeze({
          contextKey: 'product',
          selector: '#exp-product',
          required: true,
          groupSelector: '#exp-filter-panel input.filter-select:not([list])',
          groupPillSelector: '#exp-filter-panel .group-pill',
        }),
      ]),
      latestPeriodSelector: '#exp-period',
      showSelector: '#exp-show, button[onclick="_doLoad()"]',
    }),
  })),
  Object.freeze({
    id: 'digital_index',
    title: 'Цифровой индекс',
    iframeTitle: 'Цифровой индекс',
  }),
  Object.freeze({
    id: 'funnel_b2c',
    title: 'Воронка B2C',
    iframeTitle: 'Воронка B2C',
  }),
];

const DEFINED_API_SKILL_KEYS = new Set(
  TOOL_DEFINITIONS.map((entry) => entry.id),
);
for (const skillKey of HTML_PAGE_API_SKILL_KEYS) {
  if (!DEFINED_API_SKILL_KEYS.has(skillKey)) {
    throw new Error(`Missing HTML page tool definition for API skill ${skillKey}`);
  }
}

const TOOL_DEFINITIONS_BY_ID = new Map(
  TOOL_DEFINITIONS.map((entry) => [entry.id, entry]),
);

export const TOOL_CATALOG = Object.freeze(
  Object.entries(HTML_PAGE_CONFIG)
    .filter(([id]) => id !== 'llm_summary')
    .map(([id, configured]) => {
      const definition = TOOL_DEFINITIONS_BY_ID.get(id) || {};
      return Object.freeze({
        id,
        tool: 'html_page',
        title: id,
        iframeTitle: configured.title || id,
        skillKeys: [id],
        skillNames: configured.title ? [configured.title] : [],
        valueSources: Object.freeze({
          product: ['ai_products.0'],
        }),
        navigation: Object.freeze({
          mode: 'query',
          contextParams: Object.freeze({product: 'product'}),
          fixedParams: Object.freeze({period: 'latest', show: '1'}),
        }),
        bridge: Object.freeze({
          fields: Object.freeze([
            Object.freeze({contextKey: 'product', selector: '#exp-product', required: true}),
          ]),
          latestPeriodSelector: '#exp-period',
          showSelector: '#exp-show, button[onclick="_doLoad()"]',
        }),
        ...definition,
        url: configured.url || '',
        get contentBase64() {
          return embeddedHtmlPageContent(id);
        },
        title: configured.title || definition.title || id,
        icon: configured.icon || 'ChartLine',
      });
    })
    .filter((entry) => entry.url || entry.contentBase64)
    .filter((entry, _index, entries) => (
      entry.id !== 'clickstream'
      || !entries.some((candidate) => candidate.id === 'clickstream_funnel')
    )),
);

export const HTML_PAGE_TOOLS = Object.freeze(
  TOOL_CATALOG.filter((entry) => entry.tool === 'html_page'),
);

export function findHtmlPageToolForRecommendation(recommendation) {
  if (!recommendation) return null;
  return HTML_PAGE_TOOLS.find((tool) => (
    tool.skillKeys?.includes(recommendation.skill_key)
    || tool.skillNames?.includes(recommendation.skill_name)
  )) || null;
}

export function buildHtmlPageContext(tool, recommendation) {
  return resolveHtmlPageContext(tool, recommendation);
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
