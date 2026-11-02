import {isDdIndexMetric} from './report.js';
import {applyNavigatorKnowledge} from './navigatorKnowledge.js';

const originalId = (product) => String(product.id || '').replace(/::empty::.*/, '');
const sameTeam = (a, b) => originalId(a) === originalId(b)
  && ['name', 'unit', 'type'].every((key) => a[key] === b[key]);

// The latest user rule takes precedence over older assessment and carry rules.
export function applyKeyMetricsWorkbookPriority(products, period, overlays, baselineProducts) {
  if (period !== 'III кв. 2026') return products;
  const assessments = Array.isArray(overlays) ? overlays : [overlays];
  const workbook = assessments.find((item) => item?.period === period
    && item.scope === 'key-metrics-assessment' && item.source?.file === 'Ключевые метрики Продукта Баллы.xlsx');
  if (!workbook) return products;
  const directAssessments = assessments.filter((item) => item?.period === period
    && ['key-metrics-assessment', 'q3-score-correction'].includes(item.scope));
  const codes = new Set(workbook.source.metricCodes || []);
  return products.map((product) => {
    const priors = baselineProducts.filter((item) => item.period === 'II кв. 2026' && sameTeam(item, product));
    const prior = priors.length === 1 ? priors[0] : null;
    const team = [...workbook.products, ...(workbook.additionalTeamAssessments || [])].find((item) => sameTeam(item, product));
    const pending = (workbook.pending || []).filter((item) => sameTeam(item, product));
    if (!prior && !team && !pending.length) return product;
    const metrics = product.metrics.map((block) => block.code !== 'general' ? block : {...block,
      metrics: block.metrics.map((metric) => {
        if (!codes.has(metric.code) || metric.is_applicabble_flg === false || !(Number(metric.max_value) > 0)) return metric;
        const directFact = directAssessments.flatMap((item) => item.products || [])
          .find((item) => sameTeam(item, product)
            && (item.metrics?.[metric.code]?.source?.priorityOverWorkbook === true
              || (item.metrics?.[metric.code]?.source?.correction?.origin === 'userConfirmedQ3ScoreCorrection'
                && item.metrics?.[metric.code]?.source?.correction?.confirmedBy === 'user'
                && item.metrics?.[metric.code]?.source?.correction?.period === period)))?.metrics?.[metric.code];
        if (directFact?.source?.origin === 'userConfirmedDirectNavigatorAssessment' && [0, 0.5, 1].includes(directFact.rawValue)) {
          const value = directFact.rawValue * Number(metric.max_value);
          return {...metric, value, source: {...directFact.source, rawValue: directFact.rawValue},
            ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
              ...item, value, max_value: metric.max_value, gap: Number(metric.max_value) - value,
            }))} : {})};
        }
        if (directFact?.source?.correction?.origin === 'userConfirmedQ3ScoreCorrection'
          && directFact.source.correction.confirmedBy === 'user'
          && directFact.source.correction.period === period
          && [0, 0.5, 1].includes(directFact.rawValue)) {
          const value = directFact.rawValue * Number(metric.max_value);
          return {...metric, value, source: {...directFact.source, rawValue: directFact.rawValue},
            ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
              ...item, value, max_value: metric.max_value, gap: Number(metric.max_value) - value,
            }))} : {})};
        }
        if (metric.source?.origin === 'userConfirmedKeyMetricsAccuracyCap') return metric;
        const old = prior?.metrics.find((item) => item.code === 'general')?.metrics.find((item) => item.code === metric.code);
        const fact = team?.metrics?.[metric.code];
        const explicit = fact?.source?.origin === 'keyMetricsWorkbookAssessment' && [0, 1].includes(fact.rawValue);
        const blocked = pending.some((item) => item.metricCode === metric.code);
        const restored = pending.find((item) => item.metricCode === metric.code)?.restoredAssessment;
        if (restored?.source?.origin === 'userConfirmedMarketHoleRecovery20261102'
          && restored.source.confirmedBy === 'user' && [0, 1].includes(restored.rawValue)) {
          const value = restored.rawValue * Number(metric.max_value);
          return {...metric, value, source: {...restored.source, rawValue: restored.rawValue},
            ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
              ...item, value, max_value: metric.max_value, gap: Number(metric.max_value) - value,
            }))} : {})};
        }
        // New salary cohorts have no individual Q2 history. Their combined profile
        // keeps the equal-weight cohort assessment rather than a fabricated baseline.
        if (!explicit && !blocked && (!prior || product.salaryCohorts)) {
          if (!product.salaryCohorts) return metric;
          const cohortMetrics = Object.values(product.salaryCohorts).map((cohort) =>
            cohort.metrics.find((entry) => entry.code === 'general')?.metrics.find((entry) => entry.code === metric.code));
          if (cohortMetrics.length !== 2 || cohortMetrics.some((item) => !item || item.max_value !== metric.max_value)) return metric;
          const value = cohortMetrics.every((item) => Number.isFinite(item.value))
            ? (cohortMetrics[0].value + cohortMetrics[1].value) / 2 : null;
          return {...metric, value, source: {origin: 'salaryCohortAverage', period,
            rule: 'Среднее арифметическое оценок B2B и B2C с равными весами 1/2. Пропуск не заменяется нулём.',
            cohorts: Object.fromEntries(['b2b', 'b2c'].map((key) => {
              const item = product.salaryCohorts[key].metrics.find((entry) => entry.code === 'general').metrics.find((entry) => entry.code === metric.code);
              return [key, {value: item.value, maxValue: item.max_value, applicable: item.is_applicabble_flg !== false && item.max_value > 0, source: item.source}];
            }))}, ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
              ...item, value, max_value: metric.max_value, gap: value === null ? null : Number(metric.max_value) - value,
            }))} : {})};
        }
        const validPrior = old && old.is_applicabble_flg !== false && Number(old.max_value) > 0
          && Number.isFinite(old.value) && old.value >= 0 && old.value <= Number(old.max_value);
        const value = blocked ? null : explicit ? fact.rawValue * Number(metric.max_value)
          : validPrior ? old.value / Number(old.max_value) * Number(metric.max_value) : null;
        const source = explicit && !blocked ? {...fact.source, rawValue: fact.rawValue}
          : {origin: blocked ? 'keyMetricsWorkbookUnresolved' : 'keyMetricsPreviousQuarterFallback',
            confirmedBy: 'user', date: '2026-11-02', period, file: workbook.source.file,
            workbookSha256: workbook.source.sha256,
            rule: 'Числовые баллы файла имеют приоритет. Только отсутствующие пары переносятся из предыдущего квартала; текстовые и конфликтующие строки остаются без оценки.',
            ...(blocked ? {sourceRows: pending.find((item) => item.metricCode === metric.code).sourceRows}
              : {fromPeriod: prior.period, sourceValue: old?.value ?? null, sourceMaxValue: old?.max_value ?? null})};
        return {...metric, value, source,
          ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
            ...item, value, max_value: metric.max_value, gap: value === null ? null : Number(metric.max_value) - value,
          }))} : {})};
      })});
    const resolved = {...product, metrics, indexMaxPoints: metrics.flatMap((block) => block.metrics)
      .filter(isDdIndexMetric).reduce((sum, metric) => sum + Number(metric.max_value), 0)};
    const navigator = metrics.flatMap(block => block.metrics).find(metric => metric.code === 'general.navigator_reporting_knowledge');
    if (originalId(product) === 'e8c97fe4-bd38-5aa1-9388-5c532cbde6f2¦ДСЖ ПК'
      && product.name === 'ДСЖ ПК' && product.unit === 'УБ' && product.type === 'Продукт'
      && navigator?.source?.origin === 'keyMetricsPreviousQuarterFallback') {
      // The user requested the current knowledge rule for DSZh PK, not its Q2 fallback.
      return applyNavigatorKnowledge([resolved], period)[0];
    }
    return resolved;
  });
}
