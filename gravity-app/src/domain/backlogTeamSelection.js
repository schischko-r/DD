const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
const aliases = {
  'сберчаевые': 'сберчаевые #b2c',
  'сберчаевые#b2c': 'сберчаевые #b2c',
  'вжух': 'sberpay вжух',
  'персональная рекомендация (кампейнинг)': 'персональная рекомендация',
  'персональная рекомендация (кампанийнг)': 'персональная рекомендация',
  'выписки, справки': 'выписки справки',
  'выписки,справки': 'выписки справки',
};
const canonicalName = (value) => aliases[normalize(value)] || normalize(value);

function teamMembers(team) {
  const explicitMembers = [...(Array.isArray(team?.memberTeams) ? team.memberTeams : []), ...(Array.isArray(team?.meta?.memberTeams) ? team.meta.memberTeams : [])];
  return explicitMembers.length ? explicitMembers : [team?.label, team?.meta?.teamLabel].filter(Boolean);
}

export function backlogTeamMatchesProduct(team, product) {
  if (!product || !canonicalName(product.name)) return false;
  return teamMembers(team).some((member) => {
    const descriptor = typeof member === 'string' ? {name: member} : member;
    return descriptor && canonicalName(descriptor.name || descriptor.label || descriptor.teamLabel) === canonicalName(product.name)
      && (!descriptor.unit || normalize(descriptor.unit) === normalize(product.unit))
      && (!descriptor.type || normalize(descriptor.type) === normalize(product.type))
      && (!descriptor.period || descriptor.period === product.period);
  });
}

export function findProductForBacklogTeam(team, products, preferredProduct = null) {
  const matches = products.filter((product) => backlogTeamMatchesProduct(team, product));
  return (preferredProduct && matches.find((product) => canonicalName(product.name) === canonicalName(preferredProduct.name)
    && normalize(product.unit) === normalize(preferredProduct.unit) && normalize(product.type) === normalize(preferredProduct.type))) || matches[0] || null;
}

export function getBacklogTeamFilterOptions(teams, products = []) {
  return teams.flatMap((team) => {
    const seen = new Set();
    const members = teamMembers(team).filter((member) => {
      const descriptor = typeof member === 'string' ? {name: member} : member;
      if (!descriptor) return false;
      const name = canonicalName(descriptor.name || descriptor.label || descriptor.teamLabel);
      const key = `${name}|${normalize(descriptor.unit)}|${normalize(descriptor.type)}`;
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return members.map((member) => {
      const name = typeof member === 'string' ? member : member.name || member.label || member.teamLabel;
      const teamKey = String(team.key || '');
      const matchingUnits = [...new Set(products.filter((product) => backlogTeamMatchesProduct({memberTeams: [member]}, product)).map((product) => product.unit).filter(Boolean))];
      const unit = (typeof member === 'object' && member.unit) || (matchingUnits.length === 1 ? matchingUnits[0] : '');
      return {value: members.length > 1 ? `${teamKey}::member::${encodeURIComponent(name)}` : teamKey,
        content: String(members.length > 1 ? name : team.label || name), teamKey, member, unit};
    });
  });
}

export function findBacklogTeamFilterOption(options, value) {
  return options.find((option) => option.value === String(value || ''))
    || options.find((option) => option.teamKey === String(value || '')) || options[0] || null;
}

export function backlogTeamOptionValue(team, product) {
  const options = getBacklogTeamFilterOptions([team]);
  return options.find((option) => backlogTeamMatchesProduct({memberTeams: [option.member]}, product))?.value || options[0]?.value || '';
}
