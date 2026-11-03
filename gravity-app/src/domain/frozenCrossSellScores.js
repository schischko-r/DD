import {isDdIndexMetric} from './report.js';

const CODE = 'mehaniki.cross_sell';

function applyFrozenMetric(product, frozen) {
  let found = false;
  let changed = false;
  const metrics = product.metrics.map((block) => {
    const entries = block.metrics.flatMap((metric) => {
      if (metric.code !== CODE) return [metric];
      found = true;
      if (frozen.present === false) {
        changed = true;
        return [];
      }
      const next = {...metric};
      for (const key of ['value', 'max_value', 'is_applicabble_flg', 'excluded_from_index',
        'dd_calculation_flg', 'source', 'crossSellComponents', 'recommendation_items']) {
        if (Object.hasOwn(frozen.metric, key)) next[key] = frozen.metric[key];
      }
      if (Object.keys(next).some((key) => next[key] !== metric[key])) changed = true;
      return [next];
    });
    return entries.length === block.metrics.length && entries.every((metric, index) => metric === block.metrics[index])
      ? block : {...block, metrics: entries};
  });

  if (frozen.present && !found && frozen.metric) {
    const blockIndex = metrics.findIndex((block) => block.code === 'mehaniki');
    if (blockIndex >= 0) {
      metrics[blockIndex] = {...metrics[blockIndex], metrics: [...metrics[blockIndex].metrics, frozen.metric]};
      changed = true;
    }
  }
  const cohorts = product.salaryCohorts
    ? Object.fromEntries(Object.entries(product.salaryCohorts).map(([key, cohort]) => {
      const hasFrozenCohorts = frozen.salaryCohorts && Object.hasOwn(frozen.salaryCohorts, key);
      const score = frozen.salaryCohorts?.[key];
      if (!hasFrozenCohorts && frozen.present !== false) return [key, cohort];
      return [key, applyFrozenMetric(cohort, score ? {present: true, metric: score} : {present: false})];
    })) : product.salaryCohorts;
  const cohortsChanged = cohorts && Object.entries(cohorts).some(([key, cohort]) => cohort !== product.salaryCohorts[key]);
  if (!changed && !cohortsChanged) return product;
  const next = {...product, metrics, ...(cohortsChanged ? {salaryCohorts: cohorts} : {})};
  if (changed) next.indexMaxPoints = metrics.flatMap((block) => block.metrics).filter(isDdIndexMetric)
    .reduce((sum, metric) => sum + Number(metric.max_value), 0);
  return next;
}

export function applyFrozenCrossSellScores(products, period, snapshot) {
  if (period !== snapshot?.period || period !== 'III кв. 2026') return products;
  const rows = snapshot.products || [];
  const byIdentity = new Map(rows.map((row) => [`${row.name}\u0000${row.unit}\u0000${row.type}`, row]));
  let changed = false;
  const result = products.map((product) => {
    const row = byIdentity.get(`${product.name}\u0000${product.unit}\u0000${product.type}`);
    if (!row) return product;
    const next = applyFrozenMetric(product, row);
    if (next !== product) changed = true;
    return next;
  });
  return changed ? result : products;
}
