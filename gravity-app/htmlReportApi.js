import {Buffer} from 'node:buffer';
import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

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

const DEFAULT_FETCH_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_SERVER_ERROR_LENGTH = 500;

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function redactedMessage(value, token) {
  const normalized = typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : '';
  if (!normalized) return '';
  const redacted = token ? normalized.split(token).join('[redacted]') : normalized;
  return redacted.slice(0, MAX_SERVER_ERROR_LENGTH);
}

async function responseErrorDetail(response, token) {
  if (typeof response?.text !== 'function') return '';
  try {
    const body = await response.text();
    const parsed = JSON.parse(body);
    return redactedMessage(parsed?.error, token);
  } catch {
    return '';
  }
}

function failedReportMessage(skillKey, status, detail = '') {
  const suffix = detail ? `: ${detail}` : '';
  return `Failed to fetch AI HTML report "${skillKey}": HTTP ${status}${suffix}`;
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
  maxAttempts = DEFAULT_FETCH_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  sleepImpl = wait,
  onReport,
  retainReports = true,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('A fetch implementation is required');
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError('maxAttempts must be a positive integer');
  }
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
    throw new TypeError('retryDelayMs must be a non-negative number');
  }
  if (typeof sleepImpl !== 'function') {
    throw new TypeError('sleepImpl must be a function');
  }
  if (onReport !== undefined && typeof onReport !== 'function') {
    throw new TypeError('onReport must be a function');
  }

  const reports = [];
  for (const skillKey of skillKeys) {
    const url = htmlReportApiUrl(baseUrl, skillKey);
    let report;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(url, {
          headers: {
            Accept: 'text/html',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        if (attempt < maxAttempts) {
          await sleepImpl(retryDelayMs * attempt);
          continue;
        }
        const detail = redactedMessage(error?.message, token);
        const suffix = detail ? `: ${detail}` : '';
        throw new Error(
          `Failed to fetch AI HTML report "${skillKey}" after ${maxAttempts} attempts${suffix}`,
          {cause: error},
        );
      }

      if (!response.ok) {
        const detail = await responseErrorDetail(response, token);
        const retryable = response.status >= 500 && response.status <= 599;
        if (retryable && attempt < maxAttempts) {
          await sleepImpl(retryDelayMs * attempt);
          continue;
        }
        throw new Error(failedReportMessage(skillKey, response.status, detail));
      }

      try {
        report = {skillKey, html: await response.text()};
        break;
      } catch (error) {
        if (attempt < maxAttempts) {
          await sleepImpl(retryDelayMs * attempt);
          continue;
        }
        const detail = redactedMessage(error?.message, token);
        const suffix = detail ? `: ${detail}` : '';
        throw new Error(
          `Failed to read AI HTML report "${skillKey}" after ${maxAttempts} attempts${suffix}`,
          {cause: error},
        );
      }
    }

    if (onReport) await onReport(report);
    if (retainReports) reports.push(report);
  }
  return reports;
}

export async function downloadHtmlReports({reportsDirectory, ...config}) {
  await mkdir(reportsDirectory, {recursive: true});
  await fetchHtmlReports({
    ...config,
    retainReports: false,
    async onReport({skillKey, html}) {
      await writeFile(resolve(reportsDirectory, `${skillKey}.html`), html, 'utf8');
    },
  });
}

export async function readHtmlReports({
  reportsDirectory,
  skillKeys = AI_HTML_REPORT_SKILL_KEYS,
}) {
  return Promise.all(skillKeys.map(async (skillKey) => {
    const filePath = resolve(reportsDirectory, `${skillKey}.html`);
    try {
      return {skillKey, html: await readFile(filePath, 'utf8')};
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error(
          `Downloaded AI HTML report "${skillKey}" not found: ${filePath}`,
        );
      }
      throw error;
    }
  }));
}

export async function writeHtmlReports(reports, reportsDirectory) {
  await mkdir(reportsDirectory, {recursive: true});
  await Promise.all(reports.map(({skillKey, html}) => (
    writeFile(resolve(reportsDirectory, `${skillKey}.html`), html, 'utf8')
  )));
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

export function htmlReportManifestTag(
  skillKeys = AI_HTML_REPORT_SKILL_KEYS,
) {
  const manifest = Object.fromEntries(
    skillKeys.map((skillKey) => [skillKey, `${skillKey}.html`]),
  );
  return {
    tag: 'script',
    attrs: {
      id: 'ddi-html-page-manifest',
      type: 'application/json',
    },
    children: JSON.stringify(manifest),
    injectTo: 'head-prepend',
  };
}

export async function verifyHtmlReportFiles({
  reportsDirectory,
  skillKeys = AI_HTML_REPORT_SKILL_KEYS,
}) {
  for (const skillKey of skillKeys) {
    const filePath = resolve(reportsDirectory, `${skillKey}.html`);
    try {
      await access(filePath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error(
          `Downloaded AI HTML report "${skillKey}" not found: ${filePath}`,
        );
      }
      throw error;
    }
  }
}

export function htmlReportApiPlugin({fetchImpl, reportsDirectory, ...config}) {
  let tagsPromise;

  return {
    name: 'embed-ai-html-api-reports',
    transformIndexHtml: {
      order: 'pre',
      async handler() {
        tagsPromise ||= reportsDirectory
          ? downloadHtmlReports({
            ...config,
            fetchImpl,
            reportsDirectory,
          }).then(() => [htmlReportManifestTag(config.skillKeys)])
          : fetchHtmlReports({...config, fetchImpl}).then(embeddedHtmlReportTags);
        return tagsPromise;
      },
    },
  };
}

export function htmlReportFilesPlugin(config) {
  let tagsPromise;

  return {
    name: 'embed-downloaded-ai-html-reports',
    transformIndexHtml: {
      order: 'pre',
      async handler() {
        tagsPromise ||= verifyHtmlReportFiles(config)
          .then(() => [htmlReportManifestTag(config.skillKeys)]);
        return tagsPromise;
      },
    },
  };
}
