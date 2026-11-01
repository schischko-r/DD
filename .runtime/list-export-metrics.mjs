import {writeFileSync} from 'node:fs';
import {products} from './audit-missing-scores.mjs';
const groups = new Map();
for (const team of products) for (const block of team.metrics) for (const metric of block.metrics) {
  const key = `${block.name}|${metric.name}`;
  if (!groups.has(key)) groups.set(key, {group: block.name, name: metric.name, codes: [], teams: [], applicableTeams: []});
  const entry = groups.get(key);
  if (!entry.codes.includes(metric.code)) entry.codes.push(metric.code);
  entry.teams.push(team.name);
  if (metric.is_applicabble_flg !== false && metric.max_value > 0) entry.applicableTeams.push(team.name);
}
const list = [...groups.values()].filter(x => x.applicableTeams.length).map((x, i) => ({id: i + 1, ...x}));
writeFileSync(new URL('./export-metric-catalog.json', import.meta.url), JSON.stringify(list, null, 2));
console.log(list.map(x => `${x.id}. ${x.group}: ${x.name}`).join('\n'));
