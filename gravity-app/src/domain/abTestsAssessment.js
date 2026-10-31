import {isDdIndexMetric} from './report.js';

const code = 'hyp.ab_tests';
const matches = (team, product) => team.id === String(product.id || '').replace(/::empty::.*$/, '')
  && ['name', 'unit', 'type'].every((key) => team[key] === product[key]);

export function applyAbTestsAssessments(products, period, overlays, baselineProducts = []) {
  if (period !== 'III кв. 2026') return products;
  const assessments = overlays.filter((item) => item.scope === 'ab-tests-assessment' && item.period === period);
  if (!assessments.length) return products;
  return products.map((product) => {
    const records = assessments.flatMap((item) => item.products || []).filter((team) => matches(team, product));
    if (records.length !== 1) return product;
    const fact = records[0].metrics?.[code];
    if (![0, 0.25, 0.5, 1].includes(fact?.rawValue)) return product;
    const maxValue = fact.rawValue === 0.25 ? 0.25 : 1;
    const priorProduct = baselineProducts.find((candidate) => matches(candidate, product));
    const prior = priorProduct?.metrics.flatMap((block) => block.metrics || []).find((metric) => metric.code === code);
    const previous = priorProduct?.period !== period && isDdIndexMetric(prior)
      && prior.max_value === 1 && Number.isFinite(prior.value)
      ? {previousValue: prior.value, previousMaxValue: 1, previousPeriod: priorProduct.period} : {};
    const update = (metric = {code, name: 'A/B-тесты', footer: 'Проведение A/B тестов',
      recommendation: 'Проводить A/B-тесты', recommendation_difficulty: 5,
      recommendation_items: [{recommendation: 'Проводить A/B-тесты', group: 5, recommendation_difficulty: 5}],
    }) => ({...metric, value: fact.rawValue, max_value: maxValue, is_applicabble_flg: true,
      excluded_from_index: false, dd_calculation_flg: 1, ...previous,
      source: {...fact.source, rawValue: fact.rawValue},
      ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
        ...item, value: fact.rawValue, max_value: maxValue, gap: maxValue - fact.rawValue,
      }))} : {})});
    let found = false;
    const metrics = product.metrics.map((block) => {
      const hasMetric = (block.metrics || []).some((metric) => metric.code === code);
      if (!hasMetric && block.code !== 'hyp') return block;
      found = true;
      return {...block, metrics: hasMetric
        ? block.metrics.map((metric) => metric.code === code ? update(metric) : metric)
        : [...block.metrics, update()]};
    });
    if (!found) metrics.push({code: 'hyp', name: 'Работа с гипотезами', metrics: [update()]});
    return {...product, metrics, indexMaxPoints: metrics.flatMap((block) => block.metrics || [])
      .filter(isDdIndexMetric).reduce((sum, metric) => sum + Number(metric.max_value), 0)};
  });
}
