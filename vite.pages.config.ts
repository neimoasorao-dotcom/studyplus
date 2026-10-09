import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./github-pages/', import.meta.url)),
  base: '/studyplus/',
  plugins: [react()],
  resolve: {alias: [
    {find: '@/lib/state-request', replacement: fileURLToPath(new URL('./github-pages/state-request.ts', import.meta.url))},
    {find: '@', replacement: fileURLToPath(new URL('./', import.meta.url))},
  ]},
  publicDir: fileURLToPath(new URL('./public/', import.meta.url)),
  build: {outDir: '../dist-pages', assetsDir: 'pages-assets', emptyOutDir: true},
});
