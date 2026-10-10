import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import * as analysis from '../lib/analysis.ts';

globalThis.__syncAnalysis = analysis;
function moduleFrom(source) {
  const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const mergeModule = await moduleFrom(readFileSync('lib/sync-merge.ts', 'utf8').replace("import {emptyData, recordKey, type Data} from './analysis';", 'const {emptyData,recordKey}=globalThis.__syncAnalysis;'));
const {mergeSync, sameSyncData} = mergeModule;
const base = analysis.emptyData();
base.subjects = [{id: 'math', name: '数学', color: '#ffcc00'}];
base.study_records = [{id: 'a', source: 'studyplus', source_id: 'a', date: '2026-10-09', duration_minutes: 30, subject_id: 'math'}];
const local = structuredClone(base), remote = structuredClone(base);
local.study_records.push({id: 'b', date: '2026-10-10', duration_minutes: 20, subject_id: 'math'});
remote.study_records.push({id: 'c', date: '2026-10-10', duration_minutes: 40, subject_id: 'math'});
local.subjects[0].color = '#008800'; remote.subjects[0].name = '数学I';
const merged = mergeSync(base, local, remote);
assert.equal(merged.conflicts.length, 0); assert.equal(merged.data.study_records.length, 3);
assert.equal(merged.data.subjects[0].name, '数学I'); assert.equal(merged.data.subjects[0].color, '#008800');
assert.equal(mergeSync(merged.data, merged.data, merged.data).conflicts.length, 0);
assert(sameSyncData({a: 1, b: 2}, {b: 2, a: 1}));
const edit = structuredClone(base); edit.study_records[0].duration_minutes = 50;
const deleted = structuredClone(base); deleted.study_records = [];
assert.equal(mergeSync(base, deleted, base).data.study_records.length, 0);
assert(mergeSync(base, deleted, edit).conflicts.length > 0);
const color = structuredClone(base); color.subjects[0].color = '#0000ff';
assert(mergeSync(base, local, color).conflicts.some(c => c.path.includes('color')));
assert.equal(mergeSync(null, null, remote).conflicts.length, 0);
const logs1 = structuredClone(base), logs2 = structuredClone(base);
logs1.imports.push({at: 'one'}); logs2.imports.push({at: 'two'});
assert.equal(mergeSync(base, logs1, logs2).data.imports.length, 2);
assert.equal(base.study_records.length, 1, 'Merge must never mutate inputs');

// Exercise the actual worker against transactional SQLite, including auth and CORS.
const sql = new DatabaseSync(':memory:'); sql.exec(readFileSync('sync-worker/schema.sql', 'utf8'));
const db = {prepare(query) {let args = []; return {bind(...a) {args = a; return this;}, async all() {return {results: sql.prepare(query).all(...args)};}, run() {return {meta: {changes: sql.prepare(query).run(...args).changes}};}};}, async batch(ops) {sql.exec('BEGIN'); try {const results = ops.map(o => o.run()); sql.exec('COMMIT'); return results;} catch (e) {sql.exec('ROLLBACK'); throw e;}}};
globalThis.__validateSyncData = mergeModule.validateSyncData;
const worker = (await moduleFrom(readFileSync('sync-worker/worker.ts', 'utf8').replace("import {validateSyncData} from '../lib/sync-merge';", 'const validateSyncData=globalThis.__validateSyncData;'))).default;
const token = 'a'.repeat(43);
const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
const env = {DB: db, SYNC_KEY_HASH: hash, ALLOWED_ORIGINS: 'https://neimoasorao-dotcom.github.io,null'};
async function request(method = 'GET', payload, auth = token, origin = 'https://neimoasorao-dotcom.github.io') {
  return worker.fetch(new Request('https://sync.test/v1/state', {method, headers: {Authorization: 'Bearer ' + auth, Origin: origin, 'Content-Type': 'application/json'}, ...(payload ? {body: JSON.stringify(payload)} : {})}), env);
}
assert.equal((await request('GET', null, 'b'.repeat(43))).status, 401);
assert.equal((await request('GET', null, token, 'https://other.test')).status, 403);
assert.equal((await request('GET', null, token, 'null')).status, 200);
assert.equal((await request('OPTIONS')).status, 204);
assert.deepEqual(await (await request()).json(), {revision: 0, data: null});
assert.equal((await request('PUT', {revision: 0, data: base})).status, 200);
assert.equal((await request('PUT', {revision: 0, data: local})).status, 409);
assert.deepEqual((await (await request()).json()).data, base);
assert.equal((await request('PUT', {revision: 1, data: null})).status, 400);
const large = structuredClone(base); large.extra = '';const prefix = JSON.stringify(large).indexOf('\"extra\":\"') + 9;large.extra = 'x'.repeat(99999-prefix) + '😀' + '漢字😀'.repeat(100000);
assert.equal((await request('PUT', {revision: 1, data: large})).status, 200);
assert.deepEqual((await (await request()).json()).data, large);
const fail = {...env, DB: {...db, batch() {throw new Error('test rollback');}}};
const failed = await worker.fetch(new Request('https://sync.test/v1/state', {method: 'PUT', headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body: JSON.stringify({revision: 2, data: local})}), fail);
assert.equal(failed.status, 503); assert.deepEqual((await (await request()).json()).data, large);
assert.equal((await request('DELETE')).status, 405);
console.log('PASS sync: two-device additions/settings, deletes versus edits, conflicts, histories, convergence, worker authentication/CORS, revision CAS, UTF-8 chunks, failed-write preservation');
