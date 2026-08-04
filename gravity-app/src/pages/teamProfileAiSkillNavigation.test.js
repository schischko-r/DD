import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {presentableRecommendations} from '../features/llm-summary/digestPresentation.js';
import {resolveHtmlPageContext} from '../features/html-pages/htmlPageConfig.js';
import {metricAiActionRecommendations} from './teamProfileAiSkillNavigation.js';

const profileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');

test('metric AI actions combine static mappings with recommendations that remain presentable', () => {
  const clickstreamMapping = {
    skill_key: 'clickstream_funnel',
    skill_name: 'Воронка оформления в СБОЛ',
    block_code: 'attract',
    ai_products: ['Воронка. Открытие рублевых вкладов.'],
  };
  const hiddenDigest = {...clickstreamMapping, id: 'removed-digest'};
  const pilotRecommendation = {
    id: 'actual-pilot',
    skill_key: 'pilots',
    skill_name: 'Пилотные кампании',
    block_code: 'attract',
  };
  const product = {
    ai_skill_mappings: [clickstreamMapping],
    metric_recommendations: [hiddenDigest, pilotRecommendation],
  };

  assert.deepEqual(presentableRecommendations(product.metric_recommendations), [pilotRecommendation]);
  assert.deepEqual(metricAiActionRecommendations(product), [clickstreamMapping, pilotRecommendation]);
});

test('clickstream action uses the mapped funnel as sibling report context', () => {
  const mapping = {
    skill_key: 'clickstream_funnel',
    ai_products: ['Воронка. Открытие накопительного счёта.'],
    product_group: 'Не использовать это производное поле',
  };

  assert.deepEqual(
    resolveHtmlPageContext(
      {valueSources: {funnel: ['ai_products.0']}},
      metricAiActionRecommendations({ai_skill_mappings: [mapping]})[0],
    ),
    {funnel: 'Воронка. Открытие накопительного счёта.'},
  );
  assert.match(
    profileSource,
    /const htmlPageAiRecommendations = aiActionRecommendations\.reduce\([\s\S]*buildHtmlPageContext\(tool, recommendation\)/,
  );
  assert.match(
    profileSource,
    /metricAiInsight\(tool\.action\.subject, \(\) => onOpenHtmlPageTool\(tool\.id, context\)\)/,
  );
});

test('mapped skill actions keep their metric bindings and report-access fallback', () => {
  assert.match(profileSource, /clientMetricsAiRecommendations = aiActionRecommendations\.filter\([\s\S]*item\.skill_key === 'client_metrics'/);
  assert.match(profileSource, /draftAiRecommendations = aiActionRecommendations\.filter\([\s\S]*item\.skill_key === 'drafts'/);
  assert.match(profileSource, /campaignFunnelAiRecommendations = aiActionRecommendations\.filter\([\s\S]*item\.skill_key === 'funnel'/);
  assert.match(profileSource, /pilotAiRecommendations = aiActionRecommendations\.filter\([\s\S]*item\.skill_key === 'pilots'/);
  assert.match(profileSource, /csiAiRecommendations = aiActionRecommendations\.filter\([\s\S]*item\.skill_key === 'csi'/);
  assert.match(profileSource, /complaintsAiRecommendations = aiActionRecommendations\.filter\([\s\S]*item\.skill_key === 'complaints'/);
  assert.match(
    profileSource,
    /const openConfiguredSkill = \(recommendation\) => \{[\s\S]*onOpenHtmlPageTool\(tool\.id, buildHtmlPageContext\(tool, recommendation\)\);[\s\S]*setReportAccessOpen\(true\);/,
  );
  assert.doesNotMatch(profileSource, /ProductMetricBlocks|ProductMetricRecommendations|setLens\(|lens === 'metrics'/);
});
