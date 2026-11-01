import {isDdIndexMetric} from './report.js';

const PERIOD = 'III кв. 2026';
const team = {id: 'febe33a0-05c9-50d9-989c-9c1067e3ab21¦ЦФА', name: 'ЦФА', unit: 'УБ', type: 'Продукт'};
const allowedCodes = new Set(['general.obъem_celevogo_rynka_v_rossii', 'general.obъem_celevogo_rynka_v_sbere']);
const sameTeam = (candidate) => candidate && String(candidate.id || '').replace(/::empty::.*/, '') === team.id
  && ['name', 'unit', 'type'].every((field) => candidate[field] === team[field]);

export function applyMetricIndexExclusionAssessments(products, period, overlays = []) {
  if (period !== PERIOD) return products;
  const assessments = (Array.isArray(overlays) ? overlays : [overlays]).filter((assessment) =>
    assessment?.period === period && assessment.scope === 'metric-index-exclusion-assessment');
  const facts = Object.assign({}, ...assessments.flatMap((assessment) => assessment.products || [])
    .filter(sameTeam).map((record) => record.metrics || {}));
  if (!Object.keys(facts).length) return products;
  return products.map((product) => {
    if (product.period !== period || !sameTeam(product)) return product;
    let changed = false;
    const metrics = product.metrics.map((block) => {
      const entries = block.metrics.map((metric) => {
        const fact = facts[metric.code];
        if (!allowedCodes.has(metric.code) || fact?.excludedFromIndex !== true
          || fact.source?.confirmedBy !== 'user' || fact.source?.period !== period) return metric;
        if (metric.excluded_from_index === true && metric.dd_calculation_flg === 0
          && metric.indexExclusionSource?.origin === fact.source.origin) return metric;
        changed = true;
        return {...metric, excluded_from_index: true, dd_calculation_flg: 0,
          indexExclusionSource: {...fact.source, excludedFromIndex: true,
            previousExcludedFromIndex: metric.excluded_from_index ?? false,
            previousDdCalculationFlag: metric.dd_calculation_flg ?? null}};
      });
      return entries.some((metric, index) => metric !== block.metrics[index]) ? {...block, metrics: entries} : block;
    });
    return changed ? {...product, metrics, indexMaxPoints: metrics.flatMap((block) => block.metrics)
      .filter(isDdIndexMetric).reduce((sum, metric) => sum + Number(metric.max_value), 0)} : product;
  });
}
