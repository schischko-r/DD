const PERIOD = 'III кв. 2026';
const origin = 'userConfirmedReportingAbsenceRule20261031';
const applicable = (metric) => metric?.is_applicabble_flg !== false && Number(metric?.max_value) > 0;
const empty = (value) => value == null || value === '';
const sameTeam = (record, product) => record.id === String(product.id).replace(/::empty::.*/, '')
  && ['name', 'unit', 'type'].every((field) => record[field] === product[field]);
const dependent = (metric) => /\.(?:(?:ispolьzovanie_)?regulyarnostь(?:_avto)?|report_completeness|polnota_otcheta|benchmarks|nalichie_benchmarkov)$/.test(metric.code || '');

// An explicit "Нет" becomes authoritative only while reporting is still absent or zero.
// Positive current reporting protects the whole block, including its historical assessments.
export function applyReportingAbsenceAssessments(products, period, overlays = []) {
  if (period !== PERIOD) return products;
  const assessments = (Array.isArray(overlays) ? overlays : [overlays]).filter((assessment) =>
    assessment?.period === period && assessment.scope === 'reporting-absence-assessment');
  if (!assessments.length) return products;
  return products.map((product) => {
    const records = assessments.flatMap((assessment) => assessment.products || []).filter((record) => sameTeam(record, product));
    if (!records.length) return product;
    let changed = false;
    const metrics = product.metrics.map((block) => {
      const evidence = records.flatMap((record) => record.blocks || []).filter((record) =>
        record.blockCode === block.code && record.reportingCode === `${block.code}.nastroena_otchetnostь`
        && record.answer === 'Нет' && record.source?.answer === 'Нет');
      if (evidence.length !== 1) return block;
      const fact = evidence[0];
      const reporting = block.metrics.find((metric) => metric.code === fact.reportingCode);
      if (!applicable(reporting) || !(empty(reporting.value) || reporting.value === 0)) return block;
      const entries = block.metrics.map((metric) => {
        if (!applicable(metric) || (metric.code !== fact.reportingCode && !dependent(metric))) return metric;
        if (metric.value === 0 && metric.source?.origin === origin && metric.source?.reportingCode === fact.reportingCode) return metric;
        changed = true;
        return {...metric, value: 0, source: {...fact.source, origin, confirmedBy: 'user', period,
          reportingCode: fact.reportingCode, reportingValue: reporting.value ?? null,
          rawValue: 0, previousAssessmentValue: metric.value ?? null, previousAssessmentSource: metric.source || null,
          rule: 'Ответ «Нет» при отсутствующей или нулевой оценке настроенной отчётности: отчётность, бенчмарки, регулярность и полнота отчёта = 0. Положительная оценка отчётности защищает весь блок.'},
          ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
            ...item, value: 0, max_value: metric.max_value, gap: Number(metric.max_value),
          }))} : {})};
      });
      return entries.some((metric, index) => metric !== block.metrics[index]) ? {...block, metrics: entries} : block;
    });
    return changed ? {...product, metrics} : product;
  });
}
