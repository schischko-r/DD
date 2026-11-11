import {isDdIndexMetric} from './report.js';

export const SALARY_TOGGLE_BLOCK_CODES = ['general', 'attract', 'churn', 'mehaniki', 'hyp'];
const average = (a, b) => Number.isFinite(a) && Number.isFinite(b) ? (a + b) / 2 : null;
const applicable = (metric) => metric?.is_applicabble_flg !== false && Number(metric?.max_value) > 0;

export function averageSalaryCohortMetric(b2b, b2c, period, prior) {
  const {previousValue, previousMaxValue, previousPeriod, ...rubric} = b2c;
  const compatible = applicable(b2b) && applicable(b2c) && b2b.max_value === b2c.max_value;
  const value = compatible ? average(b2b.value, b2c.value) : null;
  const source = {origin: 'salaryCohortAverage', period, rule: 'Среднее арифметическое оценок B2B и B2C с равными весами 1/2. Пропуск не заменяется нулём.',
    cohorts: Object.fromEntries([['b2b', b2b], ['b2c', b2c]].map(([key, metric]) => [key, {
      value: metric.value, maxValue: metric.max_value, applicable: applicable(metric), source: metric.source,
    }])), compatibleRubrics: compatible || (!applicable(b2b) && !applicable(b2c))};
  const previous = prior && applicable(prior) && prior.max_value === rubric.max_value && Number.isFinite(prior.value)
    ? {previousValue: prior.value, previousMaxValue: prior.max_value, previousPeriod: 'II кв. 2026'} : {};
  const components = b2b.crossSellComponents && b2c.crossSellComponents ? Object.fromEntries(['during', 'after'].map((key) => {
    const left = b2b.crossSellComponents[key], right = b2c.crossSellComponents[key];
    const bothIrrelevant = left?.applicable === false && right?.applicable === false;
    return [key, {...right, value: bothIrrelevant ? null : average(left?.value, right?.value),
      ...(key === 'after' ? {rawValue: bothIrrelevant ? null : average(left?.rawValue, right?.rawValue), applicable: !bothIrrelevant} : {}),
      source: {origin: 'salaryCohortAverage', period, cohorts: {b2b: left?.source, b2c: right?.source}}}];
  })) : null;
  return {...rubric, value, source, ...previous,
    ...(components ? {crossSellComponents: components} : {}),
    ...(rubric.recommendation_items ? {recommendation_items: rubric.recommendation_items.map((item) => ({
      ...item, value, max_value: rubric.max_value, gap: value === null ? null : Math.max(0, rubric.max_value - value),
    }))} : {})};
}

export function mergeSalaryCohorts(products, period, salaryConfig, baselineProducts = []) {
  if (period !== 'III кв. 2026' || salaryConfig?.period !== period) return products;
  if (!products.length) return products;
  const baseId = salaryConfig.source?.baseTeamId;
  const children = (salaryConfig.products || []).map((record) => ({record,
    product: products.find((p) => p.id.replace(/::empty::.*/, '') === record.id
      && ['name', 'unit', 'type'].every((field) => p[field] === record[field]))}));
  if (!children.length) return products;
  const b2b = children.find(({record}) => record.cohort === 'B2B')?.product;
  const b2c = children.find(({record}) => record.cohort === 'B2C')?.product;
  if (!b2b || !b2c) throw new Error('Both salary cohorts are required for the combined Q3 product');
  const prior = baselineProducts.find((p) => p.id === baseId && p.period === 'II кв. 2026');
  if (!prior) throw new Error('The original salary product identity is required');
  const metrics = b2c.metrics.map((block) => {
    const other = b2b.metrics.find((candidate) => candidate.code === block.code);
    if (!SALARY_TOGGLE_BLOCK_CODES.includes(block.code)) {
      if (!other || block.metrics.some((metric) => {
        const counterpart = other.metrics.find((candidate) => candidate.code === metric.code);
        return !counterpart || counterpart.value !== metric.value || counterpart.max_value !== metric.max_value
          || counterpart.is_applicabble_flg !== metric.is_applicabble_flg;
      })) throw new Error(`Unshared salary assessment outside the five averaged blocks: ${block.code}`);
      return block;
    }
    return {...block, source: {origin: 'salaryCohortAverage', period,
      cohorts: {b2b: {teamId: b2b.id, respondent: b2b.respondent}, b2c: {teamId: b2c.id, respondent: b2c.respondent}}},
      metrics: block.metrics.map((metric) => {
        const counterpart = other?.metrics.find((candidate) => candidate.code === metric.code);
        if (!counterpart) throw new Error(`Salary cohort metric missing: ${block.code} / ${metric.code}`);
        return averageSalaryCohortMetric(counterpart, metric, period, prior.metrics.flatMap((entry) => entry.metrics).find((entry) => entry.code === metric.code));
      })};
  });
  const merged = {...b2c, id: `${baseId}::empty::${period}`, name: prior.name, unit: prior.unit, type: prior.type,
    salaryCohorts: {b2b, b2c}, salaryToggleBlockCodes: SALARY_TOGGLE_BLOCK_CODES,
    respondent: [b2b.respondent, b2c.respondent].join('; '),
    respondentSource: {origin: 'salaryCohortAverage', cohorts: {b2b: b2b.respondentSource, b2c: b2c.respondentSource}},
    metrics, indexMaxPoints: metrics.flatMap((block) => block.metrics).filter(isDdIndexMetric)
      .reduce((sum, metric) => sum + Number(metric.max_value), 0)};
  let emitted = false;
  return products.flatMap((product) => {
    if (product !== b2b && product !== b2c) return [product];
    if (emitted) return [];
    emitted = true;
    return [merged];
  });
}
