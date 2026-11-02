const matchesProduct = (row, product) => row.id === String(product.id || '').replace(/::empty::.*$/, '')
  && ['name', 'unit', 'type'].every((key) => row[key] === product[key]);

export function applyPCFinalScores(products, period, overlays) {
  if (period !== 'III кв. 2026') return products;
  const sources = (Array.isArray(overlays) ? overlays : [overlays]).filter((item) =>
    item?.scope === 'pc-final-score-assessment' && item.period === period);
  if (!sources.length) return products;
  if (sources.length !== 1) throw new Error('Only one final Q3 PC score source is allowed');
  const assessment = sources[0];
  return products.map((product) => {
    const rows = (assessment.products || []).filter((row) => matchesProduct(row, product));
    if (!rows.length) return product;
    if (rows.length !== 1) throw new Error(`PC score identity is ambiguous: ${product.name}`);
    const row = rows[0];
    let changed = false;
    const metrics = product.metrics.map((block) => ({...block, metrics: block.metrics.map((metric) => {
      const fact = row.metrics?.[metric.code];
      if (!fact) return metric;
      if (![0, 0.5, 1].includes(fact.rawValue) || metric.is_applicabble_flg === false
        || !(Number(metric.max_value) > 0)) {
        throw new Error(`PC score cannot be applied: ${product.name} / ${metric.code}`);
      }
      changed = true;
      const value = fact.rawValue * Number(metric.max_value);
      return {...metric, value, source: {...fact.source, rawValue: fact.rawValue},
        ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
          ...item, value, max_value: metric.max_value, gap: Math.max(0, Number(metric.max_value) - value),
        }))} : {})};
    })}));
    if (row.crossSellDuring) {
      const fact = row.crossSellDuring;
      let found = false;
      for (const block of metrics) block.metrics = block.metrics.map((metric) => {
        if (metric.code !== 'mehaniki.cross_sell') return metric;
        if (![0, 0.5, 1].includes(fact.rawValue) || !(Number(metric.max_value) > 0)) {
          throw new Error(`PC Cross-sell score cannot be applied: ${product.name}`);
        }
        const previous = metric.crossSellComponents || {};
        if (!previous.during) throw new Error(`PC Cross-sell component is missing: ${product.name}`);
        const duringValue = fact.rawValue * Number(metric.max_value) / 2;
        const afterValue = previous.after?.applicable === false ? 0 : Number(previous.after?.value || 0);
        const value = Math.min(Number(metric.max_value), duringValue + afterValue);
        found = true;
        return {...metric, value,
          source: {origin: 'userConfirmedPCFinalCrossSellScore', confirmedBy: 'user', period,
            rawValue: value / Number(metric.max_value), componentRawValue: fact.rawValue},
          crossSellComponents: {...previous,
            during: {...previous.during, value: duringValue, source: fact.source},
          },
          ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
            ...item, value, max_value: metric.max_value, gap: Math.max(0, Number(metric.max_value) - value),
          }))} : {}),
        };
      });
      if (!found) throw new Error(`PC Cross-sell metric is missing: ${product.name}`);
      changed = true;
    }
    return changed ? {...product, metrics} : product;
  });
}
