import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';

export default defineConfig({
  publicDir: false,
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: resolve(import.meta.dirname, '../outputs/ddi-funnel-q3-2026-11-03/report'),
    emptyOutDir: true,
    assetsInlineLimit: Number.POSITIVE_INFINITY,
    target: 'es2020',
    rollupOptions: {input: resolve(import.meta.dirname, 'funnel-report-q3.html')},
  },
});
