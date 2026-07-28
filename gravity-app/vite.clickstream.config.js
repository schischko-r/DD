import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {clickstreamDataPlugin} from './clickstreamDataPlugin.js';

export default defineConfig({
  plugins: [react(), clickstreamDataPlugin(), viteSingleFile()],
  build: {
    target: 'es2020',
    outDir: 'dist-clickstream',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, 'clickstream.html'),
    },
  },
});
