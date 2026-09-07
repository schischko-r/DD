import test from 'node:test';
import assert from 'node:assert/strict';
import {MATURITY_LEVELS, maturityLevelName, nextMaturityLevel} from './report.js';

test('a score names its level on the same thresholds the next-level hint uses', () => {
  assert.deepEqual(MATURITY_LEVELS, ['Требуют внимания', 'Развивающиеся', 'Зрелые', 'Лидеры Data Driven']);
  assert.equal(maturityLevelName(0), 'Требуют внимания');
  assert.equal(maturityLevelName(39), 'Требуют внимания');
  assert.equal(maturityLevelName(40), 'Развивающиеся');
  assert.equal(maturityLevelName(60), 'Развивающиеся');
  assert.equal(maturityLevelName(61), 'Зрелые');
  assert.equal(maturityLevelName(80), 'Зрелые');
  assert.equal(maturityLevelName(81), 'Лидеры Data Driven');
  assert.equal(maturityLevelName(null), '');

  for (const score of [10, 45, 70]) {
    const next = nextMaturityLevel(score);
    assert.ok(next, `a score of ${score} still has somewhere to climb`);
    assert.equal(maturityLevelName(next.threshold), next.name, 'the hint names the level its threshold lands in');
  }
  assert.equal(nextMaturityLevel(95), null);
});
