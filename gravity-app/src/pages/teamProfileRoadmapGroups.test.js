import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  compareRoadmapDueDates,
  compareRoadmapQuarters,
  flattenRoadmapItems,
  groupRoadmapItems,
} from './teamProfileRoadmapGroups.js';

function permutations(values) {
  if (values.length < 2) return [values];
  return values.flatMap((value, index) => permutations(values.toSpliced(index, 1))
    .map((permutation) => [value, ...permutation]));
}

function assertComparatorLaws(comparator, values) {
  for (const left of values) {
    for (const right of values) {
      const forward = Math.sign(comparator(left, right));
      const reverse = Math.sign(comparator(right, left));
      assert.equal(
        forward,
        reverse === 0 ? 0 : -reverse,
        `antisymmetry failed for ${JSON.stringify(left)} and ${JSON.stringify(right)}`,
      );

      for (const third of values) {
        if (comparator(left, right) <= 0 && comparator(right, third) <= 0) {
          assert.ok(
            comparator(left, third) <= 0,
            `transitivity failed for ${JSON.stringify(left)}, ${JSON.stringify(right)}, and ${JSON.stringify(third)}`,
          );
        }
      }
    }
  }
}

test('roadmap development blocks keep their stable first-seen order', () => {
  const groups = groupRoadmapItems([
    {development_block: 'Воронка', quarter: '4Q', due_date: '4Q', planned_activity: 'first'},
    {development_block: 'Цели', quarter: '3Q', due_date: '3Q', planned_activity: 'second'},
    {development_block: 'Воронка', quarter: '3Q', due_date: '3Q', planned_activity: 'third'},
    {development_block: '', quarter: '', due_date: '', planned_activity: 'fourth'},
  ]);

  assert.deepEqual(groups.map(({label}) => label), ['Воронка', 'Цели', 'Не указано']);
  assert.deepEqual(
    groups[0].quarters.flatMap(({dueDates}) => dueDates.flatMap(({items}) => items.map(({planned_activity}) => planned_activity))),
    ['third', 'first'],
  );
});

test('roadmap quarters sort naturally across supported 1Q–4Q variants', () => {
  const values = ['Q4', '3Q2026', '1 квартал 2026', 'Q22026', 'Не указано'];
  assert.deepEqual([...values].sort(compareRoadmapQuarters), [
    '1 квартал 2026',
    'Q22026',
    '3Q2026',
    'Q4',
    'Не указано',
  ]);
  assert.ok(compareRoadmapQuarters('4Q2025', '1Q2026') < 0);
});

test('roadmap comparators produce the same mixed-year order for every input permutation', () => {
  const values = ['1Q', '4Q2025', '1Q2026'];
  const expected = ['4Q2025', '1Q2026', '1Q'];

  for (const comparator of [compareRoadmapQuarters, compareRoadmapDueDates]) {
    for (const permutation of permutations(values)) {
      assert.deepEqual([...permutation].sort(comparator), expected);
    }
  }
});

test('roadmap comparators are antisymmetric and transitive across mixed value classes', () => {
  assertComparatorLaws(compareRoadmapQuarters, [
    '4Q2025',
    '1Q2026',
    '1Q',
    'Q4',
    'Этап 10',
    'Этап 2',
    'Не указано',
  ]);
  assertComparatorLaws(compareRoadmapDueDates, [
    '4Q2025',
    '2026-01-15',
    '1Q2026',
    '15.02',
    'Q4',
    'октябрь — рост',
    'Этап 2',
    'Не указано',
  ]);
});

test('roadmap due dates sort ISO and embedded dotted dates chronologically', () => {
  const values = [
    'Проведение встреч до 31.08.2026',
    '2026-10-30',
    '2026-08-05',
    'до 14.08.2026',
  ];
  assert.deepEqual([...values].sort(compareRoadmapDueDates), [
    '2026-08-05',
    'до 14.08.2026',
    'Проведение встреч до 31.08.2026',
    '2026-10-30',
  ]);
});

