import {createReadStream, existsSync, statSync} from 'node:fs';
import {resolve} from 'node:path';
import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {clickstreamDataPlugin} from './clickstreamDataPlugin.js';
import {parseHtmlPageConfig} from './src/features/html-pages/htmlPageConfig.js';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..');

function siblingHtmlPages(entries) {
  const allowedFiles = new Map();
  for (const {url: configuredUrl} of Object.values(entries)) {
    if (typeof configuredUrl !== 'string' || !configuredUrl.startsWith('./')) continue;
    const relativePath = configuredUrl.slice(2);
    if (
      !relativePath
      || relativePath.includes('/')
      || relativePath.includes('\\')
      || !relativePath.toLowerCase().endsWith('.html')
    ) {
      continue;
    }
    const requestPath = `/${relativePath}`;
    const filePath = resolve(REPOSITORY_ROOT, relativePath);
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      allowedFiles.set(requestPath, filePath);
    }
  }

  return {
    name: 'serve-configured-sibling-html-pages',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        let requestPath;
        try {
          requestPath = decodeURIComponent(
            new URL(request.url || '/', 'http://localhost').pathname,
          );
        } catch {
          next();
          return;
        }
        const filePath = allowedFiles.get(requestPath);
        if (!filePath) {
          next();
          return;
        }
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        createReadStream(filePath).pipe(response);
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const environment = loadEnv(mode, REPOSITORY_ROOT, 'VITE_');
  const exampleEnvironment = loadEnv('example', REPOSITORY_ROOT, 'VITE_');
  const htmlPageUrlsRaw = environment.VITE_HTML_PAGE_URLS
    || exampleEnvironment.VITE_HTML_PAGE_URLS
    || '{}';
  const htmlPageConfig = parseHtmlPageConfig(htmlPageUrlsRaw, {strict: true});

  return {
    envDir: REPOSITORY_ROOT,
    define: {
      'import.meta.env.VITE_HTML_PAGE_URLS': JSON.stringify(htmlPageUrlsRaw),
    },
    plugins: [
      react(),
      clickstreamDataPlugin(),
      siblingHtmlPages(htmlPageConfig),
      viteSingleFile(),
    ],
    build: {target: 'es2020'},
    server: {
      fs: {
        allow: ['..'],
      },
    },
  };
});
