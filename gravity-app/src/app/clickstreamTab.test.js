import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
  applyHtmlPageBridge,
  latestPeriodValue,
} from '../features/html-pages/htmlPageBridge.js';
import {
  decodeHtmlPageContent,
  prepareHtmlPageSource,
} from '../features/html-pages/htmlPageContent.js';

const legacyReportFileName = 'Кликстрим_Месячный_все_воронки_zeroed.html';
const gravityReportFileName = 'Кликстрим_Месячный_все_воронки_zeroed_gravity.html';
const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
const teamProfileSource = readFileSync(
  new URL('../pages/TeamProfilePage.jsx', import.meta.url),
  'utf8',
);
const toolCatalogSource = readFileSync(
  new URL('../features/html-pages/htmlPageTools.js', import.meta.url),
  'utf8',
);
const htmlPageConfigSource = readFileSync(
  new URL('../features/html-pages/htmlPageConfig.js', import.meta.url),
  'utf8',
);
const htmlPageIconsSource = readFileSync(
  new URL('../features/html-pages/htmlPageIcons.js', import.meta.url),
  'utf8',
);
const reportPageSource = readFileSync(
  new URL('../pages/HtmlReportPage.jsx', import.meta.url),
  'utf8',
);
const bridgeSource = readFileSync(
  new URL('../features/html-pages/htmlPageBridge.js', import.meta.url),
  'utf8',
);
const viteConfigSource = readFileSync(
  new URL('../../vite.config.js', import.meta.url),
  'utf8',
);
const envExampleSource = readFileSync(
  new URL('../../../.env.example', import.meta.url),
  'utf8',
);
const htmlPageEnvConfig = JSON.parse(
  envExampleSource
    .split(/\r?\n/)
    .find((line) => line.startsWith('VITE_HTML_PAGE_URLS='))
    .slice('VITE_HTML_PAGE_URLS='.length),
);
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const reportData = JSON.parse(readFileSync(
  new URL('../../public/report-data.json', import.meta.url),
  'utf8',
));
const reportHtml = readFileSync(
  new URL(`../../../${legacyReportFileName}`, import.meta.url),
  'utf8',
);

