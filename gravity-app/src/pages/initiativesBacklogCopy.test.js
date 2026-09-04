import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const initiatives = JSON.parse(readFileSync(new URL('../../public/initiatives-backlog.json', import.meta.url), 'utf8'));

test('A/B initiative uses one Cyrillic А/В spelling throughout', () => {
  const item = initiatives.find((entry) => entry.block === 'Гипотезы и инициативы' && entry.metric === 'А/В-тесты');
  assert.ok(item);
  const copy = `${item.metric}\n${item.asIs}\n${item.toBe}`;
  assert.match(copy, /А\/В/);
  assert.doesNotMatch(copy, /A\/B|А\/Б|АБ-/u);
});
