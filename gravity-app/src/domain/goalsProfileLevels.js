import {isDdIndexMetric} from './report.js';

const PO_GOAL_CODES = new Set(['goals.po_monitoring', 'goals.po_forecast', 'goals.po_factor_analysis']);

export function applyPoGoalsTemplate(products, period, overlays) {
  if (period !== 'III кв. 2026') return products;
  const template = overlays.find(item => item.scope === 'po-goals-template' && item.period === period);
  if (!template) return products;
  const assessments = overlays.filter(item => item.scope === 'po-goals-assessment' && item.period === period)
    .flatMap(item => item.products || []);
  return products.map(product => {
    const assessment = assessments.find(team => team.id === String(product.id).replace(/::empty::.*/, '')
      && ['name', 'unit', 'type'].every(key => team[key] === product[key]));
    const metrics = product.metrics.map(block => {
      if (block.code !== 'goals') return block;
      const missing = template.metrics.filter(metric => PO_GOAL_CODES.has(metric.code)
        && !block.metrics.some(existing => existing.code === metric.code));
      const entries = [...block.metrics, ...missing.map(metric => ({...metric,
        value: null, max_value: 1, is_applicabble_flg: true, excluded_from_index: false,
        dd_calculation_flg: 1, source: {...template.source, period},
      }))];
      return {...block, metrics: entries.map(metric => {
        const fact = assessment?.metrics?.[metric.code];
        if (!PO_GOAL_CODES.has(metric.code) || !fact || ![null, 0, 0.5, 1].includes(fact.rawValue)) return metric;
        if (fact.applicable === false) return {...metric, value: null, max_value: 0,
          is_applicabble_flg: false, excluded_from_index: true, dd_calculation_flg: 1,
          hidden_from_profile: fact.hiddenFromProfile === true, source: fact.source};
        return {...metric, value: fact.rawValue, max_value: 1, is_applicabble_flg: true,
          excluded_from_index: false, dd_calculation_flg: 1, source: fact.source};
      })};
    });
    return {...product, metrics, indexMaxPoints: metrics.flatMap(block => block.metrics)
      .filter(isDdIndexMetric).reduce((sum, metric) => sum + Number(metric.max_value), 0)};
  });
}

export function goalsProfileLevels(block, period) {
  if (period !== 'III кв. 2026' || block.code !== 'goals') return block;
  return {...block, name: 'Цели', goalsLevels: true, metrics: (block.metrics || []).map(metric => ({
    ...metric, metric_subgroup: PO_GOAL_CODES.has(metric.code) ? 'Уровень PO' : 'Уровень ЛЮ/ЛТ',
  }))};
}
