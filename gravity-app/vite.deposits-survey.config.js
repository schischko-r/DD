import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';

export default defineConfig({
  publicDir: false,
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-deposits-survey',
    emptyOutDir: true,
    assetsInlineLimit: Number.POSITIVE_INFINITY,
    target: 'es2020',
    rollupOptions: {input: resolve(import.meta.dirname, 'deposits-survey.html')},
  },
});
