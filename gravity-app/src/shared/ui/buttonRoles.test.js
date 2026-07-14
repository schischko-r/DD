import test from 'node:test';
import assert from 'node:assert/strict';
import {BUTTON_INTENT, buttonPropsFor} from './buttonRoles.js';

test('semantic button roles have one stable Gravity UI presentation', () => {
  assert.deepEqual(buttonPropsFor(BUTTON_INTENT.primary), {view: 'action', size: 'm'});
  assert.deepEqual(buttonPropsFor(BUTTON_INTENT.secondary), {view: 'outlined-info', size: 'm'});
  assert.deepEqual(buttonPropsFor(BUTTON_INTENT.navigation), {view: 'flat', size: 'm'});
  assert.deepEqual(buttonPropsFor(BUTTON_INTENT.destructive), {view: 'outlined-danger', size: 's'});
  assert.deepEqual(buttonPropsFor(BUTTON_INTENT.compactIcon), {view: 'flat', size: 's'});
  assert.throws(() => buttonPropsFor('unknown'), /Unknown semantic button intent/);
});
