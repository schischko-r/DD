import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  findMaturityUnit,
  formatMaturityDelta,
  formatMaturityValue,
  deltaDirection,
  planLabelTheme,
  planStatus,
  planStatusLabel,
  planTone,
  trendColor,
  trendLabel,
  visibleMaturityCategories,
} from './dataMaturity.js';

const maturity = JSON.parse(readFileSync(
  new URL('../../../public/data-maturity.json', import.meta.url),
  'utf8',
));

test('the connector publishes exactly the Data-Driven units the workbook covers', () => {
  assert.deepEqual(
    maturity.units.map((unit) => [unit.key, unit.label, unit.sourceUnit]),
    [
      ['Data', 'Data', 'Data'],
      ['CX', 'CX', 'CX'],
      ['УБ', 'УБ', 'УБ'],
      ['CBP', 'Core Banking', 'Core'],
      ['DB', 'Daily Banking', 'Daily'],
      ['PC', 'PH (CC)', 'СС'],
      ['DP', 'Digital (DC)', 'Digital'],
      ['ДомКлик', 'ДомКлик', 'Домклик'],
    ],
  );
  assert.equal(maturity.meta.period, '2Q2026');
  assert.equal(maturity.meta.previousPeriod, '1Q2026');
});

test('every reading carries the unit the workbook declares for it', () => {
  const measures = new Set(maturity.units
    .flatMap((unit) => unit.categories)
    .flatMap((category) => category.metrics)
    .map((metric) => metric.measure));
  assert.deepEqual([...measures].sort(), ['%', 'раб.дни'], 'the workbook only measures shares and working days');

  assert.equal(formatMaturityValue(0.935, '%'), '93,5%');
  assert.equal(formatMaturityValue(1, '%'), '100%');
  assert.equal(formatMaturityValue(15, 'раб.дни'), '15 дн.', 'a bare 15 next to a 93,5% reads as another share');
  assert.equal(formatMaturityValue(null, '%'), '—');
  assert.equal(formatMaturityValue(undefined, '%'), '—');
});

test('a delta keeps its sign and its unit, zero included', () => {
  assert.equal(formatMaturityDelta(0.04, '%'), '+4 п.п.');
  assert.equal(formatMaturityDelta(-0.067, '%'), '−6,7 п.п.');
  assert.equal(formatMaturityDelta(-6, 'раб.дни'), '−6 дн.');
  assert.equal(formatMaturityDelta(1, 'раб.дни'), '+1 дн.');
  assert.equal(formatMaturityDelta(0, '%'), '+0 п.п.', 'an unchanged share still says what it did not change by');
  assert.equal(formatMaturityDelta(0, 'раб.дни'), '+0 дн.');
  assert.equal(formatMaturityDelta(null, '%'), '—');
});

test('the traffic light follows the direction that improves each metric', () => {
  const speed = maturity.units
    .flatMap((unit) => unit.categories)
    .flatMap((category) => category.metrics)
    .find((metric) => metric.key === 'bank-delivery-speed-cr' && metric.delta === -6);
  assert.ok(speed, 'Core Banking CR speed dropped from 21 to 15 days');
  assert.equal(speed.betterDirection, 'down');
  assert.equal(speed.trend, 'positive', 'fewer working days is an improvement');
  assert.equal(trendColor('positive'), 'positive');

  const incidents = maturity.units
    .find((unit) => unit.key === 'CBP').categories
    .find((category) => category.label === 'Надежность').metrics
    .find((metric) => metric.key === 'incident-density');
  assert.equal(incidents.betterDirection, 'down');
  assert.equal(incidents.trend, 'negative', 'a denser incident flow is a regression');
  assert.equal(trendColor('negative'), 'danger');
});

test('a metric without both readings stays neutral instead of guessing', () => {
  const unknown = maturity.units
    .flatMap((unit) => unit.categories)
    .flatMap((category) => category.metrics)
    .filter((metric) => metric.trend === 'unknown');
  assert.ok(unknown.length > 0);
  for (const metric of unknown) {
    assert.ok(metric.value === null || metric.previousValue === null);
    assert.equal(metric.delta, null);
  }
  assert.equal(trendColor('unknown'), 'secondary');
  assert.equal(trendLabel('unknown'), 'Нет данных для сравнения');
});

