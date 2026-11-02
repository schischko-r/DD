import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  // Бандл грузится обычным <script> в статической странице, где нет process.
  define: {
    'process.env.NODE_ENV': '"production"',
    global: 'globalThis',
  },
  build: {
    outDir: resolve(import.meta.dirname, '../../charts-dist'),
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve(import.meta.dirname, 'funnel.jsx'),
      name: 'DDFunnel',
      formats: ['iife'],
      fileName: () => 'dd-funnel.js',
    },
  },
});
