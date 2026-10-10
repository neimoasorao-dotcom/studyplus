import {stateRequest} from './state-request';
import {readGitHub, writeGitHub, validateGitHubTarget} from './github-sync';
import {mergeSync, sameSyncData, validateSyncData, type Conflict} from '../lib/sync-merge';
import type {Data} from '../lib/analysis';

type Connection = {provider?: 'github' | 'cloudflare'; repository?: string; branch?: string; session: string; url: string; key: string; base: Data | null; remoteRevision: number; syncedAt?: string};
export type SyncResult = {changed: boolean; conflicts: Conflict[]; remote?: Data | null; syncedAt?: string; warning?: string};
const databaseName = 'studyplus-device-sync-v1';
async function connection(write?: Connection | null, expected?: string): Promise<Connection | null> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(databaseName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('connection');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('別のタブを閉じて再試行してください。'));
  });
  return new Promise((resolve, reject) => {
    const tx = db.transaction('connection', write === undefined ? 'readonly' : 'readwrite');
    const store = tx.objectStore('connection');
    const r = store.get('main');
    if (write !== undefined) r.onsuccess = () => {
      if (expected !== undefined && r.result?.session !== expected) {tx.abort(); return;}
      if (write === null) store.delete('main'); else store.put(write, 'main');
    };
    tx.oncomplete = () => {db.close(); resolve(write === undefined ? r.result || null : write);};
    tx.onabort = tx.onerror = () => {db.close(); reject(new Error('同期設定を保存できません。端末内の記録は保持されています。'));};
  });
}
export async function getConnection() {
  const c = await connection();
  return c ? {provider: c.provider || 'cloudflare', url: c.url, repository: c.repository, branch: c.branch, syncedAt: c.syncedAt} : null;
}
export async function connect(url: string, key: string) {
  const parsed = new URL(url);
  if ((parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('HTTPSの同期API URLを指定してください。');
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(key)) throw new Error('共有キーは43〜128文字の英数字・ハイフン・アンダースコアで指定してください。');
  const next = {session: crypto.randomUUID(), url: parsed.href.replace(/\/$/, ''), key, base: null, remoteRevision: 0};
  const remote = await request(next);
  // Check authentication before persisting; the first merge uses an empty baseline.
  if (!Number.isInteger(remote.revision) || (remote.data !== null && !validateSyncData(remote.data))) throw new Error('同期APIの応答形式が不正です。');
  await connection(next);
}
export async function connectGitHub(repository: string, branch: string, key: string) {
  validateGitHubTarget(repository, branch, key);
  const next: Connection = {provider: 'github', repository, branch, session: crypto.randomUUID(), url: '', key, base: null, remoteRevision: 0};
  await readGitHub({repository, branch, key});
  await connection(next);
}
function gitHubTarget(c: Connection) {
  if (!c.repository || !c.branch) throw new Error('GitHubの同期設定を確認してください。');
  return {repository: c.repository, branch: c.branch, key: c.key};
}
export async function disconnect() {await connection(null);}
async function request(c: Connection, init?: RequestInit) {
  const r = await fetch(c.url + '/v1/state', {...init, headers: {'Authorization': 'Bearer ' + c.key, ...(init ? {'Content-Type': 'application/json'} : {})}, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000)});
  const body = await r.json() as {error?: string; revision: number; data: Data | null};
  if (!r.ok) throw new Error(r.status === 401 ? '共有キーが正しくありません。' : r.status === 409 ? '別の端末で更新されました。再度同期してください。' : body.error || '同期できません。端末内の記録は保持されています。');
  return body;
}
async function localState() {
  const r = await stateRequest();
  if (!r.ok) throw new Error('端末内の記録を読み込めません。同期は中止しました。');
  return r.json() as Promise<{revision: number; data: Data | null}>;
}
let running: Promise<SyncResult> | undefined;
export function synchronize(canApply: () => boolean = () => true): Promise<SyncResult> {
  if (running) return running;
  async function run(): Promise<SyncResult> {
    const c = await connection();
    if (!c) return {changed: false, conflicts: []};
    const [local, remote] = await Promise.all([localState(), c.provider === 'github' ? readGitHub(gitHubTarget(c)) : request(c)]);
    if (!Number.isInteger(remote.revision) || remote.revision < c.remoteRevision || (remote.data !== null && !validateSyncData(remote.data))) throw new Error('共有データの形式または版が不正です。同期は中止しました。');
    const {data, conflicts} = mergeSync(c.base, local.data, remote.data);
    if (conflicts.length) return {changed: false, conflicts, remote: remote.data};
    if (!canApply()) throw new Error('入力中のため同期を待機しています。');
    // Check this tab has not fallen behind another local tab before writing cloud.
    if ((await localState()).revision !== local.revision) throw new Error('別のタブで更新されました。再度同期してください。');
    let remoteRevision = remote.revision;
    if (!sameSyncData(remote.data, data)) {
      remoteRevision = c.provider === 'github' ? (await writeGitHub(gitHubTarget(c), remote, data)).revision : (await request(c, {method: 'PUT', body: JSON.stringify({revision: remote.revision, data})})).revision;
      if (!Number.isInteger(remoteRevision) || remoteRevision !== remote.revision + 1) throw new Error('保存結果を確認できません。再度同期してください。');
    }
    // Do not replace local data after settings were disconnected/reconfigured.
    const current = await connection();
    if (!current || current.url !== c.url || current.session !== c.session || !canApply()) throw new Error('同期設定または入力状態が変わりました。再度同期してください。');
    const changed = !sameSyncData(local.data, data);
    if (changed) {
      const r = await stateRequest({method: 'PUT', body: JSON.stringify({revision: local.revision, data})});
      if (!r.ok) throw new Error('端末内の更新が競合しました。記録は保持されています。再度同期してください。');
    }
    const syncedAt = new Date().toISOString();
    try {await connection({...c, base: data, remoteRevision, syncedAt}, c.session);}
    catch {return {changed, conflicts: [], warning: '共有保存先の更新後に端末の同期状態を保存できませんでした。再度同期してください。'};}
    return {changed, conflicts: [], syncedAt};
  }
  async function locked(): Promise<SyncResult> {return navigator.locks ? await navigator.locks.request('studyplus-device-sync', async () => await run()) : await run();}
  const promise = locked().finally(() => {running = undefined;});
  running = promise;
  return promise;
}