test('the workbook spelling of one category is folded into a single group', () => {
  const categories = new Set(maturity.units.flatMap((unit) => unit.categories.map((item) => item.label)));
  assert.ok(categories.has('Потребление'));
  assert.ok(!categories.has('Потребленияе'), 'the "Потребленияе" typo is normalized away');
});

test('the layer is looked up by Data-Driven unit and is absent without a unit', () => {
  assert.equal(findMaturityUnit(maturity, ''), null, 'no unit selected leaves the page as it was');
  assert.equal(findMaturityUnit(maturity, 'Ecom'), null, 'a unit outside the workbook adds no layer');
  assert.equal(findMaturityUnit(maturity, 'УБ').label, 'УБ');
  assert.equal(findMaturityUnit(maturity, 'CBP').label, 'Core Banking');
  assert.equal(findMaturityUnit(null, 'CBP'), null);
});

test('the summary mounts the layer only for a selected unit and leaves the radar row alone', () => {
  const pageSource = readFileSync(new URL('../../pages/DashboardPage.jsx', import.meta.url), 'utf8');
  assert.match(pageSource, /const maturityUnit = useMemo\(\(\) => findMaturityUnit\(maturity, unit\), \[maturity, unit\]\);/);
  assert.match(pageSource, /\{maturityUnit && <section className="metrics-section"/);
  assert.match(
    pageSource,
    /<div className="metrics-title"><h2>Ключевые блоки DD-рейтинга<\/h2><\/div>\s*<div className="dashboard-data-maturity">/,
    'the summary labels the card row the same way the team page does',
  );
  assert.match(pageSource, /<section className="dashboard-analysis-grid">/, 'the radar and anti-top keep their own row');
  assert.doesNotMatch(pageSource, /has-maturity|dashboard-analysis-primary/);

  const stylesSource = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  assert.match(stylesSource, /\.dashboard-analysis-grid \{ margin-top: 12px; display: grid; grid-template-columns: minmax\(0, 1\.05fr\) minmax\(420px, \.95fr\); gap: 12px; \}/);
  for (const tone of ['success', 'danger', 'default']) {
    assert.match(stylesSource, new RegExp(`\\.metric-light-${tone} \\{ background: var\\(--g-color-base-`), 'the layer borrows the team metric lights');
  }
});

test('the radar blocks stand beside the layer as cards of the same half width', () => {
  const pageSource = readFileSync(new URL('../../pages/DashboardPage.jsx', import.meta.url), 'utf8');
  assert.match(pageSource, /\{radarData\.map\(\(block\) => <DashboardBlockCard key=\{block\.code\} name=\{block\.name\} score=\{block\.unit\} reference=\{block\.b2c\}/);
  assert.match(pageSource, /return \{code: block\.code, name: block\.name, b2c: averageFor\(periodProducts\), unit: averageFor\(scopedProducts\)\};/);

  const cardSource = readFileSync(new URL('./DataMaturityCard.jsx', import.meta.url), 'utf8');
  const blockCardSource = cardSource.slice(
    cardSource.indexOf('export function DashboardBlockCard'),
    cardSource.indexOf('export function DataMaturityCard'),
  );
  assert.ok(blockCardSource, 'the block card is its own component');
  assert.doesNotMatch(blockCardSource, /<button|onClick|onToggle/, 'the block cards carry no control');

  const stylesSource = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  assert.match(stylesSource, /\.dashboard-data-maturity \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 12px; align-items: start; \}/);
  assert.doesNotMatch(stylesSource, /\.metric-block-data-maturity \{ grid-column/, 'the layer is half width like every other card');
  assert.match(stylesSource, /\.dd-metric-block-main-static \{ grid-template-columns: minmax\(0, 1fr\); cursor: default; \}/);
});

test('the layer reuses the metric block shell so it reads like the DD blocks', () => {
  const cardSource = readFileSync(new URL('./DataMaturityCard.jsx', import.meta.url), 'utf8');
  assert.match(cardSource, /className=\{`metric-block metric-block-data-maturity\$\{unit\.score === null \? '' : ` tone-\$\{scoreTone\(unit\.score\)\}`\}`\}/);
  assert.doesNotMatch(cardSource, /tone-default/, 'tone-default paints the card grey; it stays white');
  assert.match(cardSource, /<div className="dd-metric-block-head">/);
  assert.match(cardSource, /<button className="dd-metric-block-main" type="button" onClick=\{onToggle\} aria-expanded=\{isOpen\}>/);
  assert.match(cardSource, /<Icon data=\{isOpen \? ChevronDown : ChevronRight\} size=\{14\} \/>/);
  assert.match(cardSource, /\{isOpen && \(\s*<div className="metric-list">/);
  assert.match(cardSource, /<div className="metric-group-title"><span>\{category\.label\}<\/span><\/div>/, 'categories reuse the block group header');
  assert.match(cardSource, /<div className="metric-row">\s*<div className="metric-copy">/, 'rows reuse the team metric row');
  assert.match(cardSource, /<div className="metric-name-line"><b>\{metric\.label\}<\/b><\/div>/);
  assert.match(cardSource, /<div className="metric-status-with-confirmation">\s*<div className="metric-value-group">/);
  assert.doesNotMatch(cardSource, /data-maturity-name|data-maturity-fact|data-maturity-result/, 'the bespoke row markup is gone');
  assert.match(
    cardSource,
    /`B2C \$\{meta\.averageScore\}%`\} · не влияет на DD-рейтинг/,
    'the subtitle carries the B2C comparison and the disclaimer, nothing else',
  );
  assert.doesNotMatch(cardSource, /нормативов ·/, 'the norm tally left the subtitle');
});

test('both summary navigation cards split the same way regardless of action count', () => {
  const stylesSource = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  assert.match(
    stylesSource,
    /\.dashboard-about-card \{[^}]*grid-template-columns: minmax\(0, 1fr\) 216px;/,
    'an auto action column makes the two-button card steal width from its own copy',
  );
});

test('the delta reads as an arrow and a number, and the norm sits under the fact', () => {
  assert.equal(deltaDirection(0.04), 'up');
  assert.equal(deltaDirection(-6), 'down');
  assert.equal(deltaDirection(0), 'flat', 'an unchanged metric gets no arrow');
  const cardCheck = readFileSync(new URL('./DataMaturityCard.jsx', import.meta.url), 'utf8');
  assert.match(cardCheck, /data-maturity-delta-\$\{metric\.trend\}/, 'a flat delta stays on the secondary colour');
  assert.equal(deltaDirection(null), 'flat');

  const cardSource = readFileSync(new URL('./DataMaturityCard.jsx', import.meta.url), 'utf8');
  assert.match(cardSource, /<Icon data=\{direction === 'up' \? CaretUp : CaretDown\} size=\{14\} \/>/);
  assert.match(cardSource, /\{direction !== 'flat' && <Icon/, 'no arrow when nothing moved');
  assert.match(cardSource, /<span className=\{`data-maturity-delta data-maturity-delta-\$\{metric\.trend\}`\}>/);
  assert.doesNotMatch(cardSource, /data-maturity-delta[^`]*`\} theme=/, 'the delta is no longer boxed in a Label');
  assert.match(
    cardSource,
    /<\/div>\s*<span className="data-maturity-plan-note">\{metric\.planLabel \? `план \$\{metric\.planLabel\}` : 'план отсутствует'\}<\/span>/,
    'the norm hangs under the fact, not under the description',
  );

  const stylesSource = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  assert.match(stylesSource, /\.data-maturity-delta \{ flex: 0 0 auto; display: inline-flex;[^}]*font-variant-numeric: tabular-nums;/);
  assert.doesNotMatch(stylesSource, /\.data-maturity-delta \{[^}]*box-shadow/, 'no pill outline is left');
  assert.match(stylesSource, /\.data-maturity-plan-note \{ margin-top: 3px;/);
});

test('a metric with no reading this quarter is not shown at all', () => {
  const withGaps = {
    categories: [
      {key: 'speed', label: 'Скорость', metrics: [
        {key: 'a', value: null, delta: null},
        {key: 'b', value: 15, delta: -6},
      ]},
      {key: 'reliability', label: 'Надежность', metrics: [{key: 'c', value: null, delta: null}]},
    ],
  };
  const categories = visibleMaturityCategories(withGaps);
  assert.deepEqual(categories.map((category) => category.key), ['speed'], 'a category left empty disappears with its metrics');
  assert.deepEqual(categories[0].metrics.map((metric) => metric.key), ['b']);
  assert.deepEqual(visibleMaturityCategories(null), []);

  const cardSource = readFileSync(new URL('./DataMaturityCard.jsx', import.meta.url), 'utf8');
  assert.match(cardSource, /const categories = visibleMaturityCategories\(unit\);/);
  assert.match(cardSource, /if \(!unit \|\| !categories\.length\) return null;/);
});

test('the unit score is the share of norms it meets and it reaches the radar', () => {
  for (const unit of maturity.units) {
    const metrics = unit.categories.flatMap((category) => category.metrics);
    const judged = metrics.filter((metric) => metric.meetsPlan !== null);
    const met = judged.filter((metric) => metric.meetsPlan);
    assert.equal(unit.judgedCount, judged.length, unit.label);
    assert.equal(unit.metCount, met.length, unit.label);
    assert.equal(unit.score, judged.length ? Math.round((met.length / judged.length) * 100) : null, unit.label);
  }
  const scored = maturity.units.map((unit) => unit.score).filter((score) => score !== null);
  assert.equal(maturity.meta.averageScore, Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length));

  const pageSource = readFileSync(new URL('../../pages/DashboardPage.jsx', import.meta.url), 'utf8');
  assert.match(pageSource, /const radarPoints = useMemo\(\(\) => \(maturityUnit/);
  assert.match(pageSource, /code: 'data-maturity',[\s\S]*?b2c: maturity\?\.meta\?\.averageScore \?\? null,[\s\S]*?unit: maturityUnit\.score,/);
  assert.match(pageSource, /<RadarChart data=\{radarPoints\}/);
  assert.doesNotMatch(pageSource, /<RadarChart data=\{radarData\}/, 'without a unit the axis is not added at all');

  const cardSource = readFileSync(new URL('./DataMaturityCard.jsx', import.meta.url), 'utf8');
  assert.match(cardSource, /<strong>\{unit\.score\}%<\/strong>/);
  assert.match(cardSource, /scoreTone\(unit\.score\)/, 'the score is toned by the same scale as the DD blocks');
});

test('the traffic light reports the plan, not the quarter-on-quarter move', () => {
  assert.equal(planStatus({meetsPlan: true}), 'met');
  assert.equal(planStatus({meetsPlan: false}), 'missed');
  assert.equal(planStatus({meetsPlan: null}), 'none', 'no norm means no verdict');
  assert.equal(planStatus(undefined), 'none');
  assert.equal(planStatusLabel('met'), 'План выполняется');
  assert.equal(planStatusLabel('missed'), 'План не выполняется');
  assert.equal(planStatusLabel('none'), 'Плана нет');

  assert.equal(planTone('met'), 'success');
  assert.equal(planTone('missed'), 'danger');
  assert.equal(planTone('none'), 'default');
  assert.equal(planLabelTheme('met'), 'success');
  assert.equal(planLabelTheme('missed'), 'danger');
  assert.equal(planLabelTheme('none'), 'normal');

  const cardSource = readFileSync(new URL('./DataMaturityCard.jsx', import.meta.url), 'utf8');
  assert.match(cardSource, /metric-light metric-light-\$\{planTone\(status\)\}/, 'the light is the same dot a team metric uses');
  assert.match(cardSource, /<Label className="metric-status-label" theme=\{planLabelTheme\(status\)\}>/);

  // A metric that improved but still misses its norm reads red, not green.
  const missedButImproving = maturity.units
    .flatMap((unit) => unit.categories)
    .flatMap((category) => category.metrics)
    .find((metric) => metric.meetsPlan === false && metric.trend === 'positive');
  if (missedButImproving) assert.equal(planStatus(missedButImproving), 'missed');
});

test('the B2C profile card carries the same score scale as a team card', () => {
  const pageSource = readFileSync(new URL('../../pages/DashboardPage.jsx', import.meta.url), 'utf8');
  assert.match(pageSource, /const profileScore = unit \? scopedAverage : radarAverage;/, 'a picked unit reports its own average, otherwise B2C');
  assert.match(pageSource, /const profileCaption = unit \? 'Среднее по командам юнита' : 'Среднее по B2C';/);
  assert.match(pageSource, /<h2>\{unit \? `Профиль юнита \$\{unit\}` : 'Профиль B2C'\}<\/h2>/);
  assert.match(
    pageSource,
    /\{unit && <span>Среднее по B2C — \{radarAverage === null \? 'нет данных' : `\$\{radarAverage\}%`\}<\/span>\}/,
    'a unit profile still names the B2C figure it is measured against',
  );
  assert.match(pageSource, /<div className=\{`dashboard-index-summary index-card tone-\$\{profileTone\}`\}/);
  assert.match(
    pageSource,
    /<div className="index-card-title"><span>\{profileCaption\}<\/span><\/div><div className="index-score">/,
    'the caption labels the score right above it, not from the card header',
  );
  assert.doesNotMatch(pageSource, /dashboard-radar-score/, 'the header no longer carries a second, detached caption');
  assert.match(pageSource, /<div className="index-score"><strong>\{profileScore === null \? '—' : `\$\{profileScore\}%`\}<\/strong><b>\/ 100<\/b><em>/);
  assert.match(pageSource, /<Progress value=\{profileScore \|\| 0\}/);
  assert.match(pageSource, /\{MATURITY_LEVELS\.map\(\(level\) => <span key=\{level\}>\{level\}<\/span>\)\}/);
  assert.match(pageSource, /До уровня «\$\{profileNextLevel\.name\}» — \$\{Math\.max\(0, profileNextLevel\.threshold - profileScore\)\}%/);

  assert.match(
    pageSource,
    /<Card className="dashboard-radar-card" view="outlined"><div className="dashboard-radar-side">/,
    'the title and the score share the left column so the radar can own the full height',
  );
  const card = pageSource.slice(
    pageSource.indexOf('<Card className="dashboard-radar-card"'),
    pageSource.indexOf('</Card>', pageSource.indexOf('<Card className="dashboard-radar-card"')),
  );
  const side = card.indexOf('dashboard-radar-side');
  assert.ok(side >= 0 && card.indexOf('</div><div className="dashboard-radar">') > side, 'the radar is a sibling of the side column, not nested in it');
  assert.doesNotMatch(pageSource, /dashboard-radar-body/, 'the old stacked wrapper is gone');

  const stylesSource = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  assert.match(
    stylesSource,
    /\.dashboard-radar-card \{ display: grid; grid-template-columns: minmax\(0, 250px\) minmax\(0, 1fr\); align-items: stretch; gap: 20px; \}/,
    'the card itself splits, so the radar column runs the whole card height',
  );
  assert.match(stylesSource, /\.dashboard-radar-side \{ min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax\(0, 1fr\); \}/);
  assert.match(
    stylesSource,
    /\.dashboard-index-summary \{ min-width: 0; padding: 0; justify-content: center;/,
    'index-card already fills the column with flex-start, so only justify-content moves the score off the top',
  );
  assert.match(
    stylesSource,
    /\.dashboard-radar \{ min-width: 0; min-height: 226px; align-self: stretch; height: auto; \}/,
    'the chart fills the card height instead of floating in a fixed box',
  );
  assert.match(stylesSource, /\.dashboard-radar-card \{ grid-template-columns: 1fr; \}/, 'the card stacks on narrow screens');
});

test('the card keeps its markup in the stylesheet', () => {
  const cardSource = readFileSync(new URL('./DataMaturityCard.jsx', import.meta.url), 'utf8');
  assert.match(cardSource, /import \{Card, Icon, Label\} from '@gravity-ui\/uikit';/);
  assert.match(cardSource, /import \{CaretDown, CaretUp, ChevronDown, ChevronRight\} from '@gravity-ui\/icons';/);
  assert.doesNotMatch(cardSource, /measuredCount/, 'the coverage counter is not shown on the card');
  assert.doesNotMatch(cardSource, /style=\{\{/, 'no inline styling outside the stylesheet');
});
