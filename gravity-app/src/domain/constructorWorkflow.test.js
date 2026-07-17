import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWorkflowChange,
  createWorkflowEml,
  setWorkflowReady,
  shouldInvalidateReadyForInput,
  workflowState,
} from './constructorWorkflow.js';
import {ensureConstructorDocument, updateMetricValues, updateTeam} from './reportEditor.js';

function fixture() {
  return ensureConstructorDocument({
    products: [{
      id: 'team-1',
      name: 'Команда',
      unit: 'Юнит',
      type: 'Продукт',
      metrics: [{
        code: 'main',
        name: 'Блок',
        metrics: [{
          code: 'main.score',
          name: 'Метрика',
          value: 1,
          max_value: 2,
          is_applicabble_flg: true,
          dd_calculation_flg: 1,
        }],
      }],
    }],
    title: {rows: []},
  });
}

test('change → ready → change → ready → send invalidates each prior confirmation', () => {
  const baseline = fixture();
  let state = workflowState(baseline);
  assert.throws(() => setWorkflowReady(state, true), /Нет изменений/);

  state = applyWorkflowChange(state, updateTeam(state.report, 'team-1', {tribe: 'Трайб'}));
  assert.equal(state.dirty, true);
  assert.equal(state.ready, false);
  state = setWorkflowReady(state, true);
  assert.equal(state.ready, true);

  state = applyWorkflowChange(state, updateMetricValues(state.report, 'team-1', 'main.score', {value: 2}));
  assert.equal(state.ready, false);
  assert.throws(() => createWorkflowEml(state), /отметьте «Готово»/);

  state = setWorkflowReady(state, true);
  const draft = createWorkflowEml(state, {
    now: new Date(2026, 6, 17, 9, 30),
    dateText: '17.07.2026, 09:30',
    changedProductCount: 1,
    boundary: '----=_DataDriven_workflow',
  });
  assert.match(draft.content, /^To: rgshishko@sberbank\.ru\r$/m);
  assert.match(draft.body, /Изменено команд: 1$/);
});

test('ready checkbox input does not immediately invalidate its own confirmation', () => {
  const readyCheckbox = {
    closest: (selector) => selector === '[data-constructor-ready-control]' ? {} : null,
  };
  const regularInput = {closest: () => null};

  assert.equal(shouldInvalidateReadyForInput(readyCheckbox), false);
  assert.equal(shouldInvalidateReadyForInput(regularInput), true);
  assert.equal(shouldInvalidateReadyForInput(null), true);
});
