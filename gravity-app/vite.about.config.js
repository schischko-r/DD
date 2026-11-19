import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';

export default defineConfig({
  envFile: false,
  publicDir: false,
  plugins: [
    {
      name: 'about-offline-fonts',
      enforce: 'pre',
      transform(source, id) {
        if (![resolve(import.meta.dirname, 'src/theme.css'), resolve(import.meta.dirname, 'src/styles.css')].includes(id)) return;
        // The standalone page embeds Inter instead of loading Google Fonts at runtime.
        return source.replace(/@import\s+url\(['"]https:\/\/fonts\.googleapis\.com\/[^\n]*?\);/g, '');
      },
    },
    react(),
    viteSingleFile(),
  ],
  build: {
    outDir: 'dist-about',
    emptyOutDir: true,
    assetsInlineLimit: Number.POSITIVE_INFINITY,
    target: 'es2020',
    rollupOptions: {input: resolve(import.meta.dirname, 'about-standalone.html')},
  },
});
