import {isSummaryAntiTopMetricHidden, previousQuarterPeriod} from './summaryRadar.js';

const names = new Intl.Collator('en', {sensitivity: 'base', numeric: true});

function metricGroups(products, period, unit) {
  const groups = new Map();
  for (const product of products.filter(item => (!period || item.period === period) && (!unit || item.unit === unit))) {
    for (const block of product.metrics || []) for (const metric of block.metrics || []) {
      if (isSummaryAntiTopMetricHidden(metric, period) || metric.is_applicabble_flg === false
        || !Number(metric.max_value) || !Number.isFinite(metric.value)) continue;
      const key = `${block.code}:${metric.code}`;
      if (!groups.has(key)) groups.set(key, {key, name: metric.name, block: block.name,
        teams: new Set(), incompleteTeams: new Set()});
      const group = groups.get(key);
      group.teams.add(product.name);
      if (Number(metric.value || 0) / Number(metric.max_value) < 1) group.incompleteTeams.add(product.name);
    }
  }
  return groups;
}

export function buildSummaryAntiTop(products, baselineProducts, period, unit = '', limit = 10) {
  const previousPeriod = previousQuarterPeriod(period);
  const previous = previousPeriod ? metricGroups(baselineProducts, previousPeriod, unit) : new Map();
  return [...metricGroups(products, period, unit).values()].map(item => {
    const prior = previous.get(item.key);
    const share = item.incompleteTeams.size / item.teams.size * 100;
    const priorShare = prior ? prior.incompleteTeams.size / prior.teams.size * 100 : null;
    return {key: item.key, name: item.name, block: item.block, teams: item.teams.size,
      incompleteTeams: item.incompleteTeams.size, incompleteShare: Math.round(share),
      exactIncompleteShare: share, period, previousPeriod,
      previousTeams: prior?.teams.size ?? null, previousIncompleteTeams: prior?.incompleteTeams.size ?? null,
      previousIncompleteShare: priorShare,
      incompleteShareDelta: prior ? Math.round((share - priorShare) * 10) / 10 || 0 : null};
  }).sort((a, b) => (b.incompleteTeams - a.incompleteTeams) || (b.incompleteShare - a.incompleteShare)
    || (b.teams - a.teams) || names.compare(a.name, b.name)).slice(0, limit);
}
