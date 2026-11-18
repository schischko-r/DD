import {completeProductPercent, maturityLevelName, nextMaturityLevel, previousQuarterIndexDelta} from './report.js';

const PERIOD = 'III кв. 2026';
const BASELINE_PERIOD = 'II кв. 2026';
const collator = new Intl.Collator('ru', {numeric: true, sensitivity: 'base'});

function summarize(teams) {
  const met = teams.filter(team => team.status === 'met').length;
  const notMet = teams.filter(team => team.status === 'not-met').length;
  const comparable = met + notMet;
  return {
    total: teams.length,
    comparable,
    met,
    notMet,
    noComparison: teams.length - comparable,
    leaders: teams.filter(team => Number.isFinite(team.score) && team.score >= 81).length,
    share: comparable ? met / comparable : null,
  };
}

// Unit and B2C progress counts individual team goals, rather than averaging scores.
export function buildSummaryGoalProgress(products, baselineProducts = [], baselineRows = [], period = PERIOD, unit = '') {
  const supported = period === PERIOD;
  if (!supported) return {supported, period, baselinePeriod: null, teams: [], groups: [], ...summarize([])};

  const teams = (Array.isArray(products) ? products : [])
    .filter(product => product.period === period && (!unit || product.unit === unit))
    .map(product => {
      const score = completeProductPercent(product);
      const previous = previousQuarterIndexDelta(product, score, baselineProducts, baselineRows);
      const baselineScore = previous?.previousScore ?? null;
      const baselineLeader = Number.isFinite(baselineScore) && baselineScore >= 81;
      const target = Number.isFinite(baselineScore)
        ? baselineLeader ? {name: maturityLevelName(81), threshold: 81} : nextMaturityLevel(baselineScore)
        : null;
      const comparable = Number.isFinite(score) && Number.isFinite(baselineScore) && target !== null;
      const met = comparable ? score >= target.threshold : null;
      return {
        id: product.id,
        name: product.name,
        unit: product.unit,
        type: product.type,
        score,
        level: Number.isFinite(score) ? maturityLevelName(score) : null,
        baselineScore,
        targetScore: target?.threshold ?? null,
        targetLevel: target?.name ?? null,
        status: comparable ? met ? 'met' : 'not-met' : 'no-comparison',
        met,
        remaining: comparable ? Math.max(0, target.threshold - score) : null,
        baselineLeader,
      };
    })
    .sort((a, b) => collator.compare(a.unit, b.unit) || collator.compare(a.name, b.name)
      || collator.compare(a.type, b.type) || collator.compare(String(a.id), String(b.id)));

  const groups = [...new Set(teams.map(team => team.unit))].map(groupUnit => {
    const groupTeams = teams.filter(team => team.unit === groupUnit);
    return {unit: groupUnit, teams: groupTeams, ...summarize(groupTeams)};
  });
  return {supported, period, baselinePeriod: BASELINE_PERIOD, teams, groups, ...summarize(teams)};
}
