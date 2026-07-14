import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '@gravity-ui/uikit';
import {App} from './app/App.jsx';
import '@gravity-ui/uikit/styles/styles.css';
import './theme.css';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme="light">
    <App />
  </ThemeProvider>,
);
