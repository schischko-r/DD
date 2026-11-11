import {backlogTeamMatchesProduct} from './backlogTeamSelection.js';
import {averageSalaryCohortMetric} from './salaryCohortAverage.js';

const CODE = 'hyp.discovery_40_backlog';
const PERIOD = 'III кв. 2026';
const ORIGIN = 'userConfirmedDiscoveryBacklogPriority20261102';

export function discoveryDecompositionScore(discoveryCount, createdCount) {
  if (!Number.isInteger(discoveryCount) || !Number.isInteger(createdCount) || createdCount <= 0
    || discoveryCount < 0 || discoveryCount > createdCount) return null;
  return discoveryCount * 100 >= createdCount * 40 ? 1
    : discoveryCount * 100 >= createdCount * 20 ? 0.5 : 0;
}

export function applyDiscoveryBacklog(products, period, backlog) {
  if (period !== PERIOD || !Array.isArray(backlog?.teams)) return products;
  const assess = product => {
    if (product.period !== period) return product;
    const matches = [];
    backlog.teams.forEach((team, teamIndex) => {
      const member = (team.memberTeams || []).find(entry =>
        !(entry?.cohort && product.salaryCohorts)
        && backlogTeamMatchesProduct({memberTeams: [entry]}, product));
      if (!member) return;
      (team.quarters || []).forEach((quarter, quarterIndex) => {
        if (quarter.key !== '2026-Q3') return;
        const rawValue = discoveryDecompositionScore(quarter.discoveryCount, quarter.createdCount);
        if (rawValue !== null) matches.push({team, quarter, teamIndex, quarterIndex, rawValue, member});
      });
    });
    // An ambiguous or missing decomposition cannot replace an existing assessment.
    if (matches.length !== 1) return product;
    const {team, quarter, teamIndex, quarterIndex, rawValue, member} = matches[0];
    let changed = false;
    const metrics = product.metrics.map(block => ({...block, metrics: block.metrics.map(metric => {
      if (metric.code !== CODE || metric.is_applicabble_flg === false || !(metric.max_value > 0)) return metric;
      const value = rawValue * metric.max_value;
      if (metric.value === value && metric.source?.origin === ORIGIN
        && metric.source.teamKey === team.key && metric.source.createdCount === quarter.createdCount
        && metric.source.discoveryCount === quarter.discoveryCount
        && metric.source.dataThrough === quarter.dataThrough
        && metric.source.isComplete === quarter.isComplete) return metric;
      changed = true;
      return {...metric, value, source: {origin: ORIGIN, confirmedBy: 'user', date: member.mappingEvidence?.confirmedAt || '2026-11-02', period,
        file: 'gravity-app/public/backlog-data.json', pointer: `/teams/${teamIndex}/quarters/${quarterIndex}`,
        teamKey: team.key, teamLabel: team.label, quarterKey: quarter.key,
        dataThrough: quarter.dataThrough, isComplete: quarter.isComplete,
        ...(member.mappingEvidence ? {mappingEvidence: member.mappingEvidence} : {}),
        ...(member.cohort ? {cohort: member.cohort} : {}),
        createdCount: quarter.createdCount, discoveryCount: quarter.discoveryCount,
        actualShare: quarter.discoveryCount / quarter.createdCount * 100, rawValue,
        rule: 'При наличии однозначной декомпозиции III квартала: доля >=40% = 1; >=20% и <40% = 0.5; <20% = 0. Порог проверяется без округления; декомпозиция приоритетнее анкеты и прежних баллов.',
        previousAssessmentValue: metric.value, previousAssessmentSource: metric.source || null},
        ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map(item => ({
          ...item, value, max_value: metric.max_value, gap: metric.max_value - value,
        }))} : {})};
    })}));
    return changed ? {...product, metrics} : product;
  };
  return products.map(product => {
    const assessed = assess(product);
    if (!product.salaryCohorts || product.period !== period) return assessed;
    const salaryCohorts = Object.fromEntries(Object.entries(product.salaryCohorts).map(([key, cohort]) => [key, assess(cohort)]));
    if (Object.keys(salaryCohorts).every(key => salaryCohorts[key] === product.salaryCohorts[key])) return assessed;
    const getDiscovery = cohort => cohort?.metrics.flatMap(block => block.metrics).find(metric => metric.code === CODE);
    const left = getDiscovery(salaryCohorts.b2b), right = getDiscovery(salaryCohorts.b2c);
    if (!left || !right) return assessed;
    const average = averageSalaryCohortMetric(left, right, period);
    const metrics = assessed.metrics.map(block => ({...block, metrics: block.metrics.map(metric => {
      if (metric.code !== CODE || metric.is_applicabble_flg === false || !(metric.max_value > 0)) return metric;
      return {...metric, value: average.value, source: average.source,
        ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map(item => ({
          ...item, value: average.value, max_value: metric.max_value,
          gap: average.value === null ? null : metric.max_value - average.value,
        }))} : {})};
    })}));
    return {...assessed, metrics, salaryCohorts};
  });
}
