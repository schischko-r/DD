import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '@gravity-ui/uikit';
import {App} from './app/App.jsx';

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme="light">
    <App />
  </ThemeProvider>,
);
