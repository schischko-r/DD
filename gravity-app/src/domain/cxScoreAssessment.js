import {isDdIndexMetric} from './report.js';

const code = 'cx.score';
const matches = (team, product) => team.id === String(product.id || '').replace(/::empty::.*$/, '')
  && ['name', 'unit', 'type'].every((key) => team[key] === product[key]);

export function applyCxScoreAssessments(products, period, overlays, baselineProducts = []) {
  if (period !== 'III кв. 2026') return products;
  const assessments = overlays.filter((item) => item.scope === 'cx-score-assessment' && item.period === period);
  if (!assessments.length) return products;
  return products.map((product) => {
    // Later Q3 overlays contain explicit corrections and must supersede the original assessment.
    const team = assessments.flatMap((item) => item.products || []).findLast((team) => matches(team, product));
    const fact = team?.metrics?.[code];
    if (![0, 0.5, 1].includes(fact?.rawValue)) return product;
    const priorProduct = baselineProducts.find((candidate) => matches(candidate, product));
    const prior = priorProduct?.metrics.flatMap((block) => block.metrics || []).find((metric) => metric.code === code);
    const previous = priorProduct?.period !== period && isDdIndexMetric(prior)
      && prior.max_value === 1 && Number.isFinite(prior.value)
      ? {previousValue: prior.value, previousMaxValue: 1, previousPeriod: priorProduct.period} : {};
    const update = (metric = {
      code, name: 'CX Score', footer: 'Зеленая зона клиентского пути',
      recommendation: 'Достигнуть целевого CX Score', recommendation_difficulty: 5,
      recommendation_items: [{recommendation: 'Достигнуть целевого CX Score', group: 5, recommendation_difficulty: 5}],
    }) => ({
      ...metric, value: fact.rawValue, max_value: 1, is_applicabble_flg: true,
      excluded_from_index: false, dd_calculation_flg: 1,
      traffic_light: fact.rawValue === 1 ? 'green' : fact.rawValue === 0.5 ? 'yellow' : 'red',
      ...previous,
      source: {...fact.source, rawValue: fact.rawValue},
      ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
        ...item, value: fact.rawValue, max_value: 1, gap: 1 - fact.rawValue,
      }))} : {}),
    });
    let found = false;
    const metrics = product.metrics.map((block) => {
      if (!(block.metrics || []).some((metric) => metric.code === code) && block.code !== 'cx') return block;
      const hasMetric = block.metrics.some((metric) => metric.code === code);
      found = true;
      return {...block, metrics: hasMetric
        ? block.metrics.map((metric) => metric.code === code ? update(metric) : metric)
        : [...block.metrics, update()]};
    });
    if (!found) metrics.push({code: 'cx', name: 'Клиентский опыт', metrics: [update()]});
    return {...product, metrics, indexMaxPoints: metrics.flatMap((block) => block.metrics || [])
      .filter(isDdIndexMetric).reduce((sum, metric) => sum + Number(metric.max_value), 0)};
  });
}