test('tool catalog declares Clickstream as a universal html_page integration', () => {
  assert.match(toolCatalogSource, /export const TOOL_CATALOG\s*=/);
  assert.match(
    toolCatalogSource,
    /export const HTML_PAGE_TOOLS\s*=\s*Object\.freeze\(\s*TOOL_CATALOG\.filter\(\((?:item|entry)\)\s*=>\s*(?:item|entry)\.tool\s*===\s*['"]html_page['"]\)/,
  );
  assert.match(toolCatalogSource, /tool:\s*['"]html_page['"]/);
  assert.match(toolCatalogSource, /skillKeys:\s*(?:Object\.freeze\()?\[[^\]]*['"]clickstream_funnel['"]/);
  assert.match(toolCatalogSource, /skillNames:\s*(?:Object\.freeze\()?\[[^\]]*['"]Воронка оформления в СБОЛ['"]/);
  assert.match(toolCatalogSource, /metricCode:\s*['"]attract\.funnel_analysis['"]/);
  assert.match(
    toolCatalogSource,
    /valueSources:\s*(?:Object\.freeze\()?\{[\s\S]*?funnel:\s*(?:Object\.freeze\()?\[['"]ai_products\.0['"]\]/,
  );
  assert.match(
    toolCatalogSource,
    /fields:\s*(?:Object\.freeze\()?\[[\s\S]*?contextKey:\s*['"]funnel['"][\s\S]*?selector:\s*['"]#exp-funnel['"][\s\S]*?required:\s*true/,
  );
  assert.match(toolCatalogSource, /latestPeriodSelector:\s*['"]#exp-period['"]/);
  assert.match(
    toolCatalogSource,
    /showSelector:\s*['"]#exp-show,\s*button\[onclick=[""]_doLoad\(\)[""]\]['"]/,
  );
  assert.match(toolCatalogSource, /mode:\s*['"]query['"]/);
  assert.match(toolCatalogSource, /contextParams:\s*Object\.freeze\(\{funnel:\s*['"]funnel['"]\}\)/);
  assert.match(
    toolCatalogSource,
    /fixedParams:\s*Object\.freeze\(\{period:\s*['"]latest['"],\s*show:\s*['"]1['"]\}\)/,
  );
  assert.match(
    toolCatalogSource,
    /export function buildHtmlPageUrl\(tool,\s*context\s*=\s*\{\},\s*baseHref\s*=/,
  );
  assert.match(toolCatalogSource, /const url\s*=\s*new URL\(tool\.url,\s*baseHref\)/);
  assert.match(toolCatalogSource, /url\.searchParams\.set\(parameter,\s*value\)/);
  assert.match(toolCatalogSource, /return url\.href/);
});

test('html_page URL, title and Gravity icon come from the Vite env map', () => {
  assert.deepEqual(htmlPageEnvConfig, {
    clickstream: {
      url: `./${gravityReportFileName}`,
      title: 'Анализ кликстрим воронок',
      icon: 'ChartLine',
    },
    llm_summary: {url: '', title: 'AI-суммаризация', icon: 'Sparkles'},
    client_metrics: {url: '', title: 'Клиентские метрики', icon: 'ChartColumn'},
    complaints: {url: '', title: 'Жалобы и обращения', icon: 'Comments'},
    csi: {url: '', title: 'CSI', icon: 'CircleCheck'},
    drafts: {url: '', title: 'Черновики', icon: 'FileText'},
    funnel: {url: '', title: 'Воронка кампейнинга', icon: 'ChartAreaStacked'},
  });

  assert.match(toolCatalogSource, /import\.meta\.env\.VITE_HTML_PAGE_URLS/);
  assert.match(toolCatalogSource, /parseHtmlPageConfig\(/);
  assert.match(toolCatalogSource, /Object\.entries\(HTML_PAGE_CONFIG\)/);
  assert.match(toolCatalogSource, /url:\s*configured\.url\s*\|\|\s*['"]/);
  assert.match(
    toolCatalogSource,
    /title:\s*configured\.title\s*\|\|\s*definition\.title\s*\|\|\s*id/,
  );
  assert.match(toolCatalogSource, /icon:\s*configured\.icon\s*\|\|\s*['"]ChartLine['"]/);
  assert.match(toolCatalogSource, /\.filter\(\(entry\)\s*=>\s*entry\.url\)/);
  assert.match(appSource, /icon:\s*htmlPageIcon\(tool\.icon\)/);
  for (const icon of [
    'ChartAreaStacked',
    'ChartColumn',
    'ChartLine',
    'CircleCheck',
    'Comments',
    'FileText',
    'Sparkles',
  ]) {
    assert.match(htmlPageIconsSource, new RegExp(`\\b${icon}\\b`));
  }
  assert.match(htmlPageIconsSource, /HTML_PAGE_ICONS\[iconName\]\s*\|\|\s*ChartLine/);
  assert.doesNotMatch(toolCatalogSource, /\?raw/);
  assert.doesNotMatch(
    toolCatalogSource,
    /import\s+\w+\s+from\s+['"][^'"]+\.html(?:\?raw)?['"]/,
  );
});

test('html_page catalog resolves recommendations and builds mapped context generically', () => {
  assert.match(
    toolCatalogSource,
    /export function findHtmlPageToolForRecommendation\(recommendation\)/,
  );
  assert.match(toolCatalogSource, /HTML_PAGE_TOOLS\.find\(\(tool\)\s*=>/);
  assert.match(toolCatalogSource, /tool\.skillKeys\?\.includes\(recommendation\.skill_key\)/);
  assert.match(toolCatalogSource, /tool\.skillNames\?\.includes\(recommendation\.skill_name\)/);
  assert.match(
    toolCatalogSource,
    /export function buildHtmlPageContext\(tool,\s*recommendation\)/,
  );
  assert.match(htmlPageConfigSource, /tool\.valueSources/);
  assert.doesNotMatch(toolCatalogSource, /product_group/);
  assert.doesNotMatch(toolCatalogSource, /virtual:clickstream-funnel-index/);
  assert.match(htmlPageConfigSource, /recommendation/);
  assert.match(
    toolCatalogSource,
    /valueSources:\s*Object\.freeze\(\{\s*product:\s*\[['"]ai_products\.0['"]\]/,
  );
  assert.match(
    toolCatalogSource,
    /contextParams:\s*Object\.freeze\(\{product:\s*['"]product['"]\}\)/,
  );
  assert.match(
    toolCatalogSource,
    /contextKey:\s*['"]product['"],\s*selector:\s*['"]#exp-product['"]/,
  );
});

test('AsideHeader appends generated html_page items after a native divider', () => {
  assert.match(
    appSource,
    /import\s*\{[^}]*HTML_PAGE_TOOLS[^}]*\}\s*from\s*['"][^'"]*htmlPageTools\.js['"]/,
  );
  const menuItemsSource = appSource.match(
    /const menuItems\s*=\s*\[([\s\S]*?)\n\s*\];\s*\n\s*const content/,
  )?.[1];
  assert.ok(menuItemsSource, 'AsideHeader menuItems definition is missing');

  const aboutIndex = menuItemsSource.search(/id:\s*['"]about['"]/);
  const dividerIndex = menuItemsSource.search(
    /id:\s*['"]html-pages-divider['"][\s\S]*?type:\s*['"]divider['"]/,
  );
  const generatedItemsIndex = menuItemsSource.indexOf('HTML_PAGE_TOOLS.map');
  assert.ok(aboutIndex >= 0, 'About menu item is missing');
  assert.ok(dividerIndex > aboutIndex, 'HTML page divider must be below regular sidebar items');
  assert.ok(generatedItemsIndex > dividerIndex, 'Generated HTML pages must be below their divider');
  assert.match(menuItemsSource, /HTML_PAGE_TOOLS\.map\(\(tool\)\s*=>\s*\(\{/);
  assert.match(menuItemsSource, /id:\s*`html-page:\$\{tool\.id\}`/);
  assert.match(menuItemsSource, /title:\s*tool\.title/);
});

test('Team profile resolves a generic html_page action from recommendation metadata', () => {
  assert.match(
    teamProfileSource,
    /export function TeamProfilePage\(\{[^}]*\bonOpenHtmlPageTool\b[^}]*\}\)/,
  );
  assert.match(teamProfileSource, /findHtmlPageToolForRecommendation/);
  assert.match(teamProfileSource, /onOpenHtmlPageTool/);
  assert.match(teamProfileSource, /tool\.action\?\.metricCode/);
  assert.match(teamProfileSource, /buildHtmlPageContext\(tool,\s*recommendation\)/);
  assert.match(
    teamProfileSource,
    /const openConfiguredSkill\s*=\s*\(recommendation,\s*fallback\)\s*=>/,
  );
  assert.match(
    teamProfileSource,
    /onOpenHtmlPageTool\(tool\.id,\s*buildHtmlPageContext\(tool,\s*recommendation\)\)/,
  );
  for (const recommendation of [
    'mauAiRecommendation',
    'draftAiRecommendations[0]',
    'campaignFunnelAiRecommendations[0]',
    'pilotAiRecommendations[0]',
    'csiAiRecommendations[0]',
    'complaintsAiRecommendations[0]',
  ]) {
    assert.ok(
      teamProfileSource.includes(`openConfiguredSkill(${recommendation},`),
      `${recommendation} must route to a configured HTML page`,
    );
  }
  assert.match(
    teamProfileSource,
    /<MetricActionGroup title="Быстрая аналитика и AI-рекомендации" actions=\{insights\}\s*\/>/,
  );
});

test('App opens a resolved html_page with mapped context and renders the generic report page', () => {
  assert.match(appSource, /const openHtmlPageTool\s*=\s*\(toolId,\s*context\s*=\s*\{\}\)\s*=>/);
  assert.match(appSource, /setView\(`html-page:\$\{toolId\}`\)/);
  const teamProfile = appSource.match(/<TeamProfilePage\b[\s\S]*?\/>/)?.[0];
  assert.ok(teamProfile, 'Team profile view is missing');
  assert.match(teamProfile, /\bonOpenHtmlPageTool=\{openHtmlPageTool\}/);
  assert.match(
    appSource,
    /<HtmlReportPage\b[\s\S]*?\btool=\{[\s\S]*?\bcontext=\{[\s\S]*?\bonBack=\{/,
  );
});

test('generic HTML report sends query context and also applies the legacy DOM bridge', () => {
  assert.match(
    reportPageSource,
    /export function HtmlReportPage\(\{tool,\s*context,\s*onBack\}\)/,
  );
  assert.match(reportPageSource, /const frameRef\s*=\s*useRef\(null\);/);
  assert.match(reportPageSource, /buildHtmlPageUrl\(tool,\s*context\)/);
  assert.doesNotMatch(reportPageSource, /if \(usesQueryNavigation\) return;/);
  assert.match(reportPageSource, /frameRef\.current\?\.contentDocument/);
  assert.match(reportPageSource, /applyHtmlPageBridge\(/);
  assert.match(reportPageSource, /tool\.bridge/);
  assert.match(reportPageSource, /attempt\s*<\s*60/);
  assert.match(reportPageSource, /window\.setTimeout\(applyBridge,\s*100\)/);
  assert.match(reportPageSource, /window\.clearTimeout\(bridgeTimerRef\.current\)/);

  const iframe = reportPageSource.match(/<iframe\b[\s\S]*?\/>/)?.[0];
  assert.ok(iframe, 'HTML report iframe is missing');
  assert.match(iframe, /\bref=\{frameRef\}/);
  assert.match(iframe, /\bsrc=\{pageSource\s*\?\s*undefined\s*:\s*pageUrl\}/);
  assert.match(iframe, /\bsrcDoc=\{pageSource\s*\|\|\s*undefined\}/);
  assert.match(iframe, /\bonLoad=\{/);

  const returnAction = reportPageSource.match(
    /<div className="ai-return-action">([\s\S]*?)<\/div>/,
  )?.[1];
  assert.ok(returnAction, 'HTML report return action is missing');
  assert.match(returnAction, /<SemanticButton intent=\{BUTTON_INTENT\.primary\} onClick=\{onBack\}>/);
  assert.equal(
    returnAction.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    'Вернуться к DDI команды',
  );
});

test('configured sibling HTML is embedded for direct file usage with a preserved base URL', () => {
  const source = '<!doctype html><html><head><title>Отчёт</title></head><body>Данные</body></html>';
  const encoded = Buffer.from(source).toString('base64');
  assert.equal(decodeHtmlPageContent(encoded), source);
  assert.equal(
    prepareHtmlPageSource(source, 'file:///reports/client-metrics.html?product=Вклады'),
    '<!doctype html><html><head><base href="file:///reports/client-metrics.html?product=Вклады"><title>Отчёт</title></head><body>Данные</body></html>',
  );

  assert.match(viteConfigSource, /function siblingHtmlPageContents\(entries\)/);
  assert.match(viteConfigSource, /readFileSync\(file\.filePath\)\.toString\(['"]base64['"]\)/);
  assert.match(viteConfigSource, /import\.meta\.env\.VITE_HTML_PAGE_CONTENTS_BASE64/);
  assert.match(toolCatalogSource, /contentBase64:\s*HTML_PAGE_CONTENTS_BASE64\[id\]\s*\|\|\s*['"]/);
});

test('Vite serves the configured Gravity UI sibling report instead of the application fallback', async (t) => {
  const {createServer} = await import('vite');
  const server = await createServer({
    configFile: fileURLToPath(new URL('../../vite.config.js', import.meta.url)),
    optimizeDeps: {
      noDiscovery: true,
    },
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: true,
    },
  });
  t.after(() => server.close());
  await server.listen();

  const address = server.httpServer?.address();
  assert.ok(address && typeof address === 'object', 'Vite test server did not expose a port');
  const reportUrl = new URL(
    `/${encodeURIComponent(gravityReportFileName)}`,
    `http://127.0.0.1:${address.port}`,
  );
  const response = await fetch(reportUrl);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^text\/html\b/);
  assert.ok(body.length > 1_000_000, 'Configured request returned the small Vite app fallback');
  assert.match(body, /Анализ кликстрим воронок/);
  assert.match(body, /@gravity-ui\/uikit|g-card|clickstream-summary-grid/);
  assert.doesNotMatch(body, /var _ALL_DATA\s*=/);

  assert.match(viteConfigSource, /const allowedFiles\s*=\s*new Map\(\)/);
  assert.match(viteConfigSource, /allowedFiles\.get\(requestPath\)/);
  assert.match(viteConfigSource, /plugins:\s*\[[^\]]*siblingHtmlPages\(htmlPageConfig\)/);
});

test('generic HTML report selects the chronologically latest enabled period and clicks Show', () => {
  const shuffledOptions = [
    {value: '', textContent: 'Выберите период', disabled: true},
    {value: '2026-06-01|2026-06-30', textContent: 'июнь 2026', disabled: false},
    {value: '2026-03-01|2026-03-31', textContent: 'март 2026', disabled: false},
    {value: '2026-05-01|2026-05-31', textContent: 'май 2026', disabled: false},
    {value: '2027-01-01|2027-01-31', textContent: 'январь 2027', disabled: true},
  ];
  assert.equal(
    latestPeriodValue(shuffledOptions),
    '2026-06-01|2026-06-30',
    'Latest period must be selected chronologically, independently of DOM order',
  );
  assert.equal(
    latestPeriodValue([
      {value: 'p1', textContent: 'май 2026'},
      {value: 'p3', textContent: 'июль 2026'},
      {value: 'p2', textContent: 'июнь 2026'},
    ]),
    'p3',
    'Russian month labels must be ordered chronologically',
  );
  assert.equal(
    latestPeriodValue([
      {value: 'p1', textContent: 'июн. 2026'},
      {value: 'p2', textContent: 'июл. 2026'},
    ]),
    'p2',
    'Abbreviated Russian month labels must be ordered chronologically',
  );

  class FakeEvent {
    constructor(type, options) {
      this.type = type;
      this.bubbles = options?.bubbles;
    }
  }
  const funnelControl = {
    tagName: 'INPUT',
    value: '',
    events: [],
    dispatchEvent(event) {
      this.events.push(event);
    },
  };
  const periodControl = {
    tagName: 'SELECT',
    value: '',
    options: shuffledOptions,
    events: [],
    dispatchEvent(event) {
      this.events.push(event);
    },
  };
  const showControl = {
    clicks: 0,
    click() {
      this.clicks += 1;
    },
  };
  const controls = new Map([
    ['#exp-funnel', funnelControl],
    ['#exp-period', periodControl],
    ['#exp-show, button[onclick="_doLoad()"]', showControl],
  ]);
  const fakeDocument = {
    defaultView: {Event: FakeEvent},
    querySelector(selector) {
      return controls.get(selector) || null;
    },
  };
  const bridge = {
    fields: [{contextKey: 'funnel', selector: '#exp-funnel', required: true}],
    latestPeriodSelector: '#exp-period',
    showSelector: '#exp-show, button[onclick="_doLoad()"]',
  };

  const context = {
    funnel: 'Воронка. Открытие рублевых вкладов.',
  };
  assert.deepEqual(
    applyHtmlPageBridge(fakeDocument, bridge, context),
    {ready: false, showTriggered: false},
    'The first pass must only apply the native funnel value',
  );
  assert.deepEqual(
    applyHtmlPageBridge(fakeDocument, bridge, context),
    {ready: false, showTriggered: false},
    'The second pass must confirm funnel and apply the native period value',
  );
  assert.deepEqual(
    applyHtmlPageBridge(fakeDocument, bridge, context),
    {ready: true, showTriggered: true},
    'Show must run only after both native values are confirmed',
  );
  assert.equal(funnelControl.value, 'Воронка. Открытие рублевых вкладов.');
  assert.equal(periodControl.value, '2026-06-01|2026-06-30');
  assert.deepEqual(
    funnelControl.events.map(({type}) => type),
    ['input', 'change'],
    'Mapped funnel must emit value events before Show',
  );
  assert.deepEqual(
    periodControl.events.map(({type}) => type),
    ['input', 'change'],
    'Latest period must emit value events before Show',
  );
  assert.equal(showControl.clicks, 1, 'Configured Show control must be clicked once');

  showControl.clicks = 0;
  assert.deepEqual(
    applyHtmlPageBridge(fakeDocument, bridge, {funnel: ''}),
    {ready: false, showTriggered: false},
  );
  assert.equal(showControl.clicks, 0, 'Show must not run without a required funnel');

  assert.match(bridgeSource, /latestPeriodValue\(control\.options\)/);
  assert.match(bridgeSource, /normalizeText\(control\.value\)\s*===\s*normalizedExpected/);
  assert.match(bridgeSource, /if \(showTriggered\) showControl\.click\(\)/);
});

test('generic HTML report does not click Show when a native select rejects the mapped product', () => {
  const allowedValues = new Set(['', 'Вклады']);
  let selectedValue = '';
  const productControl = {
    tagName: 'SELECT',
    options: [
      {value: '', textContent: 'Выберите продукт', disabled: true},
      {value: 'Вклады', textContent: 'Вклады', disabled: false},
    ],
    get value() {
      return selectedValue;
    },
    set value(value) {
      selectedValue = allowedValues.has(value) ? value : '';
    },
    dispatchEvent() {},
  };
  const periodControl = {
    tagName: 'SELECT',
    value: '',
    options: [{value: '2026-07', textContent: 'июль 2026', disabled: false}],
    dispatchEvent() {},
  };
  const showControl = {
    clicks: 0,
    click() {
      this.clicks += 1;
    },
  };
  const controls = new Map([
    ['#exp-product', productControl],
    ['#exp-period', periodControl],
    ['#exp-show, button[onclick="_doLoad()"]', showControl],
  ]);
  const fakeDocument = {
    defaultView: {Event},
    querySelector(selector) {
      return controls.get(selector) || null;
    },
  };
  const bridge = {
    fields: [{contextKey: 'product', selector: '#exp-product', required: true}],
    latestPeriodSelector: '#exp-period',
    showSelector: '#exp-show, button[onclick="_doLoad()"]',
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.deepEqual(
      applyHtmlPageBridge(fakeDocument, bridge, {product: 'Неизвестный продукт'}),
      {ready: false, showTriggered: false},
    );
  }
  assert.equal(productControl.value, '');
  assert.equal(showControl.clicks, 0);
});

test('generic HTML report configures Gravity UI selects over repeated bridge passes', () => {
  let openListbox = null;
  function gravitySelect(id, labels, placeholder) {
    let selected = placeholder;
    const control = {
      get textContent() {
        return selected;
      },
      getAttribute(name) {
        if (name === 'role') return 'combobox';
        if (name === 'aria-controls') return openListbox === listbox ? id : null;
        if (name === 'aria-expanded') return openListbox === listbox ? 'true' : 'false';
        return null;
      },
      click() {
        openListbox = listbox;
      },
    };
    const options = labels.map((label) => ({
      textContent: label,
      disabled: false,
      getAttribute() {
        return null;
      },
      click() {
        selected = label;
        openListbox = null;
      },
    }));
    const listbox = {
      id,
      querySelectorAll(selector) {
        return selector === '[role="option"]' ? options : [];
      },
    };
    return {
      container: {
        querySelector(selector) {
          return selector === '[role="combobox"]' ? control : null;
        },
      },
      control,
      listbox,
    };
  }

  const product = gravitySelect(
    'product-options',
    ['Карты', 'Вклады', 'Кредиты'],
    'Выберите продукт',
  );
  const period = gravitySelect(
    'period-options',
    ['май 2026', 'июль 2026', 'июнь 2026'],
    'Выберите период',
  );
  const showControl = {
    clicks: 0,
    click() {
      this.clicks += 1;
    },
  };
  const fakeDocument = {
    defaultView: {Event},
    getElementById(id) {
      return openListbox?.id === id ? openListbox : null;
    },
    querySelector(selector) {
      if (selector === '#exp-product') return product.container;
      if (selector === '#exp-period') return period.container;
      if (selector === '#exp-show, button[onclick="_doLoad()"]') return showControl;
      if (selector === '[role="listbox"]') return openListbox;
      return null;
    },
  };
  const bridge = {
    fields: [{contextKey: 'product', selector: '#exp-product', required: true}],
    latestPeriodSelector: '#exp-period',
    showSelector: '#exp-show, button[onclick="_doLoad()"]',
  };

  let result = {ready: false, showTriggered: false};
  for (let attempt = 0; attempt < 6 && !result.showTriggered; attempt += 1) {
    result = applyHtmlPageBridge(fakeDocument, bridge, {product: 'Вклады'});
  }

  assert.deepEqual(result, {ready: true, showTriggered: true});
  assert.equal(product.control.textContent, 'Вклады');
  assert.equal(period.control.textContent, 'июль 2026');
  assert.equal(showControl.clicks, 1);
});

test('generic HTML report waits for an enabled Show button', () => {
  const productControl = {
    tagName: 'INPUT',
    value: 'Вклады',
    dispatchEvent() {},
  };
  const periodControl = {
    tagName: 'SELECT',
    value: '2026-07',
    options: [{value: '2026-07', textContent: 'июль 2026', disabled: false}],
    dispatchEvent() {},
  };
  const showControl = {
    disabled: true,
    clicks: 0,
    getAttribute(name) {
      if (name === 'disabled') return this.disabled ? '' : null;
      return null;
    },
    click() {
      this.clicks += 1;
    },
  };
  const controls = new Map([
    ['#exp-product', productControl],
    ['#exp-period', periodControl],
    ['#exp-show, button[onclick="_doLoad()"]', showControl],
  ]);
  const fakeDocument = {
    defaultView: {Event},
    querySelector(selector) {
      return controls.get(selector) || null;
    },
  };
  const bridge = {
    fields: [{contextKey: 'product', selector: '#exp-product', required: true}],
    latestPeriodSelector: '#exp-period',
    showSelector: '#exp-show, button[onclick="_doLoad()"]',
  };

  let result = {ready: false, showTriggered: false};
  for (let attempt = 0; attempt < 3; attempt += 1) {
    result = applyHtmlPageBridge(fakeDocument, bridge, {product: 'Вклады'});
  }
  assert.deepEqual(result, {ready: false, showTriggered: false});
  assert.equal(showControl.clicks, 0);

  showControl.disabled = false;
  result = applyHtmlPageBridge(fakeDocument, bridge, {product: 'Вклады'});
  assert.deepEqual(result, {ready: true, showTriggered: true});
  assert.equal(showControl.clicks, 1);
});

test('generic HTML report finds an unconfigured button by the exact Show label', () => {
  const productControl = {
    tagName: 'INPUT',
    value: 'Вклады',
    dispatchEvent() {},
  };
  const periodControl = {
    tagName: 'SELECT',
    value: '2026-07',
    options: [{value: '2026-07', textContent: 'июль 2026', disabled: false}],
    dispatchEvent() {},
  };
  const otherButton = {
    textContent: 'Скачать',
    disabled: false,
    getAttribute() {
      return null;
    },
    click() {
      throw new Error('The unrelated button must not be clicked');
    },
  };
  const showControl = {
    textContent: 'Показать',
    disabled: false,
    clicks: 0,
    getAttribute() {
      return null;
    },
    click() {
      this.clicks += 1;
    },
  };
  const fakeDocument = {
    defaultView: {Event},
    querySelector(selector) {
      if (selector === '#exp-product') return productControl;
      if (selector === '#exp-period') return periodControl;
      return null;
    },
    querySelectorAll() {
      return [otherButton, showControl];
    },
  };
  const bridge = {
    fields: [{contextKey: 'product', selector: '#exp-product', required: true}],
    latestPeriodSelector: '#exp-period',
    showSelector: '#missing-show',
  };

  let result = {ready: false, showTriggered: false};
  for (let attempt = 0; attempt < 4 && !result.showTriggered; attempt += 1) {
    result = applyHtmlPageBridge(fakeDocument, bridge, {product: 'Вклады'});
  }
  assert.deepEqual(result, {ready: true, showTriggered: true});
  assert.equal(showControl.clicks, 1);
});

test('HTML report fills the available application viewport', () => {
  assert.match(
    stylesSource,
    /\.html-report-page\s*\{[^}]*width:\s*100%;[^}]*height:\s*100vh;[^}]*min-height:\s*100vh;[^}]*overflow:\s*hidden;/s,
  );
  assert.match(
    stylesSource,
    /\.html-report-frame\s*\{[^}]*display:\s*block;[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*border:\s*0;/s,
  );
});

test('all Clickstream recommendation mappings exist as report funnels', () => {
  const dataMarker = 'var _ALL_DATA = ';
  const dataStart = reportHtml.indexOf(dataMarker);
  assert.notEqual(dataStart, -1, '_ALL_DATA marker is missing from Clickstream HTML');

  const jsonStart = dataStart + dataMarker.length;
  const jsonEnd = reportHtml.indexOf(';\n', jsonStart);
  assert.notEqual(jsonEnd, -1, '_ALL_DATA terminator is missing from Clickstream HTML');

  const clickstreamData = JSON.parse(reportHtml.slice(jsonStart, jsonEnd));
  const funnelNames = new Set(clickstreamData.funnels.map((item) => item.funnel_name));
  const funnelIdsByName = new Map(
    clickstreamData.funnels.map((item) => [item.funnel_name, String(item.funnel_id)]),
  );
  const clickstreamRecommendations = reportData.products.flatMap((product) => (
    (product.metric_recommendations || [])
      .filter((item) => (
        item.skill_key === 'clickstream_funnel'
        || item.skill_name === 'Воронка оформления в СБОЛ'
      ))
      .map((item) => ({
        product: product.name,
        funnel: item.product_group,
      }))
  ));

  assert.ok(clickstreamRecommendations.length > 0, 'Clickstream recommendation mappings are missing');
  assert.ok(
    clickstreamRecommendations.every((item) => item.funnel),
    'Every Clickstream recommendation must declare product_group',
  );

  const missingMappings = clickstreamRecommendations.filter(
    ({funnel}) => !funnelNames.has(funnel),
  );
  assert.deepEqual(
    missingMappings,
    [],
    `Recommendation mappings are absent from _ALL_DATA.funnels: ${missingMappings
      .map(({product, funnel}) => `${product}: ${funnel}`)
      .join(', ')}`,
  );
  assert.equal(
    funnelIdsByName.get('Воронка. Открытие рублевых вкладов.'),
    '34601',
    'The deposits recommendation must resolve to a stable Clickstream funnel id',
  );
});

test('Clickstream periods include an unambiguous chronological latest value', () => {
  const dataMarker = 'var _ALL_DATA = ';
  const jsonStart = reportHtml.indexOf(dataMarker) + dataMarker.length;
  const jsonEnd = reportHtml.indexOf(';\n', jsonStart);
  const clickstreamData = JSON.parse(reportHtml.slice(jsonStart, jsonEnd));
  const periodValues = clickstreamData.periods.map(
    ({date_from: dateFrom, date_to: dateTo}) => `${dateFrom}|${dateTo}`,
  );
  const chronologicallyLatest = periodValues.toSorted().at(-1);

  assert.equal(chronologicallyLatest, '2026-06-01|2026-06-30');
  assert.equal(
    periodValues.filter((value) => value === chronologicallyLatest).length,
    1,
    'Latest period must be unique before the report selects it automatically',
  );
});

test('source Clickstream HTML is self-contained', () => {
  const resourceTags = [
    ...reportHtml.matchAll(/<(?:audio|iframe|img|link|script|source|video)\b[^>]*>/gi),
  ].map((match) => match[0]);
  const externalReferences = resourceTags.flatMap((tag) => (
    [...tag.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi)]
      .map((match) => match[2].trim())
      .filter((reference) => (
        reference
        && !reference.startsWith('#')
        && !reference.startsWith('data:')
        && !reference.startsWith('javascript:')
      ))
  ));

  assert.deepEqual(
    externalReferences,
    [],
    `Clickstream HTML depends on external resources: ${externalReferences.join(', ')}`,
  );
});
