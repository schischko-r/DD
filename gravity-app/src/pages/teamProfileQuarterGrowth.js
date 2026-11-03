import {isDdIndexMetricForPeriod} from '../domain/report.js';
import {GOALS_FINAL_COUNTERPARTS} from '../domain/goalsFinalScores.js';

// Score comparisons stay intact. When a criterion enters the index or changes
// weight, display its contribution change without inventing a previous score.
export function quarterMetricGrowthByCode(product, comparison, baselineProducts) {
  if (!comparison) return {};
  const growths = {...comparison.metricGrowthByCode};
  const previous = baselineProducts.find(candidate => candidate.period === comparison.previousPeriod
    && candidate.id === String(product.id || '').replace(/::empty::.*/, '')
    && ['name', 'unit', 'type'].every(key => candidate[key] === product[key]));
  if (!previous) return growths;
  for (const block of product.metrics) {
    const priorMetrics = previous.metrics.find(item => item.code === block.code)?.metrics || [];
    for (const metric of block.metrics) {
      if (growths[metric.code] || !isDdIndexMetricForPeriod(metric, product.period)) continue;
      const priorCode = block.code === 'goals'
        ? Object.keys(GOALS_FINAL_COUNTERPARTS).find(code => GOALS_FINAL_COUNTERPARTS[code] === metric.code) || metric.code
        : metric.code;
      const prior = priorMetrics.find(item => item.code === priorCode);
      const priorIncluded = prior && isDdIndexMetricForPeriod(prior, previous.period);
      if (priorIncluded && prior.max_value === metric.max_value) continue;
      const previousContribution = priorIncluded ? prior.value / comparison.previousTotalMaxPoints * 100 : 0;
      const delta = metric.value / comparison.currentTotalMaxPoints * 100 - previousContribution;
      if (Math.abs(delta) < 1e-9) continue;
      growths[metric.code] = {indexPctDelta: delta, currentPeriod: product.period,
        previousPeriod: previous.period, value: metric.value, previousValue: priorIncluded ? prior.value : null};
    }
  }
  return growths;
}
