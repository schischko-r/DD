import test from 'node:test';
import assert from 'node:assert/strict';
import {crossSellMarketPresentation, crossSellWaitingDecisionCount, digestStatus, digestTheme, hasAvailableRecommendations, hasManualValidationWarning, presentableRecommendations, readableDigestRule, recommendationSkillLink, worstDigestLight} from './digestPresentation.js';

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

test('removed digest recommendations are excluded without hiding Cross-sell or unknown sources', () => {
  const llmSummary = {skill_key: 'llm_summary'};
  const csiDigest = {skill_key: 'csi'};
  const funnelDigest = {skill_key: 'clickstream_funnel'};
  const crossSell = {skill_key: 'cross_sell'};
  const independentRecommendation = {skill_key: 'independent_source'};

  assert.deepEqual(
    presentableRecommendations([llmSummary, csiDigest, funnelDigest, crossSell, independentRecommendation]),
    [crossSell, independentRecommendation],
  );
  assert.equal(hasAvailableRecommendations([]), false);
  assert.equal(hasAvailableRecommendations([llmSummary]), false);
  assert.equal(hasAvailableRecommendations([csiDigest]), false);
  assert.equal(hasAvailableRecommendations([llmSummary, crossSell]), true);
  assert.equal(hasAvailableRecommendations([independentRecommendation]), true);
});

test('manual validation warning is driven by the recommendation flag', () => {
  assert.equal(hasManualValidationWarning([]), false);
  assert.equal(hasManualValidationWarning([{requires_manual_validation: false}]), false);
  assert.equal(hasManualValidationWarning([{requires_manual_validation: true}]), true);
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
  assert.equal(recommendationSkillLink(block, [{skill_key: 'unknown'}]), '');
});

test('recommendation skill link supports a direct cross-sell tool', () => {
  const block = {
    tools: [{
      name: 'Cross-sell',
      ai_tool_key: 'cross_sell',
      button: {link: 'https://example.test/cross-sell'},
    }],
  };

  assert.equal(
    recommendationSkillLink(block, [{skill_key: 'cross_sell'}]),
    'https://example.test/cross-sell',
  );
});

test('cross-sell market presentation keeps the snapshot and whole decision history', () => {
  const presentation = crossSellMarketPresentation({
    crosssell_market: {
      candidates_new: 1,
      candidates_in_catalog: 2,
      findings: 8,
      market_side_findings: 6,
      runs: 2,
      snapshot_date: '31.07.2026',
    },
    crosssell_candidates: [
      {key: 'wait', from: 'ЗЛС', to: 'Прайм', why: 'Дополняет путь', status: 'wait', status_label: 'ждёт решения'},
      {key: 'accepted', from: 'ЗЛС', to: 'Страхование', why: 'Защита', status: 'accepted', status_label: 'принято'},
      {key: 'rejected', from: 'ЗЛС', to: 'Кредит', why: 'Не подходит', status: 'rejected', status_label: 'отклонено'},
      {key: 'canon', from: 'ЗЛС', to: 'Каталог', why: 'Уже есть', status: 'canon', status_label: 'в каталоге'},
      {key: 'mirror', from: 'ЗЛС', to: 'Зеркало', why: 'Обратная пара', status: 'mirror', status_label: 'зеркало'},
      {
        key: 'audrej',
        from: 'ЗЛС',
        to: 'Шум',
        why: 'Дубль',
        status: 'audrej',
        status_label: 'снято разбором',
        audit: {group: 'duplicate', reason: 'Повтор', match: 'wait'},
      },
    ],
    crosssell_sources: [
      {publisher: 'Исследование рынка', url: 'https://example.test/research'},
    ],
  });

  assert.ok(presentation);
  assert.equal(presentation.candidatesNew, 1);
  assert.equal(presentation.waitCount, 1);
  assert.deepEqual(presentation.statusCounts, {
    wait: 1,
    accepted: 1,
    rejected: 1,
    canon: 1,
    mirror: 1,
    audrej: 1,
  });
  assert.deepEqual(
    presentation.candidates.map(({status}) => status),
    ['wait', 'accepted', 'rejected', 'canon', 'mirror', 'audrej'],
  );
  assert.deepEqual(
    presentation.candidates[0],
    {
      key: 'wait',
      from: 'ЗЛС',
      to: 'Прайм',
      why: 'Дополняет путь',
      status: 'wait',
      statusLabel: 'ждёт решения',
    },
  );
  assert.deepEqual(
    presentation.sources,
    [{publisher: 'Исследование рынка', url: 'https://example.test/research'}],
  );
});

test('cross-sell preview presentation hides only rejected candidates when requested', () => {
  const item = {
    crosssell_market: {candidates_new: 3},
    crosssell_candidates: [
      {key: 'wait', status: 'wait', status_label: 'Ждёт решения'},
      {key: 'rejected', status: 'rejected', status_label: 'Решено · не будем предлагать'},
      {key: 'accepted', status: 'accepted', status_label: 'Решено · будем предлагать'},
    ],
  };

  assert.deepEqual(
    crossSellMarketPresentation(item, {hideRejectedCandidates: true}).candidates.map(({key}) => key),
    ['wait', 'accepted'],
  );
  assert.deepEqual(
    crossSellMarketPresentation(item).candidates.map(({key}) => key),
    ['wait', 'rejected', 'accepted'],
  );
});

test('cross-sell market presentation distinguishes missing research from a researched zero', () => {
  assert.equal(crossSellMarketPresentation({}), null);
  assert.equal(crossSellMarketPresentation({
    crosssell_market: null,
    crosssell_candidates: null,
    crosssell_sources: null,
  }), null);

  const researchedZero = crossSellMarketPresentation({
    crosssell_market: {
      candidates_new: 0,
      findings: 3,
    },
    crosssell_candidates: [],
    crosssell_sources: [],
  });

  assert.ok(researchedZero);
  assert.equal(researchedZero.candidatesNew, 0);
  assert.equal(researchedZero.waitCount, 0);
  assert.deepEqual(researchedZero.statusCounts, {});
});

test('cross-sell feedback count prefers the backend contract and keeps the market fallback', () => {
  const item = {
    api_seen_around_n: 8,
    api_seen_out_n: 7,
    api_seen_in_n: 1,
    api_potential_n: 3,
    candidates_waiting_decision: 5,
    crosssell_market: {candidates_new: 9},
    crosssell_candidates: [
      {status: 'wait'},
      {status: 'wait'},
      {status: 'rejected'},
    ],
  };
  const presentation = crossSellMarketPresentation(item);

  assert.equal(crossSellWaitingDecisionCount(item, presentation), 5);
  assert.equal(crossSellWaitingDecisionCount({...item, candidates_waiting_decision: null}, presentation), 2);
});
