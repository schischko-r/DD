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
  assert.match(appSource, /const \[summaryFilters, setSummaryFilters\] = useState\(\{period: 'III кв\. 2026', unit: ''\}\)/);
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
  assert.match(stylesSource, /\.detail-controls\s*\{[^}]*grid-template-columns:\s*160px 160px 220px;/s);
  assert.match(stylesSource, /@media \(max-width: 900px\) \{[^\n]*\.detail-header\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*\}[^\n]*\.detail-controls\s*\{[^}]*grid-template-columns:\s*1fr;/);
});

test('team profile removes the replaced AI recommendations section toggle', () => {
  assert.doesNotMatch(profileSource, /detail-section-select/);
  assert.match(profileSource, /SegmentedRadioGroup aria-label=\{`Сегмент:/);
  assert.doesNotMatch(profileSource, /ProductMetricBlocks|setLens\(|lens === 'metrics'/);
  assert.match(profileSource, /const openConfiguredSkill = \(recommendation\) => \{[\s\S]*setReportAccessOpen\(true\);/);
});


test('profile and Dashboard share the lifted period and scope profile data to that period', () => {
  const dashboardSource=readFileSync(new URL('./DashboardPage.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(appSource,/const \[teamProfilePeriod|setTeamProfilePeriod/);
  assert.match(appSource,/resolveTeamProfileSelection\(profileProducts, \{\.\.\.summaryFilters, selected\}\)/);
  assert.match(appSource,/<TeamProfilePage [^>]*products=\{teamSelection\.products\}/);
  assert.match(appSource,/periods=\{teamSelection\.periods\} period=\{teamSelection\.period\} onPeriodChange=\{\(period\) => updateSummaryFilters\(\{period\}\)\}/);
  assert.match(dashboardSource,/const period = summaryFilters\?\.period \|\| periods\[0\] \|\| ''/);
  assert.match(dashboardSource,/onSummaryFiltersChange\(\{period: value\[0\] \|\| ''\}\)/);
  assert.match(appSource,/const openProduct = \(item\) => \{[\s\S]*?updateSummaryFilters\(\{period: item\.period \|\| ''\}\)/);
  assert.match(appSource,/teamSelection\.unit !== summaryFilters\.unit\) updateSummaryFilters\(\{unit: teamSelection\.unit\}\)/);
  assert.match(appSource,/teamSelection\.product !== selected\) setSelected\(teamSelection\.product\)/);
});

test('profile presents controlled period, unit and team selectors in that order',()=>{
  assert.match(profileSource,/detail-period-filter/);
  assert.ok(profileSource.indexOf('detail-period-filter')<profileSource.indexOf('detail-team-unit-filter'));
  assert.ok(profileSource.indexOf('detail-team-unit-filter')<profileSource.indexOf('detail-team-select'));
  assert.match(profileSource,/value=\{period \? \[period\] : \[\]\}/);
  assert.match(profileSource,/onPeriodChange\(value\[0\] \|\| ''\)/);
});


test('profile and Summary use their period-scoped rows and missing scores stay unavailable',()=>{
  assert.match(appSource,/const rows = data\.title\?\.rows \|\| \[\]/);
  assert.match(appSource,/const profileRows = filterTitleRowsByPeriod\(rows, data\.products, teamSelection\.period\)/);
  assert.match(appSource,/<TeamProfilePage [^>]*rows=\{profileRows\}/);
  assert.match(appSource,/<DashboardPage [^>]*rows=\{summaryData\.rows\}/);
  assert.match(appSource,/<SummaryPage [^>]*rows=\{rows\}/);
  assert.match(profileSource,/const hasScore = product\.isPlaceholder \? completedScore !== null/);
  assert.match(profileSource,/completeProductPercent\(product\)/);
  assert.match(profileSource,/const nextLevel = hasScore \? nextMaturityLevel\(score\) : null/);
  assert.match(profileSource,/hasScore \? `\$\{score\}%` : '—'/);
  assert.match(profileSource,/hasScore && !nextLevel && <LeaderConfetti/);
  assert.match(profileSource,/Нет данных об индексе за выбранный период/);
});

test('Dashboard and profile share the period catalog and keep an empty quarter explicitly empty',()=>{
  const dashboard=readFileSync(new URL('./DashboardPage.jsx',import.meta.url),'utf8');
  assert.match(dashboard,/getReportPeriods\(products\)/);
  const guard=dashboard.indexOf('if (!periodProducts.length)');assert.ok(guard>0);
  const empty=dashboard.slice(guard,dashboard.indexOf('\n  return (',guard));
  assert.ok(empty.includes('{dashboardHeader}'));
  assert.ok(empty.includes('Данные ещё не добавлены'));
  assert.doesNotMatch(empty,/RadarChart|<Chart|dashboard-category-card|dashboard-maturity|averageScore/);
  assert.ok(guard>dashboard.lastIndexOf('useMemo('),'Empty branch does not conditionally skip hooks');
  assert.match(appSource,/product[\s\S]*?<TeamProfilePage [\s\S]*?: <main className="content detail-page">[\s\S]*?teamSelection\.periods\.map[\s\S]*?Данные ещё не добавлены/);
});


test('period profiles are memoized and Summary receives the current cohort with historical products',()=>{
  assert.match(appSource,/const profileProducts = useMemo\(\(\) => buildDdiPeriodProducts\(data\?\.products \|\| \[\], summaryFilters\.period, Q3_OVERLAYS, salaryProductsQ32026, reportingMissingQ32026, funnelActionMissingQ32026\), \[data, summaryFilters\.period\]\)/);
  assert.match(appSource,/<DashboardPage products=\{summaryData\.products\}/);
  assert.match(appSource,/product\?\.isPlaceholder \? \[\] : CJXPLORER_PRODUCT_ALIASES/);
});
