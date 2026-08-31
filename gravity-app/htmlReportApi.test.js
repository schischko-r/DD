import assert from 'node:assert/strict';
import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {
  AI_HTML_REPORT_SKILL_KEYS,
  downloadHtmlReports,
  embeddedHtmlReportTags,
  fetchHtmlReports,
  htmlReportApiPlugin,
  htmlReportFilesPlugin,
  htmlReportApiUrl,
  htmlReportManifestTag,
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

test('report loader fetches reports sequentially', async () => {
  let activeRequests = 0;
  let maximumActiveRequests = 0;

  const reports = await fetchHtmlReports({
    baseUrl: 'https://reports.example.test',
    token: 'test-secret',
    skillKeys: ['csi', 'drafts', 'pilots'],
    fetchImpl: async (url) => {
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      return {
        ok: true,
        status: 200,
        text: async () => {
          await new Promise((resolvePromise) => setImmediate(resolvePromise));
          activeRequests -= 1;
          return `<html>${url}</html>`;
        },
      };
    },
  });

  assert.equal(maximumActiveRequests, 1);
  assert.deepEqual(reports.map(({skillKey}) => skillKey), ['csi', 'drafts', 'pilots']);
});

test('disk downloader writes each report before requesting the next one', async () => {
  const reportsDirectory = await mkdtemp(join(tmpdir(), 'ddi-html-download-'));
  const skillKeys = ['csi', 'drafts'];
  let calls = 0;

  try {
    await downloadHtmlReports({
      baseUrl: 'https://reports.example.test',
      token: 'test-secret',
      reportsDirectory,
      skillKeys,
      fetchImpl: async (url) => {
        if (calls === 1) {
          assert.equal(
            await readFile(join(reportsDirectory, 'csi.html'), 'utf8'),
            '<html>csi</html>',
          );
        }
        calls += 1;
        const skillKey = url.split('/').at(-1);
        return {
          ok: true,
          status: 200,
          text: async () => `<html>${skillKey}</html>`,
        };
      },
    });

    assert.equal(calls, 2);
    assert.equal(
      await readFile(join(reportsDirectory, 'drafts.html'), 'utf8'),
      '<html>drafts</html>',
    );
  } finally {
    await rm(reportsDirectory, {recursive: true, force: true});
  }
});

test('report loader retries HTTP 5xx and temporary network failures', async () => {
  const calls = [];
  const delays = [];
  const reports = await fetchHtmlReports({
    baseUrl: 'https://reports.example.test',
    token: 'test-secret',
    skillKeys: ['csi'],
    retryDelayMs: 25,
    sleepImpl: async (milliseconds) => delays.push(milliseconds),
    fetchImpl: async () => {
      calls.push(calls.length + 1);
      if (calls.length === 1) throw new TypeError('temporary socket failure');
      if (calls.length === 2) {
        return {
          ok: false,
          status: 500,
          text: async () => JSON.stringify({error: 'temporary render failure'}),
        };
      }
      return {ok: true, status: 200, text: async () => '<html>CSI</html>'};
    },
  });

  assert.equal(calls.length, 3);
  assert.deepEqual(delays, [25, 50]);
  assert.deepEqual(reports, [{skillKey: 'csi', html: '<html>CSI</html>'}]);
});

test('report loader does not retry HTTP 401 or 404', async () => {
  for (const [status, detail] of [
    [401, 'invalid external key'],
    [404, 'unsupported skill key'],
  ]) {
    let calls = 0;
    await assert.rejects(
      fetchHtmlReports({
        baseUrl: 'https://reports.example.test',
        token: 'test-secret',
        skillKeys: ['csi'],
        sleepImpl: async () => assert.fail('sleep must not be called'),
        fetchImpl: async () => {
          calls += 1;
          return {
            ok: false,
            status,
            text: async () => JSON.stringify({error: detail}),
          };
        },
      }),
      new RegExp(`HTTP ${status}: ${detail}`),
    );
    assert.equal(calls, 1);
  }
});

test('report loader validates retry options before fetching', async () => {
  const baseOptions = {
    baseUrl: 'https://reports.example.test',
    token: 'test-secret',
    skillKeys: [],
    fetchImpl: async () => assert.fail('fetch must not be called'),
  };

  await assert.rejects(
    fetchHtmlReports({...baseOptions, fetchImpl: null}),
    /fetch implementation is required/,
  );
  await assert.rejects(
    fetchHtmlReports({...baseOptions, maxAttempts: 0}),
    /maxAttempts must be a positive integer/,
  );
  await assert.rejects(
    fetchHtmlReports({...baseOptions, maxAttempts: 1.5}),
    /maxAttempts must be a positive integer/,
  );
  await assert.rejects(
    fetchHtmlReports({...baseOptions, retryDelayMs: -1}),
    /retryDelayMs must be a non-negative number/,
  );
  await assert.rejects(
    fetchHtmlReports({...baseOptions, retryDelayMs: Number.POSITIVE_INFINITY}),
    /retryDelayMs must be a non-negative number/,
  );
  await assert.rejects(
    fetchHtmlReports({...baseOptions, sleepImpl: null}),
    /sleepImpl must be a function/,
  );
  await assert.rejects(
    fetchHtmlReports({...baseOptions, onReport: true}),
    /onReport must be a function/,
  );
});

test('report loader fails with a skill-specific status and never exposes the token', async () => {
  await assert.rejects(
    fetchHtmlReports({
      baseUrl: 'https://reports.example.test',
      token: 'never-print-this',
      skillKeys: ['csi'],
      maxAttempts: 1,
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({
          error: 'render failed for never-print-this',
        }),
      }),
    }),
    (error) => {
      assert.match(error.message, /csi/);
      assert.match(error.message, /503/);
      assert.match(error.message, /render failed for \[redacted\]/);
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

test('report manifest keeps HTML payloads on disk during the Vite build', () => {
  assert.deepEqual(htmlReportManifestTag(['csi', 'drafts']), {
    tag: 'script',
    attrs: {
      id: 'ddi-html-page-manifest',
      type: 'application/json',
    },
    children: '{"csi":"csi.html","drafts":"drafts.html"}',
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
    assert.deepEqual(first, [htmlReportManifestTag()]);
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

test('local HTML plugin verifies downloaded files and emits only a manifest', async () => {
  const reportsDirectory = await mkdtemp(join(tmpdir(), 'ddi-html-files-'));
  await writeFile(join(reportsDirectory, 'csi.html'), '<html>Local CSI</html>');

  try {
    const reports = await readHtmlReports({reportsDirectory, skillKeys: ['csi']});
    const plugin = htmlReportFilesPlugin({reportsDirectory, skillKeys: ['csi']});
    const tags = await plugin.transformIndexHtml.handler();

    assert.deepEqual(reports, [{skillKey: 'csi', html: '<html>Local CSI</html>'}]);
    assert.deepEqual(tags, [htmlReportManifestTag(['csi'])]);
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
