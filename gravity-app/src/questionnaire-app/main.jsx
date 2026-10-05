import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '@gravity-ui/uikit';
import '@gravity-ui/uikit/styles/styles.css';
import '../theme.css';
import './questionnaire.css';
import {QuestionnaireApp} from './QuestionnaireApp.jsx';

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme="light">
    <QuestionnaireApp />
  </ThemeProvider>,
);
