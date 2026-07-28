import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  buildClickstreamRecommendations,
  createFunnelNameIndex,
  extractClickstreamData,
  latestClickstreamPeriod,
  resolveClickstreamFunnelId,
} from './clickstreamDataCore.js';

test('extractClickstreamData reads the real neighboring legacy report', () => {
  const source = readFileSync(
    new URL('../../../Кликстрим_Месячный_все_воронки_zeroed.html', import.meta.url),
    'utf8',
  );
  const data = extractClickstreamData(source);

  assert.ok(data.funnels.length > 50);
  assert.equal(data.periods.length, 5);
  assert.equal(
    latestClickstreamPeriod(data.periods)?.date_from,
    '2026-06-01',
  );
  assert.ok(Object.keys(data.data).length > 50);
});

test('extractClickstreamData reads the JSON assignment without being confused by braces in strings', () => {
  const expected = {
    funnels: [{funnel_id: '42', funnel_name: 'Воронка {основная}'}],
    periods: [{date_from: '2026-06-01', date_to: '2026-06-30'}],
    data: {'42': {}},
  };
  const html = [
    '<script>const unrelated = {"ignored": true};</script>',
    `<script>var _ALL_DATA = ${JSON.stringify(expected)};`,
    'const after = "}";</script>',
  ].join('');

  assert.deepEqual(extractClickstreamData(html), expected);
  assert.throws(
    () => extractClickstreamData('<script>const data = {};</script>'),
    /does not contain var _ALL_DATA/,
  );
  assert.throws(
    () => extractClickstreamData('<script>var _ALL_DATA = {"funnels":[]};</script>'),
    /unexpected shape/,
  );
});

test('duplicate Clickstream funnel names resolve to the last catalog entry like the legacy report', () => {
  const funnels = [
    {funnel_id: 'first', funnel_name: 'Повторяющееся имя'},
    {funnel_id: 'unique', funnel_name: 'Уникальная воронка'},
    {funnel_id: 'last', funnel_name: 'Повторяющееся имя'},
  ];
  const data = {funnels};

  assert.equal(createFunnelNameIndex(funnels).get('Повторяющееся имя'), 'last');
  assert.equal(resolveClickstreamFunnelId(data, 'Повторяющееся имя'), 'last');
  assert.equal(resolveClickstreamFunnelId(data, 'first'), 'first');
  assert.equal(resolveClickstreamFunnelId(data, 'Неизвестная воронка'), '');
});

test('latestClickstreamPeriod selects the chronologically latest valid period regardless of order', () => {
  const periods = [
    {date_from: '2026-05-01', date_to: '2026-05-31'},
    {date_from: '2027-01-01'},
    {date_from: '2026-03-01', date_to: '2026-03-31'},
    {date_from: '2026-06-01', date_to: '2026-06-30'},
  ];

  assert.deepEqual(
    latestClickstreamPeriod(periods),
    {date_from: '2026-06-01', date_to: '2026-06-30'},
  );
  assert.equal(latestClickstreamPeriod([]), null);
});

test('recommendations fall back to the step with the lowest conversion when analytics has no drop', () => {
  const report = {
    traffic_light: 'yellow',
    analytics: {
      pattern: 'stable',
      step_drops: [],
    },
    funnel: {
      1: {
        step_name: 'Начало',
        conv_from_prev: null,
        event_actions: [],
      },
      2: {
        step_name: 'Слабый шаг',
        conv_from_prev: 0.31,
        event_actions: [],
      },
      3: {
        step_name: 'Сильный шаг',
        conv_from_prev: 0.74,
        event_actions: [],
      },
    },
    nrt_configured: 0,
  };

  const recommendations = buildClickstreamRecommendations(report);
  const stepRecommendation = recommendations.find(({kind}) => kind === 'step');
  const researchRecommendation = recommendations.find(({kind}) => kind === 'research');

  assert.equal(stepRecommendation.step, 2);
  assert.equal(stepRecommendation.stepName, 'Слабый шаг');
  assert.match(stepRecommendation.text, /наименьшая конверсия/);
  assert.match(researchRecommendation.text, /На шаге 2 «Слабый шаг»/);
});
