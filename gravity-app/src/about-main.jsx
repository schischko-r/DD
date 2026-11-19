import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '@gravity-ui/uikit';
import {AboutPage} from './pages/AboutPage.jsx';
import '@gravity-ui/uikit/styles/styles.css';
import './theme.css';
import './styles.css';
import './about-fonts.css';

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme="light">
    <AboutPage initialSection={window.location.hash.slice(1)} />
  </ThemeProvider>,
);
