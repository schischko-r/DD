import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const summarySource = readFileSync(new URL('./LlmSummary.jsx', import.meta.url), 'utf8');

test('cross-sell summary labels potential and feedback counts from their actual fields', () => {
  assert.equal(
    (summarySource.match(/Потенциальных cross-sell связок: \{crossSellCount\(item\.api_potential_n\)\}\./g) || []).length,
    2,
  );
  assert.match(
    summarySource,
    /Связок, ожидающих вашей обратной связи: \{crossSellCount\(count\)\}\./,
  );
  assert.match(summarySource, /crossSellWaitingDecisionCount\(item, marketPresentation\)/);
});

test('cross-sell market no longer labels candidates_new as waiting for feedback', () => {
  assert.doesNotMatch(summarySource, /candidatesNew.*ждут решения/);
});

test('cross-sell platform recommendation points to the action below', () => {
  assert.match(summarySource, /по кнопке &quot;Перейти&quot; ниже/);
  assert.doesNotMatch(summarySource, /по кнопке &quot;Перейти&quot; выше/);
});
