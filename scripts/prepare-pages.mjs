import {readFile, writeFile, readdir, mkdir, copyFile, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist-pages');
const assets = path.join(root, 'pages-assets');
const html = await readFile(path.join(output, 'index.html'), 'utf8');
if (!html.includes('/studyplus/pages-assets/')) throw new Error('Run npm run build:pages first.');
// These paths are exclusively generated Pages files. Never remove source/public,
// server bindings, local databases, or user learning records.
await mkdir(assets, {recursive:true});
const generated = new Set(await readdir(path.join(output, 'pages-assets')));
for (const name of await readdir(assets)) if (!generated.has(name)) {
  if (!/^index-[\w-]+\.(js|css)$/.test(name)) throw new Error(`Unexpected file in generated assets: ${name}`);
  await rm(path.join(assets, name));
}
for (const name of generated) await copyFile(path.join(output, 'pages-assets', name), path.join(assets, name));
// Jekyll publishes pages-entry.html at / using its permalink without Markdown conversion.
// Keeping index.html out
// of the checkout prevents Vite/Vinext dev from serving the Pages entry over App.
await writeFile(path.join(root, 'pages-entry.html'), `---\nlayout: null\npermalink: /\n---\n${html}`);
await copyFile(path.join(output, 'favicon.svg'), path.join(root, 'favicon.svg'));
console.log('Prepared pages-entry.html, pages-assets, and favicon.svg for the existing main/root Pages source.');
