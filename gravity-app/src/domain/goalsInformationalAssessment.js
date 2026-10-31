import {isDdIndexMetric} from './report.js';

const codes = new Set(['goals.monitored', 'goals.forecast', 'goals.factor_analysis_l1_l2']);

export function applyGoalsInformationalAssessments(products, period, overlays) {
  if (period !== 'III кв. 2026') return products;
  const teams = overlays.filter(item => item.scope === 'goals-information-assessment' && item.period === period)
    .flatMap(item => item.products || []);
  return products.map(product => {
    const team = teams.find(team => team.id === String(product.id).replace(/::empty::.*/, '')
      && ['name', 'unit', 'type'].every(key => team[key] === product[key]));
    if (!team) return product;
    const metrics = product.metrics.map(block => ({...block, metrics: block.metrics.map(metric => {
      const fact = team?.metrics?.[metric.code];
      if (!codes.has(metric.code) || fact?.informational !== true) return metric;
      return {...metric, dd_calculation_flg: 0, excluded_from_index: true,
        indexExclusionSource: fact.source};
    })}));
    return {...product, metrics, indexMaxPoints: metrics.flatMap(block => block.metrics)
      .filter(isDdIndexMetric).reduce((sum, metric) => sum + Number(metric.max_value), 0)};
  });
}
