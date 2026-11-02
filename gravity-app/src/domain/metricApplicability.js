import {isDdIndexMetric} from './report.js';

const allowedCodes = new Set(['mehaniki.vozvrat_klientov', 'mehaniki.uderzhanie_klientov', 'mehaniki.gibkoe_izmenenie_usloviy_produkta',
  'mehaniki.doprodazhi_up_sell',
  'goals.monitored', 'goals.forecast', 'goals.factor_analysis_l1_l2', 'hyp.extra_initiatives', 'hyp.ab_tests',
  'attract.chernoviki_v_sbol_70', 'attract.nastroena_otchetnostь', 'attract.regulyarnostь', 'attract.report_completeness',
  'churn.nastroena_otchetnostь', 'churn.regulyarnostь', 'churn.report_completeness', 'cx.score']);

export function applyMetricApplicabilityAssessments(products, period, overlays, afterReporting = false) {
  if (period !== 'III кв. 2026') return products;
  const assessments = overlays.filter((item) => item.scope === 'metric-applicability-assessment' && item.period === period
    && Boolean(item.applyAfterReporting) === afterReporting);
  return products.map((product) => {
    const teams = assessments.flatMap((item) => item.products || []).filter((team) =>
      team.id === String(product.id || '').replace(/::empty::.*$/, '')
      && ['name', 'unit', 'type'].every((key) => team[key] === product[key]));
    if (!teams.length) return product;
    const facts = Object.assign({}, ...teams.map((team) => team.metrics));
    const metrics = product.metrics.map((block) => ({...block, metrics: block.metrics.map((metric) => {
      const fact = facts[metric.code];
      if (!allowedCodes.has(metric.code) || fact?.applicable !== false) return metric;
      const {previousValue, previousMaxValue, previousPeriod, ...rubric} = metric;
      return {...rubric, value: null, max_value: 0, is_applicabble_flg: false, excluded_from_index: true,
        source: fact.source,
        ...(fact.hiddenFromProfile === true ? {hidden_from_profile: true} : {}),
        ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
          ...item, value: null, max_value: 0, gap: 0,
        }))} : {}),
      };
    })}));
    return {...product, metrics, indexMaxPoints: metrics.flatMap((block) => block.metrics)
      .filter(isDdIndexMetric).reduce((sum, metric) => sum + Number(metric.max_value), 0)};
  });
}
