import assert from 'node:assert/strict';
import test from 'node:test';
import {methodologyVerificationComment} from './methodologyVerification.js';

const MONITORING_TITLE = 'Мониторинг: цели, драйверы и прогнозы';
const MONITORING_MASTER_DASH_COMMENT = `Расчёт на основании самооценки PO с верификацией по цифровым следам.

Для полного выполнения требования цели, факторный анализ (драйверы 1–2-го уровня) и прогнозы должны быть отражены именно в Мастер-дэше юнита в Навигаторе. Локальные и другие дашборды не заменяют Мастер-дэш и дают только частичную оценку по шкале ниже.`;

test('product verification comments distinguish digital traces from self-assessment', () => {
  assert.equal(
    methodologyVerificationComment('product', 'Воронка привлечения/оформления', 'Кампейнинг'),
    'Расчёт по цифровым следам',
  );
  assert.match(methodologyVerificationComment('product', 'Механики'), /cross-sell.*цифровым следам/s);
  assert.equal(
    methodologyVerificationComment('product', 'Воронка оттока', 'Отчётность'),
    'Расчёт на основании самооценки PO',
  );
});

test('channel verification comments follow the matching workbook sheet', () => {
  assert.equal(
    methodologyVerificationComment('channel_service', 'Воронка входа в канал', 'Анализ'),
    'Расчёт на основании самооценки PO',
  );
  assert.equal(
    methodologyVerificationComment('channel_telemarketing', 'Воронка продаж', 'Отчётность'),
    'Расчёт на основании самооценки PO',
  );
  assert.equal(
    methodologyVerificationComment('channel_digital', 'UX / CX Score'),
    'Расчёт по цифровым следам',
  );
});

test('segment profiles receive relevant verification comments from the second sheet', () => {
  assert.equal(
    methodologyVerificationComment('segment_age', MONITORING_TITLE),
    MONITORING_MASTER_DASH_COMMENT,
  );
  assert.equal(
    methodologyVerificationComment('segment_income', 'Механики'),
    'Расчёт на основании самооценки PO',
  );
  assert.equal(methodologyVerificationComment('segment_age', 'Воронка привлечения/оформления', 'Кампейнинг'), '');
});

test('all six profiles require monitoring in the Navigator unit master dashboard', () => {
  const profileKeys = ['product', 'segment_age', 'segment_income', 'channel_digital', 'channel_service', 'channel_telemarketing'];
  const comments = profileKeys.map((profileKey) => methodologyVerificationComment(profileKey, MONITORING_TITLE));

  assert.equal(comments.length, 6);
  for (const [index, comment] of comments.entries()) {
    assert.equal(comment, MONITORING_MASTER_DASH_COMMENT, profileKeys[index]);
  }

  assert.doesNotMatch(methodologyVerificationComment('product', 'Алерты'), /Мастер-дэше юнита/);
});
