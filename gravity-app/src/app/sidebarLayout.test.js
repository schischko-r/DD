import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const navigationConstants = readFileSync(
  new URL('../../node_modules/@gravity-ui/navigation/build/esm/components/constants.js', import.meta.url),
  'utf8',
);

test('sidebar uses the standard expanded and compact Gravity UI widths', () => {
  assert.match(navigationConstants, /ASIDE_HEADER_COMPACT_WIDTH\s*=\s*56/);
  assert.match(navigationConstants, /ASIDE_HEADER_EXPANDED_WIDTH\s*=\s*236/);
  assert.match(appSource, /const \[compact, setCompact\] = useState\(getInitialNavigationCompact\)/);
  assert.match(appSource, /compact=\{compact\}/);
  assert.match(appSource, /onChangeCompact=\{setCompact\}/);
  assert.doesNotMatch(appSource, /hideCollapseButton/);
});

test('sidebar starts compact on mobile and keeps localized collapse controls', () => {
  assert.match(appSource, /MOBILE_NAVIGATION_QUERY = '\(max-width: 760px\)'/);
  assert.match(appSource, /window\.matchMedia\(MOBILE_NAVIGATION_QUERY\)\.matches/);
  assert.match(appSource, /if \(matches\) setCompact\(true\)/);
  assert.match(appSource, /addEventListener\('change', collapseOnMobile\)/);
  assert.match(appSource, /removeEventListener\('change', collapseOnMobile\)/);
  assert.match(appSource, /collapseTitle="Свернуть меню"/);
  assert.match(appSource, /expandTitle="Развернуть меню"/);
});

test('sidebar brand icon and title share the same vertical center', () => {
  assert.match(stylesSource, /\.dd-navigation-logo\s*\{[^}]*display:\s*flex;/);
  assert.match(stylesSource, /\.dd-navigation-logo\s*\{[^}]*align-items:\s*center;/);
  assert.match(stylesSource, /\.dd-navigation-logo img\s*\{[^}]*display:\s*block;/);
});

test('sidebar preserves navigation items without the service-mode footer button', () => {
  for (const id of ['dashboard', 'detail', 'about']) {
    assert.match(appSource, new RegExp(`id: '${id}'`));
  }
  assert.doesNotMatch(appSource, /renderFooter=/);
  assert.doesNotMatch(appSource, /className="navigation-period"/);
});
