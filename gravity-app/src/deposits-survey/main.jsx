import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '@gravity-ui/uikit';
import '@gravity-ui/uikit/styles/styles.css';
import './survey.css';
import {SurveyApp} from './SurveyApp.jsx';
import {teams} from './teams.js';

window.DDI_SURVEY_TEAMS = teams.map(({id, name, unit}) => ({id, name, unit}));

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme="dark"><SurveyApp /></ThemeProvider>,
);
