import {excludeRemovedTeams, isDdIndexMetric} from './report.js';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
import {applyReportingRegularity, applyReportingMissingAssessments, applyReportingFormatAssessments} from './reportingRegularity.js';
import {applyFunnelActionAssessments} from './funnelActionAssessments.js';
import {applyCrossSellDuringPurchaseScores, applyCrossSellMissingZeros} from './crossSellDecomposition.js';
import {mergeSalaryCohorts} from './salaryCohortAverage.js';
import {applyGoalsFinalScores} from './goalsFinalScores.js';
import {applyNavigatorKnowledge} from './navigatorKnowledge.js';
import {applyReportingAbsenceAssessments} from './reportingAbsence.js';
import {applyMetricIndexExclusionAssessments} from './indexExclusion.js';
import {applyPCFinalScores} from './pcFinalScores.js';
import {applyKeyMetricsWorkbookPriority} from './keyMetricsWorkbookPriority.js';
import {applyMetricApplicabilityAssessments} from './metricApplicability.js';
import {applyUbWorkbookCorrections} from './ubWorkbookCorrections.js';
import {applyDiscoveryBacklog} from './discoveryBacklog.js';
import {applyCampaignSelfService} from './campaignSelfService.js';
import {applyCbpUserCorrections} from './cbpUserCorrections.js';
import {applyFrozenCrossSellScores} from './frozenCrossSellScores.js';

export const Q3_DB_TEAMS = [
  'Зарплатный продукт', 'Пенсионный продукт', 'SberPay NFC',
  'Переводы по РФ', 'Оплата улыбкой', 'Торговый Эквайринг', 'Кредитные карты', 'Дебетовая карта',
  'SberPay Ecom', 'Платежи', 'SberPay Вжух', 'Детская карта', 'СберЧаевые',
  'Трансграничные переводы', 'Интернет-Эквайринг', 'Трансграничный эквайринг',
];
export const Q3_DB_COHORT_TEAMS = ['Зарплатный продукт #B2C', 'Зарплатный продукт #B2B',
  ...Q3_DB_TEAMS.filter((name) => name !== 'Зарплатный продукт')];

function salaryCohort(parent, team, period) {
  const metrics = parent.metrics.map((block) => ({...block, metrics: block.metrics.map((metric) => {
    const {previousValue, previousMaxValue, previousPeriod, crossSellComponents, ...base} = metric;
    const fact = team.metrics[metric.code];
    const aggregate = (team.unassignedAggregateMetricCodes || []).includes(metric.code);
    let value = metric.value;
    let source = {...metric.source, sharedAssessment: true, inheritedFromTeamId: team.baseTeamId};
    if (fact) {
      if (![null, 0, 0.5, 1].includes(fact.rawValue)) throw new Error(`Invalid salary score: ${team.name} / ${metric.code}`);
      value = fact.rawValue === null ? null : fact.rawValue * Number(metric.max_value);
      source = fact.source;
    }
    if (aggregate) {
      value = null;
      source = {origin: 'salarySplitUnassignedAggregate', period,
        inheritedFromTeamId: team.baseTeamId, reason: 'Источник не разделён на B2C/B2B'};
    }
    const after = team.crossSellAfterPurchase;
    return {...base, value, source,
      ...(aggregate && after ? {crossSellComponents: {
        during: {value: null, source},
        after: {value: after.rawValue * Number(metric.max_value) / 2, rawValue: after.rawValue,
          applicable: after.applicable, source: after.source},
      }} : crossSellComponents ? {crossSellComponents} : {}),
      ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map((item) => ({
        ...item, value, max_value: metric.max_value, gap: value === null ? null : Math.max(0, metric.max_value - value),
      }))} : {}),
    };
  })}));
  return {...parent, id: `${team.id}::empty::${period}`, name: team.name, unit: team.unit, type: team.type, isPlaceholder: true,
    sourceTeamId: team.baseTeamId, respondent: team.respondent, respondentSource: team.respondentSource,
    metrics, metric_recommendations: (parent.metric_recommendations || []).filter((r) => r.skill_key !== 'cross_sell'),
    indexMaxPoints: metrics.flatMap((b) => b.metrics).filter(isDdIndexMetric).reduce((sum, m) => sum + Number(m.max_value), 0)};
}

export function buildDdiCohortProducts(products, period, overlays, salaryConfig, reportingAssessment = null, actionAssessment = null) {
  // The original Q2 cohort includes DU; the previous removal applies only to Q3.
  const source = period === 'III кв. 2026' ? excludeRemovedTeams({products}).products : products;
  const profiles = buildTeamProfileProducts(source, period, overlays);
  if (period !== 'III кв. 2026') return profiles;
  const split = profiles.flatMap((product) => {
    const children = salaryConfig?.period === period
      ? (salaryConfig.products || []).filter((team) => team.baseTeamId === String(product.id).replace(/::empty::.*/, '')) : [];
    return children.length ? children.map((team) => salaryCohort(product, team, period)) : [product];
  }).filter((product) => product.unit !== 'DB' || Q3_DB_COHORT_TEAMS.includes(product.name));
  const reported = applyReportingMissingAssessments(applyReportingRegularity(split, period, products), period, reportingAssessment, products);
  const assessed = applyCrossSellMissingZeros(applyFunnelActionAssessments(reported, period, actionAssessment, products), period);
  const hasAbsenceAssessment = (Array.isArray(overlays) ? overlays : [overlays]).some((assessment) =>
    assessment?.period === period && assessment.scope === 'reporting-absence-assessment');
  if (!hasAbsenceAssessment) return applyKeyMetricsWorkbookPriority(assessed, period, overlays, products);
  // Resolve each cohort before averaging, using the same effective reporting format as the final profile.
  return applyKeyMetricsWorkbookPriority(applyReportingAbsenceAssessments(applyReportingFormatAssessments(assessed, period, overlays), period, overlays), period, overlays, products);
}

export function buildDdiPeriodProducts(products, period, overlays, salaryConfig, reportingAssessment = null, actionAssessment = null, backlog = null) {
  const assessed = applyReportingFormatAssessments(applyNavigatorKnowledge(mergeSalaryCohorts(buildDdiCohortProducts(products, period, overlays, salaryConfig, reportingAssessment, actionAssessment),
    period, salaryConfig, products), period), period, overlays);
  const finalScores = applyPCFinalScores(applyGoalsFinalScores(applyMetricIndexExclusionAssessments(assessed, period, overlays), period, overlays), period, overlays);
  const assessments = Array.isArray(overlays) ? overlays : [overlays];
  const crossSellDuring = assessments.find((item) => item?.scope === 'crosssell-during-purchase-assessment');
  const applicable = applyMetricApplicabilityAssessments(applyKeyMetricsWorkbookPriority(applyCrossSellDuringPurchaseScores(finalScores, period, crossSellDuring), period, overlays, products),
    period, assessments.filter(Boolean), true);
  const finalProducts = applyDiscoveryBacklog(applyCbpUserCorrections(applyCampaignSelfService(applyUbWorkbookCorrections(applicable, period, assessments), period), period, assessments), period, backlog);
  const frozenCrossSell = assessments.find((assessment) => assessment?.scope === 'frozen-q3-crosssell-scores');
  return applyFrozenCrossSellScores(finalProducts, period, frozenCrossSell);
}
