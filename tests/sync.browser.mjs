import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import * as A from '../lib/analysis.ts';
const require = createRequire(import.meta.url);
const {build} = require(require.resolve('esbuild', {paths: [require.resolve('wrangler')]}));
const {Miniflare} = require(require.resolve('miniflare', {paths: [require.resolve('wrangler')]}));
const {chromium} = await import(process.env.STUDYPLUS_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.STUDYPLUS_PAGES_TEST_URL || 'http://127.0.0.1:5176/studyplus/';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
await mkdir('.sites-runtime', {recursive: true});
const scriptPath = path.resolve('.sites-runtime/sync-browser-worker.mjs');
await build({entryPoints: ['sync-worker/worker.ts'], outfile: scriptPath, bundle: true, format: 'esm', platform: 'browser', target: 'es2022'});
const offlineFile = process.env.STUDYPLUS_SYNC_OFFLINE_FILE;
const pcBase = offlineFile ? 'http://127.0.0.1:5181/studyplus_offline.html' : base;
const key = 'a'.repeat(43), url = 'http://127.0.0.1:5180';
const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))).toString('hex');
const mf = new Miniflare({modules: true, scriptPath, compatibilityDate: '2026-05-15', cf: false, host: '127.0.0.1', port: 5180, bindings: {SYNC_KEY_HASH: hash, ALLOWED_ORIGINS: new URL(base).origin + ',' + new URL(pcBase).origin + ',null'}, d1Databases: {DB: 'isolated-browser-test'}});
await mf.ready;
const db = await mf.getD1Database('DB');
await db.exec(await readFile('sync-worker/schema.sql', 'utf8'));
const browser = await chromium.launch({executablePath: process.env.STUDYPLUS_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox']});
const contexts = await Promise.all([390, 1280].map(width => browser.newContext({viewport: {width, height: 900}, timezoneId: 'Asia/Tokyo'})));
let offlineServer;
if (offlineFile) {const html = await readFile(offlineFile);offlineServer = createServer((req,res) => {res.writeHead(200, {'Content-Type':'text/html'});res.end(html);});await new Promise(resolve => offlineServer.listen(5181,'127.0.0.1',resolve));}
const errors = [];
async function remote() {return (await fetch(url + '/v1/state', {headers: {Authorization: 'Bearer ' + key}})).json();}
async function wait(check) {for (let i = 0; i < 100; i++) {if (await check()) return; await new Promise(resolve => setTimeout(resolve, 200));} throw new Error('Sync timed out');}
async function stored(p) {return p.evaluate(() => new Promise((resolve, reject) => {const q = indexedDB.open('studyplus-dashboard:/studyplus/'); q.onerror = () => reject(q.error); q.onsuccess = () => {const db = q.result, tx = db.transaction('state'), r = tx.objectStore('state').get('main'); r.onsuccess = () => resolve(r.result); tx.oncomplete = () => db.close();};}));}
async function open(p) {await p.locator('.browser-storage-label').click(); await p.getByRole('button', {name: '端末間の同期', exact: true}).click();}
async function pair(p) {await open(p);const dialog = p.getByRole('dialog');await dialog.getByLabel('同期API URL').fill(url);await dialog.getByLabel('共有キー', {exact: true}).fill(key);await dialog.getByRole('button', {name: '接続して同期を開始'}).click();try {await dialog.getByText(/^同期済み：/).waitFor();} catch(e) {console.log('Pair status',await dialog.innerText());console.log('Browser errors',errors);throw e;}await p.keyboard.press('Escape');}
async function record(p, minutes) {await p.getByRole('button', {name: /^(この教材で)?記録する$/}).click();const form = p.locator('.manual-form');await form.getByLabel('学習時間の時間', {exact: true}).fill('0');await form.getByLabel('学習時間の分', {exact: true}).fill(String(minutes));await form.getByRole('button', {name: '保存', exact: true}).click();await p.getByRole('dialog').waitFor({state: 'hidden'});}
try {
 const [phone, pc] = await Promise.all(contexts.map(c => c.newPage()));
 for (const p of [phone, pc]) {p.on('pageerror', e => errors.push(e.message));await p.goto((p===pc?pcBase:base) + '#materials');await p.locator('.context').waitFor();}
 const d = A.emptyData();d.subjects = [{id: 'math', name: '数学', color: '#b33c88'}];d.materials = [{id: 'gold', name: 'Focus Gold', subject_id: 'math'}];d.study_records = [{id: 'seed', source: 'studyplus', source_id: 'seed', date: A.today(), subject_id: 'math', material_id: 'gold', duration_minutes: 30}];
 await phone.locator('input[type=file]').setInputFiles({name: 'test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(d))});await phone.getByRole('button', {name: 'この内容で追加する', exact: true}).click();await phone.getByRole('dialog').waitFor({state: 'hidden'});
 await pair(phone);await pair(pc);assert.equal((await stored(pc)).data.subjects[0].color, '#b33c88');
 await contexts[1].setOffline(true);await record(pc, 18);assert.equal((await stored(pc)).data.study_records.length, 2);
 await record(phone, 17);await wait(async () => (await remote()).data.study_records.length === 2);
 await contexts[1].setOffline(false);await pc.evaluate(() => dispatchEvent(new Event('online')));await wait(async () => (await remote()).data.study_records.length === 3);
 await open(phone);await phone.getByRole('button', {name: '今すぐ同期', exact: true}).click();await wait(async () => (await stored(phone)).data.study_records.length === 3);await phone.keyboard.press('Escape');
 await wait(async () => (await stored(pc)).data.study_records.length === 3);
 const stable = (await remote()).revision;await open(pc);await pc.getByRole('button', {name: '今すぐ同期', exact: true}).click();await pc.getByText(/^同期済み：/).waitFor();assert.equal((await remote()).revision, stable, 'No-op sync must not rewrite');await pc.keyboard.press('Escape');
 // Existing exports contain Data only, never the shared authentication key.
 await phone.getByRole('button', {name: 'データ・設定メニュー'}).click();const downloaded = phone.waitForEvent('download');await phone.getByRole('button', {name: '全データをJSON出力', exact: true}).click();const download = await downloaded;const exported = await readFile(await download.path(), 'utf8');assert(!exported.includes(key));assert.equal(JSON.parse(exported).study_records.length, 3);await phone.keyboard.press('Escape');
 // Two devices change the same field: retain both versions and stop syncing.
 async function edit(p, minutes) {await p.evaluate(minutes => new Promise((resolve, reject) => {const r = indexedDB.open('studyplus-dashboard:/studyplus/');r.onsuccess = () => {const db = r.result, tx = db.transaction('state', 'readwrite'), store = tx.objectStore('state'), q = store.get('main');q.onsuccess = () => {const s = q.result;s.data.study_records[0].duration_minutes = minutes;s.revision++;store.put(s, 'main');};tx.oncomplete = () => {db.close();resolve();};tx.onabort = () => reject(tx.error);};}), minutes);}
 await contexts[1].setOffline(true);await edit(pc, 99);await edit(phone, 51);await phone.reload();await wait(async () => (await remote()).data.study_records[0].duration_minutes === 51);
 await contexts[1].setOffline(false);await pc.reload();await pc.locator('.context').waitFor();await open(pc);await pc.getByText(/^競合が/).waitFor();assert.equal((await stored(pc)).data.study_records[0].duration_minutes, 99);assert.equal((await remote()).data.study_records[0].duration_minutes, 51);
 await pc.getByRole('button', {name: 'この端末の同期を解除'}).click();assert.equal((await stored(pc)).data.study_records.length, 3);assert.deepEqual(errors, []);
 console.log('PASS real browser sync ('+(offlineFile?'Pages + standalone HTML':'two Pages clients')+'): two isolated devices, local Worker/D1, initial pairing, offline additions/merge, no-op convergence, private-key exclusion, edit conflicts without overwrite, disconnect preserves records');
} finally {await browser.close();await mf.dispose();if(offlineServer)await new Promise(resolve => offlineServer.close(resolve));}
