import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const profileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const summarySource = readFileSync(new URL('./SummaryPage.jsx', import.meta.url), 'utf8');

test('App shares the Summary unit filter with the team profile', () => {
  assert.doesNotMatch(appSource, /teamProfileUnit|setTeamProfileUnit/);
  assert.match(
    appSource,
    /<TeamProfilePage [^>]*teamUnit=\{summaryFilters\.unit\} onTeamUnitChange=\{\(unit\) => updateSummaryFilters\(\{unit\}\)\}/,
  );
  assert.match(
    profileSource,
    /export function TeamProfilePage\(\{[^}]*teamUnit, onTeamUnitChange[^}]*\}\)/,
  );
  assert.doesNotMatch(profileSource, /const \[teamUnit, setTeamUnit\] = useState\(/);
  assert.match(profileSource, /const updateTeamUnit = \(value\) => \{[\s\S]*onTeamUnitChange\(nextUnit\);/);
});

test('team profile unit filter limits the team selector with its controlled value', () => {
  assert.match(profileSource, /const teamUnits = useMemo\(/);
  assert.match(profileSource, /const filteredTeamProducts = useMemo\(/);
  assert.match(profileSource, /<span>Юнит<\/span><Select value=\{teamUnit \? \[teamUnit\] : \[\]\}/);
  assert.match(profileSource, /<Select\.Option value="">Все юниты<\/Select\.Option>/);
  assert.match(profileSource, /filteredTeamProducts\.map\(\(item\) => <Select\.Option/);
});

test('opening a Dashboard product synchronizes the lifted unit before showing its profile', () => {
  assert.match(
    appSource,
    /const openProduct = \(item\) => \{[\s\S]*?updateSummaryFilters\(\{unit: item\.unit && isUnitFilterOption\(item\.unit\) \? item\.unit : ''\}\);[\s\S]*?setSelected\(item\);[\s\S]*?setView\('detail'\);/,
  );
});

test('both Summary views use the same lifted unit filter', () => {
  assert.match(appSource, /const \[summaryFilters, setSummaryFilters\] = useState\(\{period: '', unit: ''\}\)/);
  assert.match(
    appSource,
    /<DashboardPage [^>]*summaryFilters=\{summaryFilters\} onSummaryFiltersChange=\{updateSummaryFilters\}/,
  );
  assert.match(appSource, /<SummaryPage [^>]*unitFilter=\{summaryFilters\.unit\} onUnitFilterChange=\{\(unit\) => updateSummaryFilters\(\{unit\}\)\}/);
  assert.match(summarySource, /const unit = unitFilter \? \[unitFilter\] : \[\]/);
  assert.match(summarySource, /<Select value=\{unit\} onUpdate=\{\(value\) => onUnitFilterChange\?\.\(value\[0\] \|\| ''\)\}/);
});

test('team profile controls stay beside the heading without overlapping', () => {
  const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(stylesSource, /\.detail-header\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/s);
  assert.match(stylesSource, /\.detail-controls\s*\{[^}]*grid-template-columns:\s*160px 220px;/s);
  assert.match(stylesSource, /@media \(max-width: 900px\) \{[^\n]*\.detail-header\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*\}[^\n]*\.detail-controls\s*\{[^}]*grid-template-columns:\s*1fr;/);
});

test('team profile removes the replaced AI recommendations section toggle', () => {
  assert.doesNotMatch(profileSource, /SegmentedRadioGroup|detail-section-select/);
  assert.doesNotMatch(profileSource, /ProductMetricBlocks|setLens\(|lens === 'metrics'/);
  assert.match(profileSource, /const openConfiguredSkill = \(recommendation\) => \{[\s\S]*setReportAccessOpen\(true\);/);
});
