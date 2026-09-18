import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '@gravity-ui/uikit';
import {Chart} from '@gravity-ui/charts';
import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';

const roots = new WeakMap();

export function renderChart(container, data) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(
    <ThemeProvider theme="light" scoped>
      <div style={{width: '100%', height: '100%'}}>
        <Chart data={data} lang="ru" />
      </div>
    </ThemeProvider>,
  );
}
