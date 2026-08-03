import {createReadStream, existsSync, statSync} from 'node:fs';
import {resolve} from 'node:path';
import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {clickstreamDataPlugin} from './clickstreamDataPlugin.js';
import {
  adjacentHtmlPagePath,
  parseHtmlPageConfig,
} from './src/features/html-pages/htmlPageConfig.js';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..');

function siblingHtmlPageFile(configuredUrl) {
  const relativePath = adjacentHtmlPagePath(configuredUrl);
  if (!relativePath) return null;
  const filePath = resolve(REPOSITORY_ROOT, relativePath);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return null;
  return {filePath, requestPath: `/${relativePath}`};
}

function siblingHtmlPages(entries) {
  const allowedFiles = new Map();
  for (const {url} of Object.values(entries)) {
    const file = siblingHtmlPageFile(url);
    if (file) allowedFiles.set(file.requestPath, file.filePath);
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

function siblingHtmlPageManifest(entries) {
  const manifest = Object.fromEntries(
    Object.entries(entries).flatMap(([id, {url}]) => {
      const file = siblingHtmlPageFile(url);
      return file ? [[id, file.requestPath.slice(1)]] : [];
    }),
  );
  const serializedManifest = JSON.stringify(manifest)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');

  return {
    name: 'mark-configured-sibling-html-pages',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [{
          tag: 'script',
          attrs: {
            id: 'ddi-html-page-manifest',
            type: 'application/json',
          },
          children: serializedManifest,
          injectTo: 'head-prepend',
        }];
      },
    },
  };
}

export default defineConfig(({mode}) => {
  const environment = loadEnv(mode, REPOSITORY_ROOT, 'VITE_');
  const exampleEnvironment = loadEnv('example', REPOSITORY_ROOT, 'VITE_');
  const htmlPageUrlsRaw = process.env.VITE_HTML_PAGE_URLS
    || environment.VITE_HTML_PAGE_URLS
    || exampleEnvironment.VITE_HTML_PAGE_URLS
    || '{}';
  const htmlPageConfig = parseHtmlPageConfig(htmlPageUrlsRaw, {strict: true});

  return {
    envDir: REPOSITORY_ROOT,
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    define: {
      'import.meta.env.VITE_HTML_PAGE_URLS': JSON.stringify(htmlPageUrlsRaw),
    },
    plugins: [
      react(),
      clickstreamDataPlugin(),
      siblingHtmlPages(htmlPageConfig),
      siblingHtmlPageManifest(htmlPageConfig),
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
