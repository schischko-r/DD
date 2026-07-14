import test from 'node:test';
import assert from 'node:assert/strict';
import {digestStatus, digestTheme, worstDigestLight} from './digestPresentation.js';

test('digest presentation preserves traffic-light semantics', () => {
  assert.equal(digestTheme('red'), 'danger');
  assert.equal(digestTheme('yellow'), 'warning');
  assert.equal(digestTheme('green'), 'success');
  assert.equal(digestTheme('gray'), 'normal');
  assert.equal(digestStatus('red'), 'Требует внимания');
  assert.equal(digestStatus('yellow'), 'Наблюдать');
  assert.equal(digestStatus('green'), 'Стабильно');
  assert.equal(digestStatus('gray'), 'Нет оценки');
});

test('worst digest light keeps existing priority order', () => {
  assert.equal(worstDigestLight([{traffic_light: 'green'}, {traffic_light: 'yellow'}]), 'yellow');
  assert.equal(worstDigestLight([{traffic_light: 'green'}, {traffic_light: 'red'}]), 'red');
  assert.equal(worstDigestLight([{}]), 'gray');
  assert.equal(worstDigestLight([]), 'gray');
});
