import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const dashboardSource = readFileSync(new URL('./DashboardPage.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('the anti-top card previews four zones and keeps ten for the dialog', () => {
  assert.match(dashboardSource, /const ANTITOP_PREVIEW_SIZE = 4;/);
  assert.match(dashboardSource, /const ANTITOP_FULL_SIZE = 10;/);
  assert.match(dashboardSource, /compareNames\(a\.name, b\.name\)\)\.slice\(0, ANTITOP_FULL_SIZE\);/);
  assert.match(
    dashboardSource,
    /<div className="dashboard-antitop-list">\{antiTop\.slice\(0, ANTITOP_PREVIEW_SIZE\)\.map\(/,
    'the card itself shows only the worst four',
  );
});

test('the full ten open in a dialog behind one narrow, full-width control', () => {
  assert.match(
    dashboardSource,
    /\{antiTop\.length > ANTITOP_PREVIEW_SIZE && <div className="dashboard-antitop-more">/,
    'with four or fewer zones there is nothing more to show',
  );
  assert.match(
    dashboardSource,
    /<Button view="flat" size="s" width="max" onClick=\{\(\) => setAntiTopOpen\(true\)\}>Показать ещё <Icon data=\{ChevronDown\} size=\{13\} \/><\/Button>/,
  );
  assert.match(dashboardSource, /<Dialog open=\{antiTopOpen\} onClose=\{\(\) => setAntiTopOpen\(false\)\}/);
  assert.match(dashboardSource, /<Dialog\.Header caption="Ключевые западающие зоны" \/>/);
  assert.match(
    dashboardSource,
    /dashboard-antitop-list-full">\{antiTop\.map\(/,
    'the dialog lists every zone, not another slice',
  );

  assert.match(stylesSource, /\.dashboard-antitop-more \{ border-top: 1px solid var\(--g-color-line-generic\); \}/);
  assert.match(stylesSource, /\.dashboard-antitop-more \.g-button \{ --g-button-height: 30px; color: var\(--g-color-text-secondary\); font-size: 12px; \}/);
});

test('card and dialog render the same row, so the two lists cannot drift apart', () => {
  assert.match(dashboardSource, /function AntiTopRow\(\{item, position, onHover\}\)/);
  const rows = dashboardSource.match(/<AntiTopRow /g) || [];
  assert.equal(rows.length, 2, 'the card and the dialog both reuse it');
  assert.doesNotMatch(
    dashboardSource,
    /<div className="dashboard-antitop-row" key=/,
    'no hand-rolled copy of the row markup is left behind',
  );
  assert.match(dashboardSource, /<AntiTopRow key=\{`\$\{item\.block\}-\$\{item\.name\}`\} item=\{item\} position=\{index \+ 1\} onHover=\{setHoveredBlock\} \/>/, 'only the card rows drive the radar highlight');
});

test('the row pair is short enough that four zones fill the card', () => {
  assert.match(
    stylesSource,
    /\.dashboard-radar-card, \.dashboard-antitop-card \{ min-height: 286px; padding: 20px; \}/,
    'the old 430px floor left the four-row card half empty',
  );
  assert.match(stylesSource, /\.dashboard-antitop-row \{ min-height: 44px;/);
  assert.match(stylesSource, /\.dashboard-index-summary strong \{ font-size: 30px; \}/, 'the score scales with the shorter card');
  assert.match(stylesSource, /\.dashboard-index-summary \.g-progress \{ margin: 12px 0 8px; \}/);
});
