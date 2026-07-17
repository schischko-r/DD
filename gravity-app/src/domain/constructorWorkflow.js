import {createReportEml} from './emailDraft.js';
import {validateReport} from './reportEditor.js';

export const READY_CONTROL_SELECTOR = '[data-constructor-ready-control]';

export function shouldInvalidateReadyForInput(target) {
  return !target?.closest?.(READY_CONTROL_SELECTOR);
}

export function workflowState(report, {dirty = false, ready = false} = {}) {
  return {report, dirty: Boolean(dirty), ready: Boolean(ready)};
}

export function applyWorkflowChange(state, report, {dirty = true} = {}) {
  if (report === state.report) return state;
  return {report, dirty: Boolean(dirty), ready: false};
}

export function setWorkflowReady(state, ready) {
  if (!ready) return state.ready ? {...state, ready: false} : state;
  if (!state.dirty) throw new Error('Нет изменений, готовых к отправке.');
  const errors = validateReport(state.report);
  if (errors.length) {
    const error = new Error(`Исправьте ошибки валидации: ${errors.map((item) => item.message).join(' ')}`);
    error.validationErrors = errors;
    throw error;
  }
  return state.ready ? state : {...state, ready: true};
}

export function assertWorkflowReady(state) {
  if (!state.dirty || !state.ready) {
    throw new Error('Сначала проверьте изменения и отметьте «Готово».');
  }
  setWorkflowReady(state, true);
  return state.report;
}

export function createWorkflowEml(state, options = {}) {
  return createReportEml(assertWorkflowReady(state), options);
}
