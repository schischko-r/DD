import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '@gravity-ui/uikit';
import '@gravity-ui/uikit/styles/styles.css';
import './survey.css';
import {SurveyApp} from './SurveyApp.jsx';
import {otelloTeams, otelloTeamGroups} from './otello.js';

window.DDI_SURVEY_TEAMS = otelloTeams.map(({id, name, unit}) => ({id, name, unit}));

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme="dark"><SurveyApp teamCatalog={otelloTeams} teamOptions={otelloTeamGroups} noHistory /></ThemeProvider>,
);
