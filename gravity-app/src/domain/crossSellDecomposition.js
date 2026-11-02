import {isDdIndexMetric} from './report.js';

export function hasCrossSellDecomposition(product, metric) {
  return product?.period === 'III кв. 2026' && metric?.code === 'mehaniki.cross_sell';
}

export function crossSellAfterPurchaseResponses(product, survey) {
  if (product?.period !== survey?.period) return [];
  return (survey.products || []).find((team) => team.id === String(product.id || '').replace(/::empty::.*$/, '')
    && team.name === product.name && team.unit === product.unit && team.type === product.type)?.responses || [];
}

export function crossSellAfterPurchaseStatus(responses) {
  const answers = [...new Set(responses.map((row) => row.answer).filter(Boolean))];
  if (!answers.length) return {label: 'Нет ответа', theme: 'normal'};
  if (answers.length > 1) return {label: 'Ответы различаются', theme: 'warning'};
  return {label: answers[0], theme: answers[0] === 'Да' ? 'success' : 'normal'};
}
export function sumCrossSellComponents(metric, assessment) {
  if (metric?.code !== 'mehaniki.cross_sell' || metric.crossSellComponents) return metric;
  if (assessment?.postPurchaseApplicable === false) return {
    ...metric,
    crossSellComponents: {
      during: {value: metric.value, source: metric.source},
      after: {value: null, rawValue: null, applicable: false, source: assessment.source},
    },
  };
  if (![0, 0.5, 1].includes(assessment?.postPurchaseValue)) return metric;
  const componentMax = (Number(metric.max_value) > 0 ? metric.max_value : 1) / 2;
  const afterValue = assessment.postPurchaseValue * componentMax;
  const crossSellComponents = {
    during: {value: metric.value, source: metric.source},
    after: {value: afterValue, rawValue: assessment.postPurchaseValue, applicable: true, source: assessment.source},
  };
  if (!isDdIndexMetric(metric) || !Number.isFinite(metric.value) || metric.value < 0 || metric.value > metric.max_value) {
    return {...metric, crossSellComponents};
  }
  const value = Math.min(metric.max_value, Math.min(metric.value, componentMax) + afterValue);
  return {
    ...metric,
    value,
    source: {origin: 'crossSellComponentSum', period: assessment.source?.period, rawValue: value / metric.max_value},
    crossSellComponents,
    ...(Array.isArray(metric.recommendation_items) ? {recommendation_items: metric.recommendation_items.map((item) => ({
      ...item, value, max_value: metric.max_value, gap: Math.max(0, metric.max_value - value),
    }))} : {}),
  };
}

export function applyCrossSellDuringPurchaseScores(products, period, assessment) {
  if (period !== 'III кв. 2026' || assessment?.period !== period
    || assessment?.scope !== 'crosssell-during-purchase-assessment') return products;
  const facts = assessment.products || [];
  let anyChanged = false;
  const apply = (product) => {
    const baseId = String(product.sourceTeamId || product.id || '').replace(/::empty::.*$/, '');
    const factTeam = facts.find((team) => team.id === baseId
      && (team.name === product.name || product.sourceTeamId === baseId));
    const fact = factTeam?.metrics?.['mehaniki.cross_sell'];
    const cohorts = product.salaryCohorts ? Object.fromEntries(Object.entries(product.salaryCohorts)
      .map(([key, cohort]) => [key, apply(cohort)])) : null;
    if (![0, 1].includes(fact?.rawValue)) {
      return cohorts && Object.entries(cohorts).some(([key, cohort]) => cohort !== product.salaryCohorts[key])
        ? {...product, salaryCohorts: cohorts} : product;
    }
    let changed = false;
    const metrics = product.metrics.map((block) => ({...block, metrics: block.metrics.map((metric) => {
      if (metric.code !== 'mehaniki.cross_sell') return metric;
      const max = Number(metric.max_value) > 0 ? Number(metric.max_value) : 1;
      const duringValue = fact.rawValue * max / 2;
      const after = metric.crossSellComponents?.after || {
        value: 0, rawValue: 0, applicable: true,
        source: {origin: 'userConfirmedCrossSellMissingAsZero', confirmedBy: 'user', period},
      };
      const value = Math.min(max, duringValue + (after.applicable === false ? 0 : Number(after.value) || 0));
      changed = true;
      const crossSellComponents = {during: {value: duringValue, rawValue: fact.rawValue, source: fact.source}, after};
      return {...metric, max_value: max, value, is_applicabble_flg: true, excluded_from_index: false,
        dd_calculation_flg: 1, source: {origin: 'crossSellComponentSum', period, rawValue: value / max,
          duringSource: fact.source, afterSource: after.source}, crossSellComponents,
        ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
          ...item, value, max_value: max, gap: Math.max(0, max - value),
        }))} : {}),
      };
    })}));
    if (!changed) return cohorts ? {...product, salaryCohorts: cohorts} : product;
    anyChanged = true;
    return {...product, metrics, ...(cohorts ? {salaryCohorts: cohorts} : {}),
      indexMaxPoints: metrics.flatMap((block) => block.metrics)
        .filter(isDdIndexMetric).reduce((sum, metric) => sum + Number(metric.max_value), 0)};
  };
  const result = products.map(apply);
  return anyChanged ? result : products;
}

export function defaultMissingCrossSell(metric, period) {
  if (period !== 'III кв. 2026' || metric?.code !== 'mehaniki.cross_sell'
    || metric.is_applicabble_flg === false || !(Number(metric.max_value) > 0)
    || Number.isFinite(metric.value)) return metric;
  const componentMax = Number(metric.max_value) / 2;
  const previous = metric.crossSellComponents || {};
  const defaultedComponents = [];
  const zero = (name, component) => {
    defaultedComponents.push(name);
    return {...component, value: 0, ...(name === 'after' ? {rawValue: 0, applicable: true} : {}),
      source: {origin: 'userConfirmedCrossSellMissingAsZero', confirmedBy: 'user', period,
        previousSource: component?.source,
        rule: 'Отсутствующее значение компонента Cross-sell в III квартале принимается за 0; это ручное правило, не подтверждение LossHunter.'}};
  };
  const during = Number.isFinite(previous.during?.value) ? previous.during : zero('during', previous.during);
  const after = previous.after?.applicable === false ? previous.after
    : Number.isFinite(previous.after?.value) ? previous.after
    : [0, 0.5, 1].includes(previous.after?.rawValue)
      ? {...previous.after, value: previous.after.rawValue * componentMax}
      : zero('after', previous.after);
  const value = Math.min(Number(metric.max_value), Math.max(0, Math.min(during.value, componentMax))
    + (after.applicable === false ? 0 : Math.max(0, Math.min(after.value, componentMax))));
  return {...metric, value, crossSellComponents: {during, after},
    source: {origin: 'crossSellComponentSum', period, rawValue: value / Number(metric.max_value),
      defaultedComponents, previousSource: metric.source},
    ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
      ...item, value, max_value: metric.max_value, gap: Math.max(0, metric.max_value - value),
    }))} : {})};
}

export function applyCrossSellMissingZeros(products, period) {
  if (period !== 'III кв. 2026') return products;
  return products.map((product) => {
    let changed = false;
    const metrics = product.metrics.map((block) => {
      const entries = block.metrics.map((metric) => {
        const next = defaultMissingCrossSell(metric, period);
        if (next !== metric) changed = true;
        return next;
      });
      return entries.some((entry, index) => entry !== block.metrics[index]) ? {...block, metrics: entries} : block;
    });
    return changed ? {...product, metrics} : product;
  });
}
