import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {build as viteBuild} from 'vite';
import {AI_HTML_REPORT_SKILL_KEYS} from './htmlReportApi.js';

const CONTROLLED_ENVIRONMENT_KEYS = [
  'AI_HTML_API_BASE_URL',
  'AI_HTML_BUILD_FROM_FILES',
  'AI_HTML_REPORTS_DIR',
  'AI_HTML_TOKEN',
  'VITE_HTML_PAGE_URLS',
];

test('Vite file build ignores API credentials and emits a seven-report disk manifest', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'ddi-vite-html-files-'));
  const reportsDirectory = join(temporaryRoot, 'reports');
  const outputDirectory = join(temporaryRoot, 'dist');
  const savedEnvironment = Object.fromEntries(
    CONTROLLED_ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
  );
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  try {
    await mkdir(reportsDirectory);
    await Promise.all(AI_HTML_REPORT_SKILL_KEYS.map((skillKey) => (
      writeFile(
        join(reportsDirectory, `${skillKey}.html`),
        `<html><title>fixture-${skillKey}</title></html>`,
        {encoding: 'utf8', flag: 'wx'},
      )
    )));
    await writeFile(
      join(reportsDirectory, 'unexpected.html'),
      '<html><title>must-not-be-embedded</title></html>',
      'utf8',
    );

    Object.assign(process.env, {
      AI_HTML_API_BASE_URL: 'https://reports.example.invalid',
      AI_HTML_BUILD_FROM_FILES: '1',
      AI_HTML_REPORTS_DIR: reportsDirectory,
      AI_HTML_TOKEN: 'must-not-be-used',
      VITE_HTML_PAGE_URLS: '{}',
    });
    globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error('HTML API fetch is forbidden in file build mode');
    };

    await viteBuild({
      configFile: join(import.meta.dirname, 'vite.config.js'),
      logLevel: 'silent',
      build: {
        emptyOutDir: true,
        outDir: outputDirectory,
      },
    });

    const builtHtml = await readFile(join(outputDirectory, 'index.html'), 'utf8');
    assert.equal(fetchCalls, 0);
    assert.doesNotMatch(builtHtml, /must-not-be-used|reports\.example\.invalid/);
    assert.equal([...builtHtml.matchAll(/data-ddi-html-page-id=/g)].length, 0);
    const manifestMatch = builtHtml.match(
      /<script[^>]*id=["']ddi-html-page-manifest["'][^>]*>(.*?)<\/script>/,
    );
    assert.ok(manifestMatch, 'HTML report manifest is missing');
    assert.deepEqual(
      JSON.parse(manifestMatch[1]),
      Object.fromEntries(
        AI_HTML_REPORT_SKILL_KEYS.map((skillKey) => [skillKey, `${skillKey}.html`]),
      ),
    );
    for (const skillKey of AI_HTML_REPORT_SKILL_KEYS) {
      assert.equal(
        builtHtml.includes(Buffer.from(
          `<html><title>fixture-${skillKey}</title></html>`,
          'utf8',
        ).toString('base64')),
        false,
      );
    }
    assert.equal(
      builtHtml.includes(Buffer.from(
        '<html><title>must-not-be-embedded</title></html>',
        'utf8',
      ).toString('base64')),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(temporaryRoot, {recursive: true, force: true});
  }
});
