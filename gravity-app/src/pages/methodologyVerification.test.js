import assert from 'node:assert/strict';
import test from 'node:test';
import {methodologyVerificationComment} from './methodologyVerification.js';

test('product verification comments distinguish digital traces from self-assessment', () => {
  assert.equal(
    methodologyVerificationComment('product', 'Воронка привлечения/оформления', 'Кампейнинг'),
    'Расчёт по цифровым следам',
  );
  assert.match(methodologyVerificationComment('product', 'Механики'), /cross-sell.*цифровым следам/s);
  assert.equal(
    methodologyVerificationComment('product', 'Воронка оттока', 'Отчетность'),
    'Расчёт на основании самооценки PO',
  );
});

test('channel verification comments follow the matching workbook sheet', () => {
  assert.equal(
    methodologyVerificationComment('channel_service', 'Воронка входа в канал', 'Анализ'),
    'Расчёт на основании самооценки PO',
  );
  assert.equal(
    methodologyVerificationComment('channel_telemarketing', 'Воронка продаж', 'Отчетность'),
    'Расчёт на основании самооценки PO',
  );
  assert.equal(
    methodologyVerificationComment('channel_digital', 'UX / CX Score'),
    'Расчёт по цифровым следам',
  );
});

test('segment profiles receive relevant verification comments from the second sheet', () => {
  assert.equal(
    methodologyVerificationComment('segment_age', 'Мониторинг: цели, драйверы и прогнозы'),
    'Расчёт на основании самооценки PO с верификацией по цифровым следам',
  );
  assert.equal(
    methodologyVerificationComment('segment_income', 'Механики'),
    'Расчёт на основании самооценки PO',
  );
  assert.equal(methodologyVerificationComment('segment_age', 'Воронка привлечения/оформления', 'Кампейнинг'), '');
});
