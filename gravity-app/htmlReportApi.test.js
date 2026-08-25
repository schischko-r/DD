import assert from 'node:assert/strict';
import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {
  AI_HTML_REPORT_SKILL_KEYS,
  embeddedHtmlReportTags,
  fetchHtmlReports,
  htmlReportApiPlugin,
  htmlReportFilesPlugin,
  htmlReportApiUrl,
  readHtmlReports,
  resolveHtmlReportApiConfig,
} from './htmlReportApi.js';
import {HTML_PAGE_API_SKILL_KEYS} from './src/features/html-pages/htmlPageConfig.js';

const EXPECTED_SKILL_KEYS = [
  'csi',
  'drafts',
  'client_metrics',
  'pilots',
  'complaints',
  'digital_index',
  'funnel',
  'funnel_b2c',
  'clickstream_funnel',
];

test('build loader and browser catalog use the same nine exact skill keys', () => {
  assert.deepEqual(AI_HTML_REPORT_SKILL_KEYS, EXPECTED_SKILL_KEYS);
  assert.deepEqual(HTML_PAGE_API_SKILL_KEYS, EXPECTED_SKILL_KEYS);
  assert.equal(new Set(EXPECTED_SKILL_KEYS).size, 9);
});

test('API configuration is optional but rejects partial credentials', () => {
  assert.equal(resolveHtmlReportApiConfig({}), null);
  assert.deepEqual(resolveHtmlReportApiConfig({
    AI_HTML_API_BASE_URL: ' https://reports.example.test/root/ ',
    AI_HTML_TOKEN: ' secret-token ',
  }), {
    baseUrl: 'https://reports.example.test/root',
    token: 'secret-token',
  });
  assert.throws(
    () => resolveHtmlReportApiConfig({AI_HTML_TOKEN: 'secret-token'}),
    /must be configured together/,
  );
  assert.throws(
    () => resolveHtmlReportApiConfig({AI_HTML_API_BASE_URL: 'https://example.test'}),
    /must be configured together/,
  );
});

test('report URL appends the encoded skill key to a normalized API base', () => {
  assert.equal(
    htmlReportApiUrl('https://reports.example.test/root///', 'funnel/b2c'),
    'https://reports.example.test/root/api/v1/reports/funnel%2Fb2c',
  );
});

test('report loader uses Bearer auth for every supported report', async () => {
  const calls = [];
  const reports = await fetchHtmlReports({
    baseUrl: 'https://reports.example.test',
    token: 'test-secret',
    fetchImpl: async (url, options) => {
      calls.push({url, options});
      return {
        ok: true,
        status: 200,
        text: async () => `<html>${url}</html>`,
      };
    },
  });

  assert.deepEqual(
    reports.map(({skillKey}) => skillKey),
    AI_HTML_REPORT_SKILL_KEYS,
  );
  assert.equal(calls.length, AI_HTML_REPORT_SKILL_KEYS.length);
  calls.forEach(({url, options}, index) => {
    assert.equal(
      url,
      `https://reports.example.test/api/v1/reports/${AI_HTML_REPORT_SKILL_KEYS[index]}`,
    );
    assert.deepEqual(options.headers, {
      Accept: 'text/html',
      Authorization: 'Bearer test-secret',
    });
  });
});

test('report loader fails with a skill-specific status and never exposes the token', async () => {
  await assert.rejects(
    fetchHtmlReports({
      baseUrl: 'https://reports.example.test',
      token: 'never-print-this',
      skillKeys: ['csi'],
      fetchImpl: async () => ({ok: false, status: 503}),
    }),
    (error) => {
      assert.match(error.message, /csi/);
      assert.match(error.message, /503/);
      assert.doesNotMatch(error.message, /never-print-this/);
      return true;
    },
  );
});

test('HTML is base64-encoded in the established inert script markers', () => {
  const [tag] = embeddedHtmlReportTags([{
    skillKey: 'csi',
    html: '<!doctype html><title>CSI & клиенты</title>',
  }]);

  assert.deepEqual(tag, {
    tag: 'script',
    attrs: {
      type: 'application/octet-stream',
      'data-ddi-html-page-id': 'csi',
    },
    children: Buffer.from(
      '<!doctype html><title>CSI & клиенты</title>',
      'utf8',
    ).toString('base64'),
    injectTo: 'head-prepend',
  });
});

test('Vite plugin caches mocked fetches and keeps credentials out of emitted tags', async () => {
  const reportsDirectory = await mkdtemp(join(tmpdir(), 'ddi-html-api-'));
  let calls = 0;
  const plugin = htmlReportApiPlugin({
    baseUrl: 'https://reports.example.test',
    token: 'build-only-token',
    reportsDirectory,
    fetchImpl: async (url) => {
      calls += 1;
      const skillKey = url.split('/').at(-1);
      return {
        ok: true,
        status: 200,
        text: async () => `<html>${skillKey}</html>`,
      };
    },
  });

  try {
    const first = await plugin.transformIndexHtml.handler();
    const second = await plugin.transformIndexHtml.handler();

    assert.deepEqual(second, first);
    assert.equal(calls, AI_HTML_REPORT_SKILL_KEYS.length);
    assert.doesNotMatch(JSON.stringify(first), /build-only-token/);
    assert.deepEqual(
      (await readdir(reportsDirectory)).sort(),
      AI_HTML_REPORT_SKILL_KEYS.map((skillKey) => `${skillKey}.html`).sort(),
    );
    await Promise.all(AI_HTML_REPORT_SKILL_KEYS.map(async (skillKey) => {
      assert.equal(
        await readFile(join(reportsDirectory, `${skillKey}.html`), 'utf8'),
        `<html>${skillKey}</html>`,
      );
    }));
  } finally {
    await rm(reportsDirectory, {recursive: true, force: true});
  }
});

test('local HTML plugin embeds downloaded files without a fetch implementation', async () => {
  const reportsDirectory = await mkdtemp(join(tmpdir(), 'ddi-html-files-'));
  await writeFile(join(reportsDirectory, 'csi.html'), '<html>Local CSI</html>');

  try {
    const reports = await readHtmlReports({reportsDirectory, skillKeys: ['csi']});
    const plugin = htmlReportFilesPlugin({reportsDirectory, skillKeys: ['csi']});
    const tags = await plugin.transformIndexHtml.handler();

    assert.deepEqual(reports, [{skillKey: 'csi', html: '<html>Local CSI</html>'}]);
    assert.equal(
      Buffer.from(tags[0].children, 'base64').toString('utf8'),
      '<html>Local CSI</html>',
    );
  } finally {
    await rm(reportsDirectory, {recursive: true, force: true});
  }
});

test('local HTML loader fails clearly when a downloaded report is missing', async () => {
  const reportsDirectory = await mkdtemp(join(tmpdir(), 'ddi-html-missing-'));

  try {
    await assert.rejects(
      readHtmlReports({reportsDirectory, skillKeys: ['csi']}),
      /Downloaded AI HTML report "csi" not found/,
    );
  } finally {
    await rm(reportsDirectory, {recursive: true, force: true});
  }
});
