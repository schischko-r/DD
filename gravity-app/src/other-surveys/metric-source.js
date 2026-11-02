export {hasHttpLinks, hasDashboardSources, httpLinkValues, toHttpUrl, metricSourceOptions, metricSourceFields, hasMetricSource} from '../deposits-survey/metric-source.js';
import {metricSourceEvidence as commonEvidence} from '../deposits-survey/metric-source.js';
export function metricSourceEvidence(proof, answers) {
  if (answers[proof.id] === 'Собственная отчетность' && answers[`${proof.id}Format`] === 'excel') {
    return 'Собственная отчетность: Отчет в формате Excel';
  }
  return commonEvidence(proof, answers);
}
