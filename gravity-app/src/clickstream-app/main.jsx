import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '@gravity-ui/uikit';
import {ClickstreamApp} from './ClickstreamApp.jsx';
import '@gravity-ui/uikit/styles/styles.css';
import '../theme.css';
import './clickstream.css';

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme="light">
    <ClickstreamApp />
  </ThemeProvider>,
);
