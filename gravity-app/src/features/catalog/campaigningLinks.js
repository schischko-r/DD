// Where to look for the campaigning team's metrics.
//
// The source workbook lists a destination per metric, so a dozen rows repeat the
// same dashboard under different metric names. Collapsing by destination turns
// 26 rows into 8 addresses, and a Navigator link keeps only its dashboard id:
// the sheet id after it opens the same board on a different tab.

export const CAMPAIGNING_TEAM = 'Персональная рекомендация';

export function shortenNavigatorUrl(url) {
  const source = String(url || '').trim();
  const match = source.match(/^(https:\/\/navigator\.sigma\.sbrf\.ru\/gdash\/\d+)(?:[/?#].*)?$/i);
  return match ? match[1] : source;
}

export function linkLabelForUrl(url) {
  const source = String(url || '').trim();
  if (/^https:\/\/navigator\.sigma\.sbrf\.ru\//i.test(source)) return 'Дашборд в Навигаторе';
  if (/^https:\/\/qlik\.sigma\.sbrf\.ru\//i.test(source)) return 'Дашборд в Qlik';
  if (/^https:\/\/jira\.sberbank\.ru\//i.test(source)) return 'Доска в Jira';
  if (/^https:\/\/confluence\.sberbank\.ru\//i.test(source)) return 'Страница в Confluence';
  return 'Открыть';
}

const NAVIGATOR_GOALS = 'https://navigator.sigma.sbrf.ru/gdash/1000003023';
const NAVIGATOR_DRIVERS = 'https://navigator.sigma.sbrf.ru/gdash/1000004779';
const NAVIGATOR_CLTV = 'https://navigator.sigma.sbrf.ru/gdash/1000002443';
const NAVIGATOR_SELF_SERVICE = 'https://navigator.sigma.sbrf.ru/gdash/1000003057';
const QLIK_DELIVERY = 'https://qlik.sigma.sbrf.ru/qs_b2c_data/scim_sigma/sense/app/9d8c38da-26b6-4e51-8be1-22b46376f154/sheet/aa70d1a2-4a2a-4972-bbcc-11751b52a1e3/state/analysis';
const JIRA_BACKLOG = 'https://jira.sberbank.ru/secure/RapidBoard.jspa?rapidView=40123&projectKey=INSIGHT#';

// A dashboard is named by what it holds, so a block can list several without
// repeating "Дашборд в Навигаторе" three times.
const DASHBOARD_NAMES = new Map([
  [NAVIGATOR_GOALS, 'Ключевые метрики'],
  [NAVIGATOR_DRIVERS, 'Драйверы метрик'],
  [NAVIGATOR_CLTV, 'CLTV'],
]);

// Block code -> destinations, in the order the workbook lists their metrics.
const CAMPAIGNING_BLOCK_LINKS = {
  general: [NAVIGATOR_GOALS, NAVIGATOR_CLTV],
  rezulьtativnostь: [NAVIGATOR_GOALS, NAVIGATOR_DRIVERS],
  analiz_effektivnostь: [NAVIGATOR_SELF_SERVICE, QLIK_DELIVERY],
  hyp: [JIRA_BACKLOG],
};

export function campaigningLinksForBlock(product, block) {
  if (String(product?.name || '').trim() !== CAMPAIGNING_TEAM) return [];
  const urls = CAMPAIGNING_BLOCK_LINKS[String(block?.code || '').trim()] || [];
  const seen = new Set();
  return urls
    .map(shortenNavigatorUrl)
    .filter((url) => !seen.has(url) && seen.add(url))
    .map((url) => ({label: DASHBOARD_NAMES.get(url) || linkLabelForUrl(url), url}));
}
