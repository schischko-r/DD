import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const dashboardSource = readFileSync(new URL('./DashboardPage.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const reportData = JSON.parse(readFileSync(new URL('../../public/report-data.json', import.meta.url), 'utf8'));

test('every unit leaves at least one category empty, so the three-card row cannot stay', () => {
  const rows = reportData.title.rows;
  const units = [...new Set(rows.map((row) => row.unit))];
  assert.ok(units.length > 1);

  for (const unit of units) {
    const types = new Set(rows.filter((row) => row.unit === unit).map((row) => row.type.toLowerCase()));
    assert.ok(types.size < 3, `${unit} would fill all three cards, which no unit does`);
  }
});

test('a picked unit gets the strip and only for categories that have teams', () => {
  assert.match(
    dashboardSource,
    /const filledCategoryCards = categoryCards\.filter\(\(category\) => category\.items\.length\);/,
    'an empty category is dropped rather than rendered as a card of zeros',
  );
  assert.match(dashboardSource, /\{unit \? <Card className="dashboard-category-strip"/);
  assert.match(dashboardSource, /\{filledCategoryCards\.map\(\(category\) => <CategorySummaryRow/);
  assert.match(
    dashboardSource,
    /<\/Card> : <section className="dashboard-category-grid"/,
    'without a unit all three categories carry data and keep their cards',
  );
});

test('the strip keeps both catalog entry points the cards had', () => {
  assert.match(dashboardSource, /onOpenAll=\{\(\) => \{ setCatalogMaturity\(null\); setCatalogType\(category\.typeLabel\); \}\}/);
  assert.match(dashboardSource, /onOpenLevel=\{\(level\) => \{ setCatalogMaturity\(level\); setCatalogType\(category\.typeLabel\); \}\}/);
  assert.match(dashboardSource, /onClick=\{\(\) => onOpenLevel\(level\)\}/, 'a segment opens the catalog filtered by that level');
});

test('the maturity split is one bar sized by the counts, with empty levels left out', () => {
  assert.match(
    dashboardSource,
    /\{\[\.\.\.category\.maturityCounts\]\.reverse\(\)\.filter\(\(level\) => level\.count\)\.map\(\(level\) => \(\s*<button/,
    'a level with no teams gets no segment, and the bar climbs from the weakest level',
  );
  const levels = dashboardSource.slice(dashboardSource.indexOf('const maturityLevels'), dashboardSource.indexOf('const categoryCards'));
  assert.match(
    levels,
    /'success'[\s\S]*'info'[\s\S]*'warning'[\s\S]*'danger'/,
    'the card list still runs leaders first, so only the bar reverses',
  );
  assert.match(dashboardSource, /style=\{\{flexGrow: level\.count\}\}/, 'the segment width carries the share');
  assert.match(dashboardSource, /aria-label=\{`\$\{level\.label\}: \$\{level\.count\} из \$\{total\}`\}/);
  assert.match(
    dashboardSource,
    /<div className="dashboard-category-row-score"[\s\S]{0,220}?<strong>\{category\.average\}%<\/strong>/,
    'each category reports its own average, which the unit profile does not break down',
  );
  assert.match(dashboardSource, /\{category\.average === null \? <span>—<\/span>/, 'a category without scores shows no number');
  assert.match(
    stylesSource,
    /\.dashboard-category-row \{[^}]*grid-template-columns: minmax\(150px, 210px\) minmax\(0, 1fr\) 74px;/,
    'the score sits after the bar, not between the name and it',
  );
  const row = dashboardSource.slice(dashboardSource.indexOf('function CategorySummaryRow'), dashboardSource.indexOf('function CategoryStripLegend'));
  assert.ok(
    row.indexOf('dashboard-split-bar') < row.indexOf('dashboard-category-row-score'),
    'the bar comes first in the row',
  );
});

test('one legend serves the whole strip, in the same order as the bar', () => {
  assert.match(dashboardSource, /function CategoryStripLegend\(\{categories\}\)/);
  assert.match(dashboardSource, /<CategoryStripLegend categories=\{filledCategoryCards\} \/>/);
  assert.match(
    dashboardSource,
    /const levels = \[\.\.\.\(categories\[0\]\?\.maturityCounts \|\| \[\]\)\]\.reverse\(\)\.filter\(\(level\) => present\.has\(level\.theme\)\);/,
    'the legend lists only levels some category actually has',
  );
  assert.doesNotMatch(dashboardSource, /dashboard-category-row-legend/, 'the per-row legend is gone');
  assert.match(stylesSource, /\.dashboard-split-legend \{[^}]*border-top: 1px solid/);
});

test('the strip is a fraction of the height the cards reserved', () => {
  assert.match(stylesSource, /\.dashboard-category-card \{[^}]*min-height: 194px;/, 'the card row cost 194px per card');
  assert.match(stylesSource, /\.dashboard-category-row \{ min-height: 52px;/);
  assert.match(stylesSource, /\.dashboard-split-bar \{ min-width: 0; height: 18px;/, 'the bar is a thin rule, not a block');
  assert.match(stylesSource, /\.dashboard-category-strip \{ padding: 6px 18px;/);
  assert.match(
    stylesSource,
    /\.dashboard-category-card, \.dashboard-category-strip, \.dashboard-radar-card, \.dashboard-antitop-card \{[^}]*background: var\(--g-color-base-background\);/,
    'the strip takes the same white card ground as the rest of the dashboard',
  );
  for (const tone of ['success', 'info', 'warning', 'danger']) {
    const token = tone === 'success' ? 'positive' : tone;
    assert.match(
      stylesSource,
      new RegExp(`\\.dashboard-split-segment\\.tone-${tone} \\{ background: var\\(--g-color-base-${token}-light-hover\\); box-shadow: inset 0 0 0 1px var\\(--g-color-line-${token}\\); \\}`),
      'one tier up the Gravity alpha scale, inside a toned border',
    );
    assert.match(stylesSource, new RegExp(`\\.dashboard-split-legend-item\\.tone-${tone}::before \\{ background: var\\(--g-color-base-${token}-light-hover\\);`));
  }
  assert.doesNotMatch(
    stylesSource,
    /\.dashboard-split-segment\.tone-[a-z]+ \{ background: var\(--g-color-base-[a-z]+-heavy\)/,
    'the heavy fill is gone',
  );
  assert.match(
    stylesSource,
    /\.dashboard-split-segment \{ color: var\(--g-color-text-primary\); \}/,
    'the count stays neutral: heavy yellow on a yellow ground fell far below a readable contrast',
  );
});

test('the strip classes cannot collide with the tone class a card gets', () => {
  const tones = [...dashboardSource.matchAll(/tone: '([a-z]+)'\}/g)].map((match) => match[1]);
  assert.deepEqual(tones, ['product', 'segment', 'channel'], 'a card is classed dashboard-category-<tone>');

  const stripClasses = [...stylesSource.matchAll(/\.(dashboard-split-[a-z-]+)/g)].map((match) => match[1]);
  assert.ok(stripClasses.length > 0);
  for (const tone of tones) {
    assert.ok(
      !stripClasses.includes(`dashboard-category-${tone}`),
      `.dashboard-category-${tone} belongs to the card tone; the strip must not reuse it`,
    );
  }
  assert.doesNotMatch(
    dashboardSource,
    /className=\{?`?dashboard-category-segment/,
    'the segments card once lost its title to a strip rule of the same name',
  );
  assert.match(
    stylesSource,
    /\.dashboard-category-product, \.dashboard-category-segment, \.dashboard-category-channel \{ background: var\(--g-color-base-background\); \}/,
    'the card tone rule still names all three tones',
  );
});
