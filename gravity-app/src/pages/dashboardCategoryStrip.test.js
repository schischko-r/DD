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
  assert.doesNotMatch(dashboardSource, /CategorySummaryRow[\s\S]{0,900}?Средний Data-Driven Index/, 'the average is not repeated above the unit profile');
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
  assert.match(stylesSource, /\.dashboard-category-strip-legend \{[^}]*border-top: 1px solid/);
});

test('the strip is a fraction of the height the cards reserved', () => {
  assert.match(stylesSource, /\.dashboard-category-card \{[^}]*min-height: 194px;/, 'the card row cost 194px per card');
  assert.match(stylesSource, /\.dashboard-category-row \{ min-height: 52px;/);
  assert.match(stylesSource, /\.dashboard-category-row-split \{ min-width: 0; height: 16px;/, 'the bar is a thin rule, not a block');
  assert.match(stylesSource, /\.dashboard-category-strip \{ padding: 6px 18px;/);
  assert.match(
    stylesSource,
    /\.dashboard-category-card, \.dashboard-category-strip, \.dashboard-radar-card, \.dashboard-antitop-card \{[^}]*background: var\(--g-color-base-background\);/,
    'the strip takes the same white card ground as the rest of the dashboard',
  );
  for (const tone of ['success', 'info', 'warning', 'danger']) {
    assert.match(stylesSource, new RegExp(`\\.dashboard-category-segment\\.tone-${tone} \\{ background: var\\(--g-color-base-`));
    assert.match(stylesSource, new RegExp(`\\.dashboard-category-legend-item\\.tone-${tone}::before \\{ background: var\\(--g-color-base-`));
  }
});
