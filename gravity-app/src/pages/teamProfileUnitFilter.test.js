import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const profileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');

test('team profile unit filter limits the team selector like Summary', () => {
  assert.match(profileSource, /const \[teamUnit, setTeamUnit\] = useState\(''\)/);
  assert.match(profileSource, /const teamUnits = useMemo\(/);
  assert.match(profileSource, /const filteredTeamProducts = useMemo\(/);
  assert.match(profileSource, /<span>Юнит<\/span><Select value=\{teamUnit \? \[teamUnit\] : \[\]\}/);
  assert.match(profileSource, /<Select\.Option value="">Все юниты<\/Select\.Option>/);
  assert.match(profileSource, /filteredTeamProducts\.map\(\(item\) => <Select\.Option/);
});

test('team profile controls stay beside the heading without overlapping', () => {
  const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(stylesSource, /\.detail-header\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/s);
  assert.match(stylesSource, /\.detail-controls\s*\{[^}]*grid-template-columns:\s*310px 160px 220px;/s);
  assert.match(stylesSource, /@media \(max-width: 900px\) \{[^\n]*\.detail-header\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*\}[^\n]*\.detail-controls\s*\{[^}]*grid-template-columns:\s*1fr;/);
});

test('compact section toggle does not overflow into the unit filter', () => {
  const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(profileSource, /<SegmentedRadioGroup value=\{lens\}.*width="max">/);
  assert.match(profileSource, /<SegmentedRadioGroup\.Option value="metrics"[^>]*>.*AI-рекомендации/s);
  assert.doesNotMatch(profileSource, /detail-section-select"><span>Раздел<\/span><Select value=\{\[lens\]\}/);
  assert.match(stylesSource, /\.detail-section-select \.g-segmented-radio-group__option-text\s*\{[^}]*margin:\s*0 6px;[^}]*font-size:\s*12px;/s);
});
