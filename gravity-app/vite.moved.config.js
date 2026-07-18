import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';

export default defineConfig({
  publicDir: false,
  plugins: [react(), viteSingleFile()],
  build: {
    assetsInlineLimit: Number.POSITIVE_INFINITY,
    emptyOutDir: true,
    outDir: 'dist-moved',
    target: 'es2020',
    rollupOptions: {
      input: resolve(import.meta.dirname, 'moved-standalone.html'),
    },
  },
});
