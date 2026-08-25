import {Buffer} from 'node:buffer';

export const AI_HTML_REPORT_SKILL_KEYS = Object.freeze([
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

function normalizedEnvironmentValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveHtmlReportApiConfig(environment = {}) {
  const baseUrl = normalizedEnvironmentValue(environment.AI_HTML_API_BASE_URL);
  const token = normalizedEnvironmentValue(environment.AI_HTML_TOKEN);

  if (!baseUrl && !token) return null;
  if (!baseUrl || !token) {
    throw new Error(
      'AI_HTML_API_BASE_URL and AI_HTML_TOKEN must be configured together',
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    token,
  };
}

export function htmlReportApiUrl(baseUrl, skillKey) {
  const normalizedBaseUrl = normalizedEnvironmentValue(baseUrl).replace(/\/+$/, '');
  if (!normalizedBaseUrl) throw new Error('AI HTML API base URL is required');
  return `${normalizedBaseUrl}/api/v1/reports/${encodeURIComponent(skillKey)}`;
}

export async function fetchHtmlReports({
  baseUrl,
  token,
  fetchImpl = globalThis.fetch,
  skillKeys = AI_HTML_REPORT_SKILL_KEYS,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('A fetch implementation is required');
  }

  return Promise.all(skillKeys.map(async (skillKey) => {
    const response = await fetchImpl(htmlReportApiUrl(baseUrl, skillKey), {
      headers: {
        Accept: 'text/html',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch AI HTML report "${skillKey}": HTTP ${response.status}`,
      );
    }
    return {skillKey, html: await response.text()};
  }));
}

export function embeddedHtmlReportTags(reports) {
  return reports.map(({skillKey, html}) => ({
    tag: 'script',
    attrs: {
      type: 'application/octet-stream',
      'data-ddi-html-page-id': skillKey,
    },
    children: Buffer.from(html, 'utf8').toString('base64'),
    injectTo: 'head-prepend',
  }));
}

export function htmlReportApiPlugin({fetchImpl, ...config}) {
  let reportsPromise;

  return {
    name: 'embed-ai-html-api-reports',
    transformIndexHtml: {
      order: 'pre',
      async handler() {
        reportsPromise ||= fetchHtmlReports({...config, fetchImpl});
        return embeddedHtmlReportTags(await reportsPromise);
      },
    },
  };
}
