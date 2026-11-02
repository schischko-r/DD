export function salaryB2cComparisonBlock(product, cohort, block, baselineProducts = []) {
  if (product.period !== 'III кв. 2026' || !cohort || cohort !== product.salaryCohorts?.b2c
    || !product.salaryToggleBlockCodes?.includes(block.code)) return block;
  const id = String(product.id).replace(/::empty::.*/, '');
  const matches = baselineProducts.filter(prior => prior.id === id && prior.period === 'II кв. 2026'
    && ['name', 'unit', 'type'].every(key => prior[key] === product[key]));
  if (matches.length !== 1) return block;
  const priorBlock = matches[0].metrics.find(entry => entry.code === block.code);
  if (!priorBlock) return block;
  return {...block, metrics: block.metrics.map(metric => {
    const prior = priorBlock.metrics.find(entry => entry.code === metric.code);
    if (!prior || prior.is_applicabble_flg === false || metric.is_applicabble_flg === false
      || !(metric.max_value > 0) || prior.max_value !== metric.max_value
      || !Number.isFinite(prior.value) || prior.value < 0 || prior.value > prior.max_value
      || !Number.isFinite(metric.value) || metric.value < 0 || metric.value > metric.max_value) return metric;
    return {...metric, previousValue: prior.value, previousMaxValue: prior.max_value, previousPeriod: 'II кв. 2026',
      actualGrowthWeight: 0.5,
      growthComparisonLabel: 'Изменение B2C относительно общего зарплатного продукта II квартала. Вклад в DDI учитывается с весом ½.'};
  })};
}
