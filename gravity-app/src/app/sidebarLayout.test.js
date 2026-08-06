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
  assert.match(appSource, /const \[compact, setCompact\] = useState\(true\)/);
  assert.match(appSource, /compact=\{compact\}/);
  assert.match(appSource, /onChangeCompact=\{setCompact\}/);
  assert.doesNotMatch(appSource, /hideCollapseButton/);
});

test('sidebar starts compact on every viewport and keeps mobile collapse behavior', () => {
  assert.match(appSource, /const \[compact, setCompact\] = useState\(true\)/);
  assert.match(appSource, /MOBILE_NAVIGATION_QUERY = '\(max-width: 760px\)'/);
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

test('primary navigation icons use the blue informational accent', () => {
  for (const id of ['dashboard', 'detail', 'about']) {
    assert.match(
      appSource,
      new RegExp(`id: '${id}'[\\s\\S]*?qa: 'dd-primary-navigation'`),
    );
  }
  assert.match(
    stylesSource,
    /\.dd-navigation \[data-qa='dd-primary-navigation'\] svg\s*\{[^}]*color:\s*var\(--g-color-text-info\);/,
  );
});

test('sidebar puts generated HTML pages and backlog below one divider in the main navigation', () => {
  for (const id of ['dashboard', 'detail', 'about']) {
    assert.match(appSource, new RegExp(`id: '${id}'`));
  }
  assert.match(appSource, /import \{Spin\} from '@gravity-ui\/uikit'/);
  assert.match(appSource, /import \{AsideHeader\} from '@gravity-ui\/navigation'/);
  assert.match(appSource, /BACKLOG_DECOMPOSITION_ENABLED = import\.meta\.env\.VITE_BACKLOG_DECOMPOSITION_ENABLED !== 'false'/);
  assert.match(appSource, /id: 'skills-divider',[\s\S]*?type: 'divider'/);
  assert.match(appSource, /id: 'skills-divider',[\s\S]*?HTML_PAGE_TOOLS\.map[\s\S]*?BACKLOG_DECOMPOSITION_ENABLED \? \[\{[\s\S]*?id: 'backlog'/);
  assert.match(appSource, /id: 'backlog',[\s\S]*?current: view === 'backlog'/);
  assert.doesNotMatch(appSource, /renderFooter=|FooterItem|<Divider \/>/);
  assert.doesNotMatch(appSource, /backlog-v2|BacklogDecompositionV2Page|openBacklogV2/);
  assert.doesNotMatch(stylesSource, /dd-navigation-backlog-footer|\.gn-footer-item/);
  assert.doesNotMatch(appSource, /className="navigation-period"/);
});
