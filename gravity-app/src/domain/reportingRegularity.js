export function applyReportingFormatAssessments(products, period, overlays = []) {
  if (period !== 'III кв. 2026') return products;
  const assessments = (Array.isArray(overlays) ? overlays : [overlays]).filter(item =>
    item?.period === period && item.scope === 'reporting-format-assessment');
  return products.map(product => {
    const records = assessments.flatMap(item => item.products || []).filter(team =>
      team.id === String(product.id).replace(/::empty::.*/, '')
      && ['name', 'unit', 'type'].every(key => team[key] === product[key]));
    if (records.length !== 1) return product;
    return {...product, metrics: product.metrics.map(block => ({...block,
      metrics: block.metrics.map(metric => {
        const fact = records[0].metrics?.[metric.code];
        if (!fact || fact.rawValue !== 0.5 || fact.source?.reportFormat !== 'excel'
          || !/^Да, автоматическая.*monthly/i.test(fact.source?.answer || '')
          || !(/\.nastroena_otchetnostь$/.test(metric.code) || /регулярность/i.test(metric.name || ''))
          || metric.is_applicabble_flg === false || !(metric.max_value > 0)) return metric;
        const value = 0.5 * metric.max_value;
        if (metric.value === value && metric.source?.origin === fact.source.origin) return metric;
        return {...metric, value, source: {...fact.source, rawValue: 0.5,
          previousAssessmentSource: metric.source || null, previousAssessmentValue: metric.value},
          ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map(item => ({
            ...item, value, max_value: metric.max_value, gap: metric.max_value - value,
          }))} : {}),
        };
      }),
    }))};
  });
}

export function applyReportingRegularity(products, period, baselineProducts = []) {
  if (period !== 'III кв. 2026') return products;
  return products.map((product) => {
    let changed = false;
    const baseline = baselineProducts.find((p) => p.id === String(product.id).replace(/::empty::.*/, '')
      && p.name === product.name && p.unit === product.unit && p.type === product.type);
    const metrics = product.metrics.map((block) => {
      const report = block.metrics.find((m) => /\.nastroena_otchetnostь$/.test(m.code));
      if (!report || report.is_applicabble_flg === false || !(Number(report.max_value) > 0)
        || !Number.isFinite(report.value) || report.value !== Number(report.max_value)) return block;
      const entries = block.metrics.map((metric) => {
        if (!/регулярность/i.test(metric.name || '') || metric.is_applicabble_flg === false
          || !(Number(metric.max_value) > 0) || Number.isFinite(metric.value)) return metric;
        changed = true;
        const prior = baseline?.metrics.flatMap((b) => b.metrics).find((m) => m.code === metric.code);
        const previous = prior && prior.is_applicabble_flg !== false && Number.isFinite(prior.value)
          && prior.max_value === metric.max_value
          ? {previousValue: prior.value, previousMaxValue: prior.max_value, previousPeriod: baseline.period} : {};
        return {...metric, value: Number(metric.max_value), ...previous,
          source: {origin: 'userConfirmedReportingRegularityRule', confirmedBy: 'user', period,
            reportingCode: report.code, reportingValue: report.value, reportingMaxValue: report.max_value,
            rule: 'Полная оценка настроенной отчётности в III квартале означает полную оценку регулярности.'},
          ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
            ...item, value: Number(metric.max_value), max_value: metric.max_value, gap: 0,
          }))} : {}),
        };
      });
      return entries.some((m, i) => m !== block.metrics[i]) ? {...block, metrics: entries} : block;
    });
    return changed ? {...product, metrics} : product;
  });
}

export function applyReportingMissingAssessments(products, period, assessment, baselineProducts = []) {
  if (period !== 'III кв. 2026' || assessment?.period !== period
    || assessment.scope !== 'reporting-regularity-missing-assessment') return products;
  const same = (fact, product) => fact.id === String(product.id).replace(/::empty::.*/, '')
    && ['name', 'unit', 'type'].every((field) => fact[field] === product[field]);
  return products.map((product) => {
    const matches = (assessment.products || []).filter((fact) => same(fact, product));
    if (matches.length !== 1) return product;
    const priorProduct = baselineProducts.find((prior) => same(prior, product));
    const metrics = product.metrics.map((block) => ({...block, metrics: block.metrics.map((metric) => {
      const fact = matches[0].metrics?.[metric.code];
      if (!fact || ![0, 0.5, 1].includes(fact.rawValue) || metric.value !== null
        || metric.is_applicabble_flg === false || !(Number(metric.max_value) > 0)
        || fact.expectedMaxValue !== metric.max_value
        || !(/\.nastroena_otchetnostь$/.test(metric.code) || /регулярность/i.test(metric.name || ''))) return metric;
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
