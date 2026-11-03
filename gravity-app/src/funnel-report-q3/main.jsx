import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '@gravity-ui/uikit';
import '@gravity-ui/uikit/styles/styles.css';
import './report.css';
import {ReportApp} from './ReportApp.jsx';

createRoot(document.getElementById('root')).render(<ThemeProvider theme="dark"><ReportApp /></ThemeProvider>);
