import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';

const appSource = readFileSync(new URL('./ClickstreamApp.jsx', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('./clickstream.css', import.meta.url), 'utf8');
const packageData = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);
const buildConfigSource = readFileSync(
  new URL('../../vite.clickstream.config.js', import.meta.url),
  'utf8',
);
const publishSource = readFileSync(
  new URL('../../scripts/publish-clickstream.mjs', import.meta.url),
  'utf8',
);
const envExampleSource = readFileSync(
  new URL('../../../.env.example', import.meta.url),
  'utf8',
);

const gravityReportFileName = 'Кликстрим_Месячный_все_воронки_zeroed_gravity.html';
const gravityReportUrl = new URL(`../../../${gravityReportFileName}`, import.meta.url);

test('Clickstream report is a React page composed from Gravity UI controls', () => {
  assert.match(mainSource, /import\s*\{ThemeProvider\}\s*from\s*['"]@gravity-ui\/uikit['"]/);
  assert.match(mainSource, /@gravity-ui\/uikit\/styles\/styles\.css/);
  assert.match(mainSource, /<ThemeProvider theme="light">/);

  for (const component of ['Button', 'Card', 'Icon', 'Label', 'Link', 'Progress', 'Select', 'Tooltip']) {
    assert.match(
      appSource,
      new RegExp(`<${component}\\b`),
      `${component} must be rendered from @gravity-ui/uikit`,
    );
  }
  assert.match(appSource, /from\s*['"]@gravity-ui\/uikit['"]/);
  assert.match(stylesSource, /var\(--g-color-/);
});

test('Clickstream React source does not embed or reproduce the legacy HTML document', () => {
  const productionSource = `${mainSource}\n${appSource}`;
  assert.doesNotMatch(productionSource, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(productionSource, /<iframe\b/i);
  assert.doesNotMatch(productionSource, /\.innerHTML\s*=/);
  assert.doesNotMatch(productionSource, /\b_ALL_DATA\b/);
  assert.doesNotMatch(productionSource, /\bonclick\s*=/);
});

test('Clickstream keeps one table implementation without experimental chart variants', () => {
  const productionSource = `${appSource}\n${stylesSource}`;
  assert.doesNotMatch(productionSource, /FunnelChartComponent/);
  assert.doesNotMatch(productionSource, /clickstream-(?:integrated|chart)-funnel/);
  assert.doesNotMatch(productionSource, /clickstream-data-badge/);
  assert.doesNotMatch(productionSource, /clickstream-table-row-highlighted/);
  assert.match(appSource, /<FunnelTable report=\{report\}\s*\/>/);
});

test('Clickstream widgets preserve the legacy report order', () => {
  const widgetTags = [
    '<SummaryGrid report={report}',
    '<FunnelTable report={report}',
    '<TrafficWidget traffic={report.traffic}',
    '<RecommendationsWidget recommendations={report.recommendations}',
    '<NrtCoverageWidget coverage={report.nrtCoverage}',
    '<TopDropsWidget steps={report.topCrDrops}',
    '<ConclusionWidget conclusion={report.conclusion}',
  ];
  const positions = widgetTags.map((tag) => appSource.indexOf(tag));

  assert.ok(positions.every((position) => position >= 0), 'One or more report widgets are missing');
  assert.deepEqual(
    positions,
    positions.toSorted((left, right) => left - right),
    'Clickstream widgets must keep summary → funnel → traffic → recommendations → NRT → drops → conclusion',
  );
});

test('NRT UI is conditional on the selected report configuration', () => {
  assert.match(
    appSource,
    /const hasNrt\s*=\s*Boolean\(report\.raw\.nrt_configured\);/,
  );
  assert.match(appSource, /\{hasNrt\s*&&\s*<th[^>]*>NRT<\/th>\}/);
  assert.match(appSource, /\{hasNrt\s*&&\s*<td[^>]*>\{matchedNrtEvents\}<\/td>\}/);
  assert.match(
    appSource,
    /function NrtCoverageWidget\(\{coverage\}\)\s*\{\s*if \(!coverage\) return null;/,
  );
  assert.match(appSource, /<NrtCoverageWidget coverage=\{report\.nrtCoverage\}\s*\/>/);
});

test('Clickstream UI uses consistent alignment grids and explicit table axes', () => {
  assert.match(
    stylesSource,
    /\.clickstream-summary-tile\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;/,
  );
  assert.match(
    stylesSource,
    /\.clickstream-widget-header\s*\{[\s\S]*?align-items:\s*center;/,
  );
  assert.match(
    stylesSource,
    /\.clickstream-traffic\s*\{[\s\S]*?grid-template-columns:\s*12px minmax\(0,\s*1fr\);/,
  );
  assert.match(stylesSource, /\.clickstream-cell-center\s*\{\s*text-align:\s*center/);
  assert.match(stylesSource, /\.clickstream-cell-number\s*\{\s*text-align:\s*right/);
  assert.match(appSource, /className="clickstream-cell-center"/);
  assert.match(appSource, /className="clickstream-cell-number"/);
});

test('latest period is the default and Show applies the draft filter selection', () => {
  assert.match(appSource, /:\s*catalog\.latestPeriodValue;/);
  assert.match(appSource, /const \[draftFunnelId,\s*setDraftFunnelId\]\s*=\s*useState\(initial\.funnelId\)/);
  assert.match(appSource, /const \[draftPeriodValue,\s*setDraftPeriodValue\]\s*=\s*useState\(initial\.periodValue\)/);
  assert.match(
    appSource,
    /const applyFilters\s*=\s*\(\)\s*=>\s*\{[\s\S]*?setSelection\(\{funnelId:\s*draftFunnelId,\s*periodValue:\s*draftPeriodValue\}\);/,
  );
  const showButton = appSource.match(/<Button\s+id="exp-show"[\s\S]*?<\/Button>/)?.[0];
  assert.ok(showButton, 'Show button is missing');
  assert.match(showButton, /onClick=\{applyFilters\}/);
  assert.match(showButton, />\s*Показать\s*<\/Button>/);
});

test('query navigation accepts the parent funnel mapping and latest-period request', () => {
  assert.match(appSource, /parameters\.get\(['"]funnel['"]\)/);
  assert.match(appSource, /parameters\.get\(['"]period['"]\)/);
  assert.match(appSource, /requestedPeriod\s*&&\s*requestedPeriod\s*!==\s*['"]latest['"]/);
  assert.match(appSource, /resolveClickstreamFunnelId\(requestedFunnel\)/);
  assert.match(appSource, /id="exp-funnel"/);
  assert.match(appSource, /id="exp-period"/);

  const envLine = envExampleSource
    .split(/\r?\n/)
    .find((line) => line.startsWith('VITE_HTML_PAGE_URLS='));
  assert.ok(envLine, 'VITE_HTML_PAGE_URLS is missing');
  assert.deepEqual(JSON.parse(envLine.slice(envLine.indexOf('=') + 1)), {
    clickstream: {url: 'Кликстрим_Месячный_все_воронки.html', title: 'Воронка оформления в СБОЛ', icon: 'Smartphone'},
    pilots: {url: 'pilots_07-08-2026.html', title: 'Пилотные кампании', icon: 'PaperPlane'},
    funnel: {url: 'Воронка_SberPAY_2026-07-31.html', title: 'Воронка кампейнинга', icon: 'Funnel'},
    complaints: {url: 'Жалобы_все_продукты.html', title: 'Жалобы', icon: 'FaceSad'},
    drafts: {url: 'Черновики_все_продукты.html', title: 'Черновики', icon: 'FileText'},
    client_metrics: {url: 'Клиентские_метрики_все_продукты.html', title: 'MAU', icon: 'ChartAreaStackedNormalized'},
    csi: {url: 'CSI_все_продукты.html', title: 'CSI', icon: 'Heart'},
  });
});

test('adjacent Gravity Clickstream standalone has a reproducible single-file build', () => {
  assert.equal(
    packageData.scripts['build:clickstream'],
    'vite build --config vite.clickstream.config.js && node scripts/publish-clickstream.mjs',
  );
  assert.match(buildConfigSource, /viteSingleFile\(\)/);
  assert.match(buildConfigSource, /outDir:\s*['"]dist-clickstream['"]/);
  assert.match(buildConfigSource, /clickstreamDataPlugin\(\)/);
  assert.match(publishSource, /Кликстрим_Месячный_все_воронки_zeroed_gravity\.html/);

  assert.ok(existsSync(gravityReportUrl), `Run npm run build:clickstream to create ${gravityReportFileName}`);
  const standalone = readFileSync(gravityReportUrl, 'utf8');
  assert.ok(standalone.length > 1_000_000, 'Standalone did not embed the Clickstream dataset');
  assert.match(standalone, /Анализ кликстрим воронок/);
  assert.match(standalone, /clickstream-summary-grid/);
  assert.match(standalone, /Воронка\. Открытие рублевых вкладов\./);
  assert.doesNotMatch(standalone, /<iframe\b/i);
  assert.doesNotMatch(standalone, /var _ALL_DATA\s*=/);

  const externalResources = [
    ...standalone.matchAll(
      /<(?:audio|iframe|img|link|script|source|video)\b[^>]*\b(?:href|src)\s*=\s*(["'])(.*?)\1[^>]*>/gi,
    ),
  ]
    .map((match) => match[2].trim())
    .filter((reference) => (
      reference
      && !reference.startsWith('#')
      && !reference.startsWith('data:')
      && !reference.startsWith('javascript:')
    ));
  assert.deepEqual(externalResources, []);
});
