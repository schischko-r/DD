import {productSurveyProfiles as historicalProfiles} from './product-surveys.js';

export const fullSurveyProducts = [
  ['sber-tips-b2c', 'Сберчаевые #B2C'], ['sber-tips-b2b', 'Сберчаевые #B2B'],
  ['cross-border-transfers-b2c', 'Трансграничные переводы #B2C'],
  ['cross-border-transfers-b2b', 'Трансграничные переводы #B2B'],
  ['cross-border-acquiring-b2c', 'Трансграничный эквайринг #B2C'],
  ['cross-border-acquiring-b2b', 'Трансграничный эквайринг #B2B'],
];
// Полный актуальный продуктовый опрос. Только структура метрик, без ответов и
// баллов другой команды. Data/канальные вопросы в продуктовый шаблон не входят.
const codes = new Set([
  'general.obъem_celevogo_rynka_v_rossii', 'general.obъem_celevogo_rynka_v_sbere',
  'general.klienty_s_produktom', 'general.mau_produkta',
  'general.znanie_produktov_sputnikov', 'general.navigator_reporting_knowledge',
  'attract.nastroena_otchetnostь', 'attract.report_completeness',
  'attract.funnel_analysis', 'attract.initiatives_list', 'attract.benchmarks',
  'churn.nastroena_otchetnostь', 'churn.report_completeness',
  'churn.funnel_analysis', 'churn.deviation_actions', 'churn.benchmarks',
  'alerts.system_failures', 'alerts.business_metrics',
  'mehaniki.uderzhanie_klientov', 'mehaniki.vozvrat_klientov',
  'mehaniki.doprodazhi_up_sell', 'mehaniki.monitoring_mehanik', 'hyp.discovery_40_backlog',
  // Цифровые следы собираются и для новых команд, независимо от истории опроса.
  'attract.campaign_launches', 'attract.chernoviki_v_sbol_70', 'attract.nalichie_self_service',
  'attract.nalichie_uspeshnyh_biznes_zapuskov', 'goals.monitored',
  'goals.factor_analysis_l1_l2', 'goals.forecast', 'mehaniki.cross_sell',
  'hyp.datadriven_rating_7_5', 'hyp.extra_initiatives',
]);
const templates = new Map();
for (const profile of Object.values(historicalProfiles)) for (const metric of profile.metrics) {
  if (codes.has(metric.code) && metric.max_value > 0 && !templates.has(metric.code)) {
    templates.set(metric.code, metric);
  }
}
const freshProfiles = Object.fromEntries(fullSurveyProducts.map(([key, name]) => {
  const teamId = `full-${key}¦${name}`;
  return [teamId, {
    teamId, name, period: null, fullSurvey: true, backlogAnalyzed: false,
    metrics: [...templates.values()].map(metric => ({...metric, value: null,
      is_applicabble_flg: true, excluded_from_index: false, dd_calculation_flg: 1})),
  }];
}));
export const productSurveyProfiles = {...historicalProfiles, ...freshProfiles};
