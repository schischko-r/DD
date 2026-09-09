import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const pageSource = readFileSync(new URL('./InitiativesBacklogPage.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const data = JSON.parse(readFileSync(new URL('../../public/initiatives-backlog.json', import.meta.url), 'utf8'));

test('the page reuses the metric block shell the other views already use', () => {
  assert.match(pageSource, /<Card className="metric-block initiatives-block"/);
  assert.match(pageSource, /<div className="dd-metric-block-head">/);
  assert.match(pageSource, /<Icon data=\{isOpen \? ChevronDown : ChevronRight\} size=\{14\} \/>/);
  assert.match(pageSource, /<div className="metric-list">/);
  assert.match(pageSource, /<div className=\{`metric-row initiatives-row/);
  assert.match(
    stylesSource,
    /\.metric-row\.initiatives-row \{ grid-template-columns: minmax\(0, 1fr\) auto;/,
    'the deadline hugs the right edge instead of filling the 230px badge column',
  );
  const styles = stylesSource.split('\n');
  const shared = styles.findIndex((line) => line.startsWith('.metric-row {'));
  const own = styles.findIndex((line) => line.startsWith('.metric-row.initiatives-row'));
  assert.ok(shared >= 0 && own > shared, 'the override has to come after the rule it overrides');
  assert.doesNotMatch(stylesSource, /\.initiatives-document \{[^}]*max-width/, 'the page runs full width like the rest of the app');
  assert.doesNotMatch(stylesSource, /\.metrics-grid\.initiatives-grid/, 'the cards keep the two columns the team page uses');
});

test('the header drops the column label it repeated once per block', () => {
  const blocks = new Set(data.map((item) => item.block));
  assert.ok(blocks.size > 5, 'there are enough blocks for the repetition to matter');
  assert.doesNotMatch(pageSource, /КЛЮЧЕВОЙ БЛОК DD-РЕЙТИНГА/, 'it names the column, not the block');
  assert.doesNotMatch(stylesSource, /\.initiatives-group-header/);
});

test('a row carries its own content instead of a repeated open link', () => {
  assert.doesNotMatch(pageSource, /Открыть →/, 'the whole row opens, so the link is redundant');
  assert.doesNotMatch(stylesSource, /\.initiatives-open-hint/);
  assert.match(
    pageSource,
    /const meta = \[item\.department, item\.owner\]\.filter\(Boolean\)\.join\(' · '\);/,
    'department and owner were invisible before',
  );
  const row = pageSource.slice(pageSource.indexOf('function InitiativeRow'), pageSource.indexOf('export function InitiativesBacklogPage'));
  assert.doesNotMatch(
    row.slice(0, row.indexOf('initiatives-row-detail')),
    /\{meta &&/,
    'the owner list outran the name it sat under, so it moved out of the collapsed row',
  );
  assert.match(row, /<\/section>\}\s*\{meta && <p className="initiatives-row-meta">\{meta\}<\/p>\}/, 'it closes the expanded card');
  assert.match(stylesSource, /\.initiatives-row-meta \{ grid-column: 1 \/ -1;[^}]*border-top: 1px solid/);
  assert.match(pageSource, /\{item\.asIs && <section><Text variant="subheader-1">Реализовано AS IS/);
  assert.match(pageSource, /\{item\.toBe && <section><Text variant="subheader-1">Мероприятия TO BE/);
  assert.doesNotMatch(pageSource, /<Dialog/, 'the detail opens in place');
});

test('an empty deadline shows nothing rather than a placeholder', () => {
  const empty = data.filter((item) => !String(item.deadline || '').trim());
  assert.ok(empty.length > 0, 'the data really does leave deadlines blank');
  assert.doesNotMatch(pageSource, /Срок не указан/);
  assert.match(pageSource, /\{deadline && <Label className="initiatives-row-deadline"/);
});

test('the effect field is not rendered while the data never fills it', () => {
  const filled = data.filter((item) => String(item.effect || '').trim());
  assert.equal(filled.length, 0, 'if effect starts arriving, this test should fail and the row should show it');
  assert.doesNotMatch(pageSource, /item\.effect/);
});

test('a block opens without a click, so one click reaches the detail', () => {
  assert.match(pageSource, /const \[closedBlocks, setClosedBlocks\] = useState\(\(\) => new Set\(\)\);/);
  assert.match(
    pageSource,
    /const isOpen = filtered \|\| !closedBlocks\.has\(group\.block\);/,
    'tracking what is closed keeps every block open on arrival',
  );
  assert.match(pageSource, /const filtered = block !== 'Все блоки' \|\| Boolean\(query\.trim\(\)\);/);
  assert.match(pageSource, /disabled=\{filtered\}/, 'a filtered list has nothing left to collapse');
});

test('helpers left without a call site are gone', () => {
  for (const name of ['CompactText', 'InitiativeInfo', 'PeopleList', 'HELP_POPOVER_PROPS']) {
    assert.doesNotMatch(pageSource, new RegExp(name), `${name} lost its last use with the dialog`);
  }
  assert.doesNotMatch(pageSource, /HelpMark|Dialog/);
});
