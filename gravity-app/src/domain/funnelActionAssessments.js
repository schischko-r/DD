const codes = new Set(['attract.initiatives_list', 'churn.deviation_actions']);

export function applyFunnelActionAssessments(products, period, assessment, baselineProducts = []) {
  if (period !== 'III кв. 2026' || assessment?.period !== period
    || assessment.scope !== 'funnel-action-missing-assessment') return products;
  const same = (fact, product) => fact.id === String(product.id).replace(/::empty::.*/, '')
    && ['name', 'unit', 'type'].every((field) => fact[field] === product[field]);
  return products.map((product) => {
    const matches = (assessment.products || []).filter((fact) => same(fact, product));
    if (matches.length !== 1) return product;
    const priorProduct = baselineProducts.find((prior) => same(prior, product));
    const metrics = product.metrics.map((block) => ({...block, metrics: block.metrics.map((metric) => {
      const fact = matches[0].metrics?.[metric.code];
      if (!codes.has(metric.code) || !fact || ![0, 1].includes(fact.rawValue) || metric.value !== null
        || metric.is_applicabble_flg === false || !(Number(metric.max_value) > 0)
        || fact.expectedMaxValue !== metric.max_value) return metric;
      const value = fact.rawValue * Number(metric.max_value);
      const prior = priorProduct?.metrics.flatMap((entry) => entry.metrics).find((entry) => entry.code === metric.code);
      const previous = prior && prior.is_applicabble_flg !== false && Number.isFinite(prior.value)
        && prior.max_value === metric.max_value && priorProduct.period !== period
        ? {previousValue: prior.value, previousMaxValue: prior.max_value, previousPeriod: priorProduct.period} : {};
      return {...metric, value, ...previous, source: {...fact.source, rawValue: fact.rawValue},
        ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
          ...item, value, max_value: metric.max_value, gap: Number(metric.max_value) - value,
        }))} : {})};
    })}));
    return {...product, metrics};
  });
}
