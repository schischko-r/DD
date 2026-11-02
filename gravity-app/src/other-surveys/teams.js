import {otherTeamProfiles} from './other-team-profiles.js';
import {filterTeamOption} from '../deposits-survey/teams.js';
export {filterTeamOption};
const kind = typeof document === 'undefined' ? null : document.documentElement.dataset.surveyKind;
export const displayTeamName = name => name === 'Дети' ? 'Дети/подростки'
  : name === 'Персональная рекомендация' ? 'Персональная рекомендация (кампейнинг)' : name;
export const teams = Object.values(otherTeamProfiles).map(profile => ({id: profile.teamId, name: displayTeamName(profile.name), unit: profile.unit, type: profile.type, sheet: profile.sheet, mechanicScores: {}}))
  .filter(team => !kind || (kind === 'channels' ? team.type === 'Канал' : team.type === 'Сегмент'));
export const enabledTeams = teams;
export const enabledTeam = teams[0];
export const CHANNEL_SURVEYS_ENABLED = true;
const collator = new Intl.Collator('ru', {numeric: true});
export const teamGroups = [...new Set(teams.map(t => t.unit))].sort(collator.compare).map(unit => ({label: unit, options: teams.filter(t => t.unit === unit).sort((a,b)=>collator.compare(a.name,b.name)).map(t=>({value:t.id, content:t.name, text:t.name}))}));
export const surveyTeamKind = kind;
