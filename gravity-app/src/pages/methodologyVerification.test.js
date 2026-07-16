import assert from 'node:assert/strict';
import test from 'node:test';
import {methodologyVerificationComment} from './methodologyVerification.js';

test('product verification comments distinguish digital traces from self-assessment', () => {
  assert.equal(
    methodologyVerificationComment('product', 'Воронка привлечения/оформления', 'Кампейнинг'),
    'Расчет по цифровым следам',
  );
  assert.match(methodologyVerificationComment('product', 'Механики'), /cross-sell.*цифровым следам/s);
  assert.equal(
    methodologyVerificationComment('product', 'Воронка оттока', 'Отчетность'),
    'Расчет на основании самооценке PO',
  );
});

test('channel verification comments follow the matching workbook sheet', () => {
  assert.equal(
    methodologyVerificationComment('channel_service', 'Воронка входа в канал', 'Анализ'),
    'Расчет на основании самооценке PO',
  );
  assert.equal(
    methodologyVerificationComment('channel_telemarketing', 'Воронка продаж', 'Отчетность'),
    'Расчет на основании самооценке PO',
  );
  assert.equal(
    methodologyVerificationComment('channel_digital', 'UX / CX Score'),
    'Расчет по цифровым следам',
  );
});

test('segment profiles receive relevant verification comments from the second sheet', () => {
  assert.match(methodologyVerificationComment('segment_age', 'Мониторинг: цели, драйверы и прогнозы'), /цифровым следам/);
  assert.equal(
    methodologyVerificationComment('segment_income', 'Механики'),
    'Расчет на основании самооценке PO',
  );
  assert.equal(methodologyVerificationComment('segment_age', 'Воронка привлечения/оформления', 'Кампейнинг'), '');
});
