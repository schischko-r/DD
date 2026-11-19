import {standaloneSurveyProfiles} from './survey-profiles.js';

const profile = standaloneSurveyProfiles['full-otello¦Отелло'];
export const otelloTeam = {
  id: profile.teamId,
  name: profile.name,
  // Юнит подтверждён пользователем для отдельного опроса Отелло.
  unit: 'Data',
  mechanicScores: {},
};
export const otelloTeams = [otelloTeam];
export const isOtelloSurvey = product => product === otelloTeam.id;
export const otelloTeamGroups = [{
  label: 'Data',
  options: [{value: otelloTeam.id, content: otelloTeam.name, text: otelloTeam.name, disabled: false}],
}];
