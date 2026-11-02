const CODE = 'hyp.discovery_40_backlog';
const PERIOD = 'III кв. 2026';
const ORIGIN = 'userConfirmedDiscoveryBacklogPriority20261102';
const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');

export function discoveryDecompositionScore(discoveryCount, createdCount) {
  if (!Number.isInteger(discoveryCount) || !Number.isInteger(createdCount) || createdCount <= 0
    || discoveryCount < 0 || discoveryCount > createdCount) return null;
  return discoveryCount * 100 >= createdCount * 40 ? 1
    : discoveryCount * 100 >= createdCount * 20 ? 0.5 : 0;
}

export function applyDiscoveryBacklog(products, period, backlog) {
  if (period !== PERIOD || !Array.isArray(backlog?.teams)) return products;
  return products.map(product => {
    if (product.period !== period) return product;
    const matches = [];
    backlog.teams.forEach((team, teamIndex) => {
      const member = (team.memberTeams || []).some(entry => {
        if (typeof entry === 'string') return normalize(entry) === normalize(product.name);
        return normalize(entry?.name) === normalize(product.name)
          && ['unit', 'type'].every(key => !entry[key] || entry[key] === product[key])
          && (!entry.period || entry.period === period);
      });
      if (!member) return;
      (team.quarters || []).forEach((quarter, quarterIndex) => {
        if (quarter.key !== '2026-Q3') return;
        const rawValue = discoveryDecompositionScore(quarter.discoveryCount, quarter.createdCount);
        if (rawValue !== null) matches.push({team, quarter, teamIndex, quarterIndex, rawValue});
      });
    });
    // An ambiguous or missing decomposition cannot replace an existing assessment.
    if (matches.length !== 1) return product;
    const {team, quarter, teamIndex, quarterIndex, rawValue} = matches[0];
    let changed = false;
    const metrics = product.metrics.map(block => ({...block, metrics: block.metrics.map(metric => {
      if (metric.code !== CODE || metric.is_applicabble_flg === false || !(metric.max_value > 0)) return metric;
      const value = rawValue * metric.max_value;
      if (metric.value === value && metric.source?.origin === ORIGIN
        && metric.source.teamKey === team.key && metric.source.createdCount === quarter.createdCount
        && metric.source.discoveryCount === quarter.discoveryCount) return metric;
      changed = true;
      return {...metric, value, source: {origin: ORIGIN, confirmedBy: 'user', date: '2026-11-02', period,
        file: 'gravity-app/public/backlog-data.json', pointer: `/teams/${teamIndex}/quarters/${quarterIndex}`,
        teamKey: team.key, teamLabel: team.label, quarterKey: quarter.key,
        createdCount: quarter.createdCount, discoveryCount: quarter.discoveryCount,
        actualShare: quarter.discoveryCount / quarter.createdCount * 100, rawValue,
        rule: 'При наличии однозначной декомпозиции III квартала: доля >=40% = 1; >=20% и <40% = 0.5; <20% = 0. Порог проверяется без округления; декомпозиция приоритетнее анкеты и прежних баллов.',
        previousAssessmentValue: metric.value, previousAssessmentSource: metric.source || null},
        ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map(item => ({
          ...item, value, max_value: metric.max_value, gap: metric.max_value - value,
        }))} : {})};
    })}));
    return changed ? {...product, metrics} : product;
  });
}
