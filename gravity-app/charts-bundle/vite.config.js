import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: resolve(import.meta.dirname, '../../charts-dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(import.meta.dirname, 'entry.jsx'),
      name: 'DDCharts',
      formats: ['iife'],
      fileName: () => 'dd-charts.js',
    },
  },
});