test('roadmap due dates understand quarters, Russian months, and natural text', () => {
  assert.deepEqual(['4Q', 'Q3', '2Q', '1 квартал'].sort(compareRoadmapDueDates), [
    '1 квартал',
    '2Q',
    'Q3',
    '4Q',
  ]);
  assert.deepEqual(['ноябрь — запуск', 'сентябрь — пилот', 'октябрь — рост'].sort(compareRoadmapDueDates), [
    'сентябрь — пилот',
    'октябрь — рост',
    'ноябрь — запуск',
  ]);
  assert.deepEqual(['Этап 10', 'Не указано', 'Этап 2'].sort(compareRoadmapDueDates), [
    'Этап 2',
    'Этап 10',
    'Не указано',
  ]);
});

test('roadmap items are nested by block, quarter, and due date without reordering rows', () => {
  const groups = groupRoadmapItems([
    {development_block: 'Цели', quarter: '4Q', due_date: '2026-10-30', source_row: 3},
    {development_block: 'Цели', quarter: '3Q', due_date: '2026-08-31', source_row: 1},
    {development_block: 'Цели', quarter: '3Q', due_date: '2026-08-05', source_row: 2},
    {development_block: 'Цели', quarter: '3Q', due_date: '2026-08-05', source_row: 4},
  ]);

  assert.deepEqual(groups[0].quarters.map(({label}) => label), ['3Q', '4Q']);
  assert.deepEqual(groups[0].quarters[0].dueDates.map(({label}) => label), ['2026-08-05', '2026-08-31']);
  assert.deepEqual(groups[0].quarters[0].dueDates[0].items.map(({source_row}) => source_row), [2, 4]);
});

test('flattened roadmap rows calculate the block, quarter, and due-date rowSpan hierarchy', () => {
  const items = [
    {development_block: 'Цели', quarter: '2Q', due_date: '2026-06-30', source_row: 4},
    {development_block: 'Цели', quarter: '1Q', due_date: '2026-01-31', source_row: 1},
    {development_block: 'Цели', quarter: '1Q', due_date: '2026-01-31', source_row: 2},
    {development_block: 'Цели', quarter: '1Q', due_date: '2026-03-31', source_row: 3},
    {development_block: '', quarter: '', due_date: '', source_row: 5},
  ];
  const rows = flattenRoadmapItems(items);

  assert.deepEqual(rows.map((row) => ({
    sourceRow: row.item.source_row,
    block: row.blockLabel,
    blockRowSpan: row.blockRowSpan,
    quarter: row.quarterLabel,
    quarterRowSpan: row.quarterRowSpan,
    dueDate: row.dueDateLabel,
    dueDateRowSpan: row.dueDateRowSpan,
  })), [
    {sourceRow: 1, block: 'Цели', blockRowSpan: 4, quarter: '1Q', quarterRowSpan: 3, dueDate: '2026-01-31', dueDateRowSpan: 2},
    {sourceRow: 2, block: 'Цели', blockRowSpan: 0, quarter: '1Q', quarterRowSpan: 0, dueDate: '2026-01-31', dueDateRowSpan: 0},
    {sourceRow: 3, block: 'Цели', blockRowSpan: 0, quarter: '1Q', quarterRowSpan: 0, dueDate: '2026-03-31', dueDateRowSpan: 1},
    {sourceRow: 4, block: 'Цели', blockRowSpan: 0, quarter: '2Q', quarterRowSpan: 1, dueDate: '2026-06-30', dueDateRowSpan: 1},
    {sourceRow: 5, block: 'Не указано', blockRowSpan: 1, quarter: 'Не указано', quarterRowSpan: 1, dueDate: 'Не указано', dueDateRowSpan: 1},
  ]);
});

test('flattening preserves all 204 source item identities without loss or duplication', () => {
  const report = JSON.parse(readFileSync(new URL('../../public/report-data.json', import.meta.url), 'utf8'));
  const items = report.products.flatMap((product) => product.roadmap?.items || []);
  const flattenedItems = report.products.flatMap((product) => flattenRoadmapItems(product.roadmap?.items).map((row) => row.item));

  assert.equal(items.length, 204);
  assert.equal(flattenedItems.length, 204);
  assert.equal(new Set(flattenedItems).size, 204);
  assert.ok(items.every((item) => flattenedItems.includes(item)));
});
