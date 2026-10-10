import {build, mergeConfig} from 'vite';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import pagesConfig from '../vite.pages.config.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist-offline');
await build(mergeConfig(pagesConfig, {
  configFile: false,
  base: './',
  publicDir: false,
  build: {
    outDir: output,
    assetsInlineLimit: Infinity,
    modulePreload: false,
    rolldownOptions: {output: {codeSplitting: false}},
  },
}));

let html = await readFile(path.join(output, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)];
const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
if (scripts.length !== 1 || styles.length !== 1) throw new Error('Unexpected bundle structure');
for (const match of scripts) {
  const js = await readFile(path.resolve(output, match[1]), 'utf8');
  html = html.replace(match[0], () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
}
for (const match of styles) {
  const css = await readFile(path.resolve(output, match[1]), 'utf8');
  html = html.replace(match[0], () => `<style>${css}</style>`);
}
const favicon = await readFile(path.join(root, 'public/favicon.svg'));
html = html.replace(/<link\b[^>]*rel="icon"[^>]*>/, () => `<link rel="icon" href="data:image/svg+xml;base64,${favicon.toString('base64')}">`);
html = html.replace('<title>Studyplus 学習分析</title>', '<title>Studyplus 学習分析・オフライン版</title>');
if (/<(?:script|link)\b[^>]*(?:src|href)="(?!data:)/i.test(html)) throw new Error('External bundle dependency remains');
await mkdir(path.join(root, 'offline'), {recursive: true});
await writeFile(path.join(root, 'offline/studyplus_offline.html'), html);
console.log(`Created offline/studyplus_offline.html (${Buffer.byteLength(html)} bytes).`);
