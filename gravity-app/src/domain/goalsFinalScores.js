import {isDdIndexMetric} from './report.js';

export const GOALS_FINAL_COUNTERPARTS = {
  'goals.monitored': 'goals.po_monitoring',
  'goals.factor_analysis_l1_l2': 'goals.po_factor_analysis',
  'goals.forecast': 'goals.po_forecast',
};

export function applyGoalsFinalScores(products, period, overlays, previousProducts = []) {
  if (period !== 'III кв. 2026') return products;
  const assessments = (Array.isArray(overlays) ? overlays : [overlays]).filter((item) =>
    item?.scope === 'goals-final-scores' && item.period === period);
  if (!assessments.length) return products;
  if (assessments.length !== 1) throw new Error('Only one final Q3 goals score source is allowed');
  const assessment = assessments[0];
  const pcAssessment = (Array.isArray(overlays) ? overlays : [overlays]).find((item) =>
    item?.scope === 'pc-final-score-assessment' && item.period === period);
  return products.map((product) => {
    const assessmentName = ['Зарплатный продукт #B2B', 'Зарплатный продукт #B2C'].includes(product.name)
      && product.unit === 'DB' ? 'Зарплатный продукт' : product.name;
    const rows = assessment.products.filter((row) => row.name === assessmentName && row.unit === product.unit);
    if (rows.length !== 1) throw new Error(`Final goals identity is missing or ambiguous: ${product.unit} / ${product.name}`);
    const pcRows = product.unit === 'PC'
      ? (pcAssessment?.products || []).filter((candidate) => candidate.id === String(product.id || '').replace(/::empty::.*$/, '')
        && candidate.name === assessmentName && candidate.unit === product.unit && candidate.type === product.type)
      : [];
    if (pcRows.length > 1) throw new Error(`PC goals identity is ambiguous: ${product.name}`);
    const pcRow = pcRows[0];
    const row = pcRow?.goals ? {
      ...rows[0],
      final: {...rows[0].final, ...pcRow.goals.final},
      lulT: {...rows[0].lulT, ...pcRow.goals.lulT},
      po: {...rows[0].po, ...pcRow.goals.po},
    } : rows[0];
    const previousProduct = previousProducts.find((candidate) => candidate.period === 'II кв. 2026'
      && candidate.id === String(product.id || '').replace(/::empty::.*$/, '')
      && ['name', 'unit', 'type'].every((key) => candidate[key] === product[key]));
    const update = (metric, value, level, baseCode, informational = false) => {
      if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) {
        throw new Error(`Invalid final goals score: ${product.name} / ${level} / ${metric.code}`);
      }
      const numeric = Number.isFinite(value);
      const maximum = numeric ? 1 : 0;
      const previousMetric = previousProduct?.metrics.find((block) => block.code === 'goals')
        ?.metrics.find((candidate) => candidate.code === baseCode);
      // Intermediate Q3 applicability may erase a valid Q2 comparison before final scores restore the rubric.
      const restoreComparison = !Number.isFinite(metric.previousValue) && isDdIndexMetric(previousMetric)
        && Number.isFinite(previousMetric.value) && previousMetric.value >= 0
        && previousMetric.value <= previousMetric.max_value && previousMetric.max_value === 1
        && Number.isFinite(row.final[baseCode]);
      const pcValue = pcRow?.goals?.[level === 'final' ? 'final' : level === 'Уровень ЛЮ/ЛТ' ? 'lulT' : 'po'];
      const pcCode = level === 'final' ? baseCode : metric.code;
      const usePcSource = Boolean(pcValue && Object.hasOwn(pcValue, pcCode));
      return {...metric, value, max_value: maximum, is_applicabble_flg: numeric, hidden_from_profile: false,
        ...(restoreComparison ? {previousValue: previousMetric.value, previousMaxValue: previousMetric.max_value,
          previousPeriod: previousProduct.period} : {}),
        ...(informational ? {excluded_from_index: true, dd_calculation_flg: 0}
          : {excluded_from_index: !numeric, dd_calculation_flg: numeric ? 1 : 0}),
        metric_subgroup: informational ? 'Уровень ЛЮ/ЛТ' : 'Уровень PO',
        source: {...(usePcSource ? pcAssessment.source : assessment.source),
          origin: usePcSource ? 'userConfirmedPCFinalScore' : 'userConfirmedGoalScores', period,
          file: usePcSource ? 'gravity-app/src/data/pc-final-scores-q3-2026.json' : 'gravity-app/src/data/goals-final-scores-q3-2026.json', level,
          sourceName: row.name, sourceUnit: row.unit, metricCode: baseCode, selectedValue: value,
          ...(assessmentName !== product.name ? {combinedSalaryAssessment: true} : {})},
        ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
          ...item, value, max_value: maximum, gap: numeric ? Math.max(0, maximum - value) : null,
        }))} : {})};
    };
    let found = false;
    const metrics = product.metrics.map((block) => {
      if (block.code !== 'goals') return block;
      found = true;
      const known = new Map(block.metrics.map((metric) => [metric.code, metric]));
      for (const [baseCode, poCode] of Object.entries(GOALS_FINAL_COUNTERPARTS)) {
        if (!known.has(baseCode) || !known.has(poCode)) throw new Error(`Final goals rubric missing: ${product.name} / ${baseCode}`);
      }
      const entries = block.metrics.map((metric) => {
        if (Object.hasOwn(GOALS_FINAL_COUNTERPARTS, metric.code)) return update(metric, row.lulT[metric.code], 'Уровень ЛЮ/ЛТ', metric.code, true);
        const baseCode = Object.keys(GOALS_FINAL_COUNTERPARTS).find((key) => GOALS_FINAL_COUNTERPARTS[key] === metric.code);
        if (!baseCode) return metric;
        const finalMetric = update(metric, row.final[baseCode], 'final', baseCode);
        const priorLevelMetric = block.metrics.find((candidate) => candidate.code === baseCode);
        return Number.isFinite(priorLevelMetric?.previousValue) && Number.isFinite(priorLevelMetric?.previousMaxValue)
          ? {...finalMetric, previousValue: priorLevelMetric.previousValue,
            previousMaxValue: priorLevelMetric.previousMaxValue, previousPeriod: priorLevelMetric.previousPeriod}
          : finalMetric;
      });
      const poLevelMetrics = Object.entries(GOALS_FINAL_COUNTERPARTS).map(([baseCode, poCode]) => {
        const finalMetric = entries.find((metric) => metric.code === poCode);
        const value = row.po[poCode];
        const pcPoOverride = Boolean(pcRow?.goals?.po && Object.hasOwn(pcRow.goals.po, poCode));
        if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) throw new Error(`Invalid PO level score: ${product.name} / ${poCode}`);
        if (value === null) return {...finalMetric, value: null, max_value: 0, is_applicabble_flg: false,
          hidden_from_profile: false, excluded_from_index: true, dd_calculation_flg: 0,
          source: {...finalMetric.source, level: 'Уровень PO', selectedValue: null}};
        return {...finalMetric, value, max_value: 1, is_applicabble_flg: true, hidden_from_profile: false,
          excluded_from_index: true, dd_calculation_flg: 0,
          source: {...(pcPoOverride ? pcAssessment.source : finalMetric.source),
            ...(pcPoOverride ? {origin: 'userConfirmedPCFinalScore', file: 'gravity-app/src/data/pc-final-scores-q3-2026.json',
              sourceName: row.name, sourceUnit: row.unit, metricCode: baseCode} : {}),
            level: 'Уровень PO', selectedValue: value},
          ...(finalMetric.recommendation_items ? {recommendation_items: finalMetric.recommendation_items.map((item) => ({
            ...item, value, max_value: 1, gap: Math.max(0, 1 - value),
          }))} : {})};
      });
      return {...block, name: 'Цели', goalsLevels: true, metrics: entries,
        goalsFinalScores: {...row.final}, goalsPoLevelMetrics: poLevelMetrics};
    });
    if (!found) throw new Error(`Final goals block missing: ${product.name}`);
    return {...product, metrics, indexMaxPoints: metrics.flatMap((block) => block.metrics).filter(isDdIndexMetric)
      .reduce((sum, metric) => sum + Number(metric.max_value), 0)};
  });
}
