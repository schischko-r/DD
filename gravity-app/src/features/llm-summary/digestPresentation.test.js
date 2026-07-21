import test from 'node:test';
import assert from 'node:assert/strict';
import {digestStatus, digestTheme, hasAvailableRecommendations, readableDigestRule, recommendationSkillLink, worstDigestLight} from './digestPresentation.js';

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

test('digest traffic-light rule is readable for users', () => {
  assert.equal(
    readableDigestRule('Зел.: рост продаж 3 мес. подряд | Красн.: падение продаж 3 мес. подряд | Жёлт.: иначе'),
    'Зелёный сигнал — рост продаж 3 мес. подряд. Красный сигнал — падение продаж 3 мес. подряд. Жёлтый сигнал — иначе.',
  );
});

test('worst digest light keeps existing priority order', () => {
  assert.equal(worstDigestLight([{traffic_light: 'green'}, {traffic_light: 'yellow'}]), 'yellow');
  assert.equal(worstDigestLight([{traffic_light: 'green'}, {traffic_light: 'red'}]), 'red');
  assert.equal(worstDigestLight([{}]), 'gray');
  assert.equal(worstDigestLight([]), 'gray');
});

test('recommendations are unavailable when only an empty LLM summary exists', () => {
  assert.equal(hasAvailableRecommendations([]), false);
  assert.equal(hasAvailableRecommendations([{llm_summary: true, llm_placeholder: true}]), false);
  assert.equal(hasAvailableRecommendations([
    {llm_summary: true, llm_placeholder: true},
    {skill_key: 'csi'},
  ]), true);
  assert.equal(hasAvailableRecommendations([{llm_summary: true}]), true);
});

test('recommendation skill link uses the matching AI tool from the metric block', () => {
  const block = {
    tools: [{
      name: 'Группа навыков',
      buttons: [
        {ai_tool_key: 'drafts', button: {link: 'https://example.test/drafts'}},
        {ai_tool_key: 'clickstream_funnel', button: {link: 'https://example.test/funnel'}},
      ],
    }],
  };

  assert.equal(
    recommendationSkillLink(block, [{skill_key: 'clickstream_funnel'}]),
    'https://example.test/funnel',
  );
  assert.equal(recommendationSkillLink(block, [{skill_key: 'llm_summary'}]), '');
});
